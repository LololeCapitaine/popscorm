"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { unzip } from "fflate";
import { analyzeScorm, detectManifestPath } from "@/lib/scorm";
import { formatBytes } from "@/lib/format";
import { Logo } from "@/components/logo";
import { Icon } from "@/components/icon";
import { signOut } from "@/app/login/actions";

interface ModuleItem {
  id: string;
  title: string;
  share_id: string;
  scorm_version: string;
  size_bytes: number;
  created_at: string;
}

interface UserInfo {
  email: string;
  fullName: string;
  avatarUrl: string | null;
  initials: string;
}

interface Props {
  user: UserInfo;
  modules: ModuleItem[];
  used: number;
  limit: number;
}

type SortKey = "recent" | "oldest" | "name" | "size";
type Phase = "idle" | "reading" | "uploading" | "saving" | "error";

const CONCURRENCY = 6;

export function DashboardClient({ user, modules, used, limit }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [linkModule, setLinkModule] = useState<ModuleItem | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploading =
    phase === "reading" || phase === "uploading" || phase === "saving";

  const pct = Math.min(100, Math.round((used / limit) * 100));

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = modules.filter((m) =>
      q ? m.title.toLowerCase().includes(q) : true,
    );
    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sort) {
        case "name":
          return a.title.localeCompare(b.title, "fr");
        case "size":
          return Number(b.size_bytes) - Number(a.size_bytes);
        case "oldest":
          return +new Date(a.created_at) - +new Date(b.created_at);
        default:
          return +new Date(b.created_at) - +new Date(a.created_at);
      }
    });
    return sorted;
  }, [modules, search, sort]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((prev) =>
      prev.size === visible.length
        ? new Set()
        : new Set(visible.map((m) => m.id)),
    );
  }

  async function deleteModule(id: string) {
    setBusy((p) => new Set(p).add(id));
    try {
      const res = await fetch(`/api/modules/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Échec de la suppression");
      setSelected((p) => {
        const n = new Set(p);
        n.delete(id);
        return n;
      });
      router.refresh();
    } catch {
      setBusy((p) => {
        const n = new Set(p);
        n.delete(id);
        return n;
      });
    }
  }

  async function deleteOne(m: ModuleItem) {
    if (!confirm(`Supprimer « ${m.title} » ? Cette action est définitive.`)) {
      return;
    }
    await deleteModule(m.id);
  }

  async function deleteSelected() {
    if (
      !confirm(
        `Supprimer ${selected.size} module(s) ? Cette action est définitive.`,
      )
    ) {
      return;
    }
    for (const id of Array.from(selected)) {
      await deleteModule(id);
    }
  }

  async function handleFile(file: File) {
    setUploadError(null);
    try {
      setPhase("reading");
      const buf = new Uint8Array(await file.arrayBuffer());
      const entries = await new Promise<Record<string, Uint8Array>>(
        (resolve, reject) =>
          unzip(buf, (err, data) => (err ? reject(err) : resolve(data))),
      );

      const allPaths = Object.keys(entries).filter((p) => !p.endsWith("/"));
      const manifestPath = detectManifestPath(allPaths);
      if (!manifestPath) {
        throw new Error(
          "Ce fichier ne contient pas de imsmanifest.xml : ce n'est pas un module SCORM valide.",
        );
      }
      const manifestXml = new TextDecoder().decode(entries[manifestPath]);
      const info = analyzeScorm(allPaths, manifestXml, manifestPath);

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

      const presignRes = await fetch("/api/modules/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: rooted.map((f) => f.rel), totalBytes }),
      });
      if (!presignRes.ok) {
        throw new Error(
          (await presignRes.json().catch(() => ({}))).error ??
            "Échec de la préparation de l'envoi.",
        );
      }
      const { moduleId, uploads } = (await presignRes.json()) as {
        moduleId: string;
        uploads: { path: string; url: string; contentType: string }[];
      };
      const byPath = new Map(uploads.map((u) => [u.path, u]));

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
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Erreur inconnue");
      setPhase("error");
    }
  }

  const remaining = Math.max(0, limit - used);

  return (
    <div className="flex h-dvh w-full bg-cream font-sans text-ink">
      <input
        ref={fileRef}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />

      {/* Sidebar */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-cream-200 bg-white/60 px-4 py-5">
        <div className="px-2 text-xl font-bold tracking-tight">
          <Logo />
        </div>

        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-60"
        >
          <Icon name="upload" className="text-[20px]" />
          Uploader un module
        </button>

        <nav className="mt-6 flex flex-col gap-1 text-sm">
          <span className="flex items-center gap-3 rounded-lg bg-brand-50 px-3 py-2 font-medium text-brand-700">
            <Icon name="grid_view" /> Mes modules
          </span>
          <span className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-taupe-light">
            <Icon name="bar_chart" /> Statistiques
            <span className="ml-auto text-[10px] uppercase">bientôt</span>
          </span>
          <span className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-taupe-light">
            <Icon name="settings" /> Paramètres
            <span className="ml-auto text-[10px] uppercase">bientôt</span>
          </span>
        </nav>

        <div className="mt-auto flex flex-col gap-4">
          {/* Stockage */}
          <div className="rounded-xl border border-cream-200 bg-white p-3">
            <div className="flex items-center justify-between text-xs text-taupe">
              <span>Stockage</span>
              <span>{pct}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-cream-200">
              <div
                className={`h-full rounded-full ${pct >= 100 ? "bg-red-500" : "bg-brand-500"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-taupe">
              {formatBytes(used)} / {formatBytes(limit)}
            </p>
          </div>

          {/* Compte */}
          <div className="flex items-center gap-3 rounded-xl border border-cream-200 bg-white p-2.5">
            <Avatar user={user} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {user.fullName || user.email.split("@")[0]}
              </p>
              <p className="truncate text-xs text-taupe">{user.email}</p>
            </div>
            <form action={signOut}>
              <button
                title="Se déconnecter"
                className="flex items-center rounded-lg p-1.5 text-taupe transition hover:bg-cream-100 hover:text-ink"
              >
                <Icon name="logout" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-8 py-8">
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Mes modules
          </h1>
          <p className="mt-1 text-sm text-taupe">
            {modules.length} module{modules.length > 1 ? "s" : ""} ·{" "}
            {formatBytes(remaining)} restants
          </p>

          {/* Bandeau d'upload en cours */}
          {(uploading || phase === "error") && (
            <div className="mt-5 rounded-xl border border-cream-200 bg-white px-4 py-3 text-sm">
              {phase === "reading" && "Lecture et analyse du paquet…"}
              {phase === "uploading" &&
                `Envoi des fichiers… ${progress.done}/${progress.total}`}
              {phase === "saving" && "Enregistrement…"}
              {phase === "error" && (
                <span className="text-brand-700">{uploadError}</span>
              )}
            </div>
          )}

          {/* Toolbar */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Icon
                name="search"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-taupe-light"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un module…"
                className="w-full rounded-xl border border-cream-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-xl border border-cream-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-brand-400"
            >
              <option value="recent">Plus récent</option>
              <option value="oldest">Plus ancien</option>
              <option value="name">Nom (A → Z)</option>
              <option value="size">Taille</option>
            </select>
          </div>

          {/* Barre de sélection */}
          {selected.size > 0 && (
            <div className="mt-4 flex items-center justify-between rounded-xl bg-brand-50 px-4 py-2.5 text-sm">
              <span className="font-medium text-brand-700">
                {selected.size} sélectionné{selected.size > 1 ? "s" : ""}
              </span>
              <button
                onClick={deleteSelected}
                className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 font-medium text-white transition hover:bg-brand-700"
              >
                <Icon name="delete" className="text-[18px]" /> Supprimer
              </button>
            </div>
          )}

          {/* Tableau */}
          <div className="mt-6 overflow-hidden rounded-2xl border border-cream-200 bg-white">
            {visible.length === 0 ? (
              <div className="px-6 py-16 text-center text-sm text-taupe">
                {modules.length === 0
                  ? "Aucun module. Clique sur « Uploader un module » pour commencer."
                  : "Aucun module ne correspond à ta recherche."}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-cream-200 text-left text-xs uppercase tracking-wide text-taupe-light">
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={
                          selected.size === visible.length && visible.length > 0
                        }
                        onChange={toggleAll}
                        className="accent-brand-500"
                      />
                    </th>
                    <th className="px-2 py-3 font-medium">Module</th>
                    <th className="px-2 py-3 font-medium">Outil</th>
                    <th className="px-2 py-3 font-medium">Statut</th>
                    <th className="px-2 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((m) => (
                    <tr
                      key={m.id}
                      className="border-b border-cream-100 last:border-0 hover:bg-cream/50"
                    >
                      <td className="px-4 py-3 align-middle">
                        <input
                          type="checkbox"
                          checked={selected.has(m.id)}
                          onChange={() => toggle(m.id)}
                          className="accent-brand-500"
                        />
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-white">
                            <Icon name="school" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{m.title}</p>
                            <p className="text-xs text-taupe">
                              {formatBytes(Number(m.size_bytes))} ·{" "}
                              {new Date(m.created_at).toLocaleDateString("fr-FR")}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-3 text-taupe">—</td>
                      <td className="px-2 py-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          Public
                        </span>
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <a
                            href={`/v/${m.share_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Ouvrir"
                            className="flex rounded-lg p-2 text-taupe transition hover:bg-cream-100 hover:text-ink"
                          >
                            <Icon name="visibility" className="text-[20px]" />
                          </a>
                          <button
                            onClick={() => setLinkModule(m)}
                            title="Lien de partage"
                            className="flex rounded-lg p-2 text-taupe transition hover:bg-cream-100 hover:text-ink"
                          >
                            <Icon name="link" className="text-[20px]" />
                          </button>
                          <button
                            onClick={() => deleteOne(m)}
                            disabled={busy.has(m.id)}
                            title="Supprimer"
                            className="flex rounded-lg p-2 text-taupe transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          >
                            <Icon name="delete" className="text-[20px]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>

      {linkModule && (
        <LinkModal
          module={linkModule}
          onClose={() => setLinkModule(null)}
        />
      )}
    </div>
  );
}

function Avatar({ user }: { user: UserInfo }) {
  if (user.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.avatarUrl}
        alt=""
        referrerPolicy="no-referrer"
        className="h-9 w-9 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-semibold text-white">
      {user.initials}
    </span>
  );
}

function LinkModal({
  module,
  onClose,
}: {
  module: ModuleItem;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/v/${module.share_id}`
      : `/v/${module.share_id}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Lien de partage</h2>
          <button
            onClick={onClose}
            className="flex rounded-lg p-1 text-taupe hover:bg-cream-100"
          >
            <Icon name="close" />
          </button>
        </div>
        <p className="mt-1 text-sm text-taupe">{module.title}</p>
        <div className="mt-4 flex gap-2">
          <input
            readOnly
            value={url}
            className="flex-1 rounded-lg border border-cream-200 bg-cream px-3 py-2 text-sm text-taupe outline-none"
          />
          <button
            onClick={copy}
            className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600"
          >
            <Icon name={copied ? "check" : "content_copy"} className="text-[18px]" />
            {copied ? "Copié" : "Copier"}
          </button>
        </div>
      </div>
    </div>
  );
}
