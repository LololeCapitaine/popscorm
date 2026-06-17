"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  id: string;
  title: string;
  shareId: string;
  scormVersion: string;
  sizeLabel: string;
  createdLabel: string;
}

export function ModuleRow({
  id,
  title,
  shareId,
  scormVersion,
  sizeLabel,
  createdLabel,
}: Props) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/v/${shareId}`
      : `/v/${shareId}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Copie impossible");
    }
  }

  async function remove() {
    if (!confirm(`Supprimer « ${title} » ? Cette action est définitive.`)) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/modules/${id}`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error(
          (await res.json().catch(() => ({}))).error ?? "Échec de la suppression",
        );
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
      setDeleting(false);
    }
  }

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-black/10 bg-white p-4 dark:border-white/15 dark:bg-zinc-950 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{title}</span>
          <span className="shrink-0 rounded bg-black/5 px-1.5 py-0.5 text-[10px] font-medium uppercase text-black/60 dark:bg-white/10 dark:text-white/60">
            SCORM {scormVersion}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-black/50 dark:text-white/50">
          {sizeLabel} · {createdLabel}
        </p>
        {error && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <a
          href={shareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-black/15 px-3 py-1.5 text-sm font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
        >
          Voir
        </a>
        <button
          onClick={copy}
          className="rounded-md border border-black/15 px-3 py-1.5 text-sm font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
        >
          {copied ? "Copié ✓" : "Copier le lien"}
        </button>
        <button
          onClick={remove}
          disabled={deleting}
          className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
        >
          {deleting ? "Suppression…" : "Supprimer"}
        </button>
      </div>
    </li>
  );
}
