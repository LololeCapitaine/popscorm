"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { unzip } from "fflate";
import { analyzeScorm, detectManifestPath } from "@/lib/scorm";

type Phase = "idle" | "reading" | "uploading" | "saving" | "error";

interface PresignUpload {
  path: string;
  url: string;
  contentType: string;
}

const CONCURRENCY = 6;

export function UploadModule() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  const busy = phase === "reading" || phase === "uploading" || phase === "saving";

  async function handleFile(file: File) {
    setError(null);
    try {
      // 1) Dézippage dans le navigateur
      setPhase("reading");
      const buf = new Uint8Array(await file.arrayBuffer());
      const entries = await new Promise<Record<string, Uint8Array>>(
        (resolve, reject) => {
          unzip(buf, (err, data) => (err ? reject(err) : resolve(data)));
        },
      );

      const allPaths = Object.keys(entries).filter((p) => !p.endsWith("/"));
      const manifestPath = detectManifestPath(allPaths);
      if (!manifestPath) {
        throw new Error(
          "Ce fichier ne contient pas de imsmanifest.xml : ce n'est pas un module SCORM valide.",
        );
      }

      // 2) Lecture du manifeste
      const manifestXml = new TextDecoder().decode(entries[manifestPath]);
      const info = analyzeScorm(allPaths, manifestXml, manifestPath);

      // 3) Re-racine les chemins par rapport au dossier du manifeste
      const dir = info.manifestDir;
      const rooted = allPaths
        .filter((p) => p.startsWith(dir))
        .map((p) => ({ rel: p.slice(dir.length), bytes: entries[p] }))
        .filter((f) => f.rel.length > 0);

      const entryFile = info.entryPath.split(/[?#]/)[0];
      if (!rooted.some((f) => f.rel === entryFile)) {
        throw new Error(
          `Le fichier de lancement « ${entryFile} » est introuvable dans le paquet.`,
        );
      }

      const totalBytes = rooted.reduce((s, f) => s + f.bytes.byteLength, 0);

      // 4) Demande des URLs signées
      const presignRes = await fetch("/api/modules/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: rooted.map((f) => f.rel) }),
      });
      if (!presignRes.ok) {
        throw new Error(
          (await presignRes.json().catch(() => ({}))).error ??
            "Échec de la préparation de l'envoi.",
        );
      }
      const { moduleId, uploads } = (await presignRes.json()) as {
        moduleId: string;
        uploads: PresignUpload[];
      };
      const byPath = new Map(uploads.map((u) => [u.path, u]));

      // 5) Envoi de chaque fichier directement dans R2
      setPhase("uploading");
      setProgress({ done: 0, total: rooted.length });
      let done = 0;
      let cursor = 0;
      const worker = async () => {
        while (cursor < rooted.length) {
          const f = rooted[cursor++];
          const u = byPath.get(f.rel);
          if (!u) throw new Error(`URL d'envoi manquante pour ${f.rel}`);
          const put = await fetch(u.url, {
            method: "PUT",
            // Uint8Array -> BlobPart accepté par fetch
            body: f.bytes as BodyInit,
            headers: { "Content-Type": u.contentType },
          });
          if (!put.ok) {
            throw new Error(`Échec de l'envoi de ${f.rel} (HTTP ${put.status}).`);
          }
          done += 1;
          setProgress({ done, total: rooted.length });
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, rooted.length) }, worker),
      );

      // 6) Enregistrement en base
      setPhase("saving");
      const title = info.title?.trim() || file.name.replace(/\.zip$/i, "");
      const commit = await fetch("/api/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleId,
          title,
          scormVersion: info.version,
          entryPath: info.entryPath,
          sizeBytes: totalBytes,
        }),
      });
      if (!commit.ok) {
        throw new Error(
          (await commit.json().catch(() => ({}))).error ??
            "Échec de l'enregistrement du module.",
        );
      }

      setPhase("idle");
      setProgress({ done: 0, total: 0 });
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
      setPhase("error");
    }
  }

  return (
    <div className="rounded-xl border border-black/10 bg-white p-5 dark:border-white/15 dark:bg-zinc-950">
      <h2 className="text-sm font-semibold">Déposer un module SCORM</h2>
      <p className="mt-1 text-xs text-black/55 dark:text-white/55">
        Fichier <code>.zip</code> contenant un <code>imsmanifest.xml</code>. Le
        dézippage se fait dans ton navigateur, puis les fichiers sont envoyés
        directement vers le stockage.
      </p>

      <div className="mt-4 flex items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".zip,application/zip"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
          className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-black file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:opacity-90 disabled:opacity-50 dark:file:bg-white dark:file:text-black"
        />
      </div>

      {phase === "reading" && (
        <p className="mt-3 text-sm text-black/60 dark:text-white/60">
          Lecture et analyse du paquet…
        </p>
      )}
      {phase === "uploading" && (
        <p className="mt-3 text-sm text-black/60 dark:text-white/60">
          Envoi des fichiers… {progress.done}/{progress.total}
        </p>
      )}
      {phase === "saving" && (
        <p className="mt-3 text-sm text-black/60 dark:text-white/60">
          Enregistrement…
        </p>
      )}
      {phase === "error" && error && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
