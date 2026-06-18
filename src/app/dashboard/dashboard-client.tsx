"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { unzip } from "fflate";
import { analyzeScorm, detectManifestPath, type ScormInfo } from "@/lib/scorm";
import { formatBytes } from "@/lib/format";
import { Logo } from "@/components/logo";
import { Icon } from "@/components/icon";
import { signOut } from "@/app/login/actions";

type Status = "public" | "private" | "inactive";

interface ModuleItem {
  id: string;
  title: string;
  share_id: string;
  scorm_version: string;
  size_bytes: number;
  created_at: string;
  status: Status;
  password: string | null;
  tool: string | null;
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

const STATUS_META: Record<
  Status,
  { label: string; cls: string; icon: string }
> = {
  public: {
    label: "Public",
    cls: "bg-emerald-50 text-emerald-700",
    icon: "public",
  },
  private: { label: "Privé", cls: "bg-amber-50 text-amber-700", icon: "lock" },
  inactive: {
    label: "Inactif",
    cls: "bg-stone-100 text-stone-500",
    icon: "block",
  },
};

interface PendingUpload {
  rooted: { rel: string; bytes: Uint8Array }[];
  info: ScormInfo;
  totalBytes: number;
}

interface FormState {
  mode: "create" | "edit";
  moduleId?: string;
  title: string;
  status: Status;
  password: string;
  meta?: { version: string; size: number };
}

export function DashboardClient({ user, modules, used, limit }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef<PendingUpload | null>(null);

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Set<string>>(new Set());

  const [linkModule, setLinkModule] = useState<ModuleItem | null>(null);
  const [lockModule, setLockModule] = useState<ModuleItem | null>(null);
  const [form, setForm] = useState<FormState | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploading =
    phase === "reading" || phase === "uploading" || phase === "saving";

  const pct = Math.min(100, Math.round((used / limit) * 100));
  const remaining = Math.max(0, limit - used);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = modules.filter((m) =>
      q ? m.title.toLowerCase().includes(q) : true,
    );
    return [...list].sort((a, b) => {
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
    if (confirm(`Supprimer « ${m.title} » ? Cette action est définitive.`)) {
      await deleteModule(m.id);
    }
  }

  async function deleteSelected() {
    if (
      confirm(
        `Supprimer ${selected.size} module(s) ? Cette action est définitive.`,
      )
    ) {
      for (const id of Array.from(selected)) await deleteModule(id);
    }
  }

  // --- Upload : sélection du fichier -> analyse -> ouverture de la modale ---
  async function onFilePicked(file: File) {
    setUploadError(null);
    setPhase("reading");
    try {
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
      pendingRef.current = { rooted, info, totalBytes };

      setPhase("idle");
      if (fileRef.current) fileRef.current.value = "";
      setForm({
        mode: "create",
        title: info.title?.trim() || file.name.replace(/\.zip$/i, ""),
        status: "public",
        password: "",
        meta: { version: info.version, size: totalBytes },
      });
    } catch (e) {
      setPhase("error");
      setUploadError(e instanceof Error ? e.message : "Erreur de lecture");
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // --- Upload réel après validation de la modale ---
  async function runUpload(values: {
    title: string;
    status: Status;
    password: string;
  }) {
    const pending = pendingRef.current;
    if (!pending) return;
    setUploadError(null);
    try {
      const { rooted, info, totalBytes } = pending;

      setPhase("uploading");
      setProgress({ done: 0, total: rooted.length });

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
      const commit = await fetch("/api/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleId,
          title: values.title,
          scormVersion: info.version,
          entryPath: info.entryPath,
          sizeBytes: totalBytes,
          status: values.status,
          password: values.password,
        }),
      });
      if (!commit.ok) {
        throw new Error(
          (await commit.json().catch(() => ({}))).error ??
            "Échec de l'enregistrement du module.",
        );
      }

      pendingRef.current = null;
      setPhase("idle");
      setProgress({ done: 0, total: 0 });
      router.refresh();
    } catch (e) {
      setPhase("error");
      setUploadError(e instanceof Error ? e.message : "Erreur inconnue");
    }
  }

  async function patchModule(
    id: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const res = await fetch(`/api/modules/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(
        (await res.json().catch(() => ({}))).error ?? "Échec de l'enregistrement",
      );
    }
    router.refresh();
  }

  return (
    <div className="flex h-dvh w-full bg-cream font-sans text-ink">
      <input
        ref={fileRef}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFilePicked(f);
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

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[200px] flex-1">
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
                  {visible.map((m) => {
                    const st = STATUS_META[m.status] ?? STATUS_META.public;
                    return (
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
                          <button
                            onClick={() =>
                              setForm({
                                mode: "edit",
                                moduleId: m.id,
                                title: m.title,
                                status: m.status,
                                password: m.password ?? "",
                              })
                            }
                            className="group flex items-center gap-3 text-left"
                          >
                            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-white">
                              <Icon
                                name="school"
                                className="text-[20px] group-hover:opacity-0"
                              />
                              <Icon
                                name="edit"
                                className="absolute text-[18px] opacity-0 group-hover:opacity-100"
                              />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate font-medium group-hover:text-brand-600">
                                {m.title}
                              </span>
                              <span className="block text-xs text-taupe">
                                {formatBytes(Number(m.size_bytes))} ·{" "}
                                {new Date(m.created_at).toLocaleDateString(
                                  "fr-FR",
                                )}
                              </span>
                            </span>
                          </button>
                        </td>
                        <td className="px-2 py-3 capitalize text-taupe">
                          {m.tool || "—"}
                        </td>
                        <td className="px-2 py-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}
                          >
                            {st.label}
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
                              onClick={() =>
                                setForm({
                                  mode: "edit",
                                  moduleId: m.id,
                                  title: m.title,
                                  status: m.status,
                                  password: m.password ?? "",
                                })
                              }
                              title="Éditer"
                              className="flex rounded-lg p-2 text-taupe transition hover:bg-cream-100 hover:text-ink"
                            >
                              <Icon name="edit" className="text-[20px]" />
                            </button>
                            <button
                              onClick={() => setLinkModule(m)}
                              title="Lien de partage"
                              className="flex rounded-lg p-2 text-taupe transition hover:bg-cream-100 hover:text-ink"
                            >
                              <Icon name="link" className="text-[20px]" />
                            </button>
                            {m.status === "private" && (
                              <button
                                onClick={() => setLockModule(m)}
                                title="Mot de passe"
                                className="flex rounded-lg p-2 text-taupe transition hover:bg-cream-100 hover:text-ink"
                              >
                                <Icon name="lock" className="text-[20px]" />
                              </button>
                            )}
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
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>

      {linkModule && (
        <LinkModal module={linkModule} onClose={() => setLinkModule(null)} />
      )}

      {lockModule && (
        <LockModal
          module={lockModule}
          onClose={() => setLockModule(null)}
          onSave={(pwd) => patchModule(lockModule.id, { password: pwd })}
        />
      )}

      {form && (
        <ModuleFormModal
          form={form}
          onClose={() => setForm(null)}
          onSubmit={async (values) => {
            if (form.mode === "create") {
              // On lance l'upload (banderole de progression) et on ferme la modale.
              void runUpload(values);
            } else if (form.moduleId) {
              await patchModule(form.moduleId, {
                title: values.title,
                status: values.status,
                password: values.password,
              });
            }
          }}
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

function Overlay({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function ModalHeader({
  title,
  onClose,
}: {
  title: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-lg font-semibold">{title}</h2>
      <button
        onClick={onClose}
        className="flex rounded-lg p-1 text-taupe hover:bg-cream-100"
      >
        <Icon name="close" />
      </button>
    </div>
  );
}

function ModuleFormModal({
  form,
  onClose,
  onSubmit,
}: {
  form: FormState;
  onClose: () => void;
  onSubmit: (v: {
    title: string;
    status: Status;
    password: string;
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState(form.title);
  const [status, setStatus] = useState<Status>(form.status);
  const [password, setPassword] = useState(form.password);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "private" && !password.trim()) {
      setError("Un mot de passe est requis pour un module privé.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ title: title.trim(), status, password });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
      setSubmitting(false);
    }
  }

  return (
    <Overlay onClose={onClose}>
      <ModalHeader
        title={form.mode === "create" ? "Nouveau module" : "Éditer le module"}
        onClose={onClose}
      />

      {form.meta && (
        <p className="mt-1 text-sm text-taupe">
          SCORM {form.meta.version} · {formatBytes(form.meta.size)}
        </p>
      )}

      <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Nom du module</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-lg border border-cream-200 px-3 py-2 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
        </label>

        <div className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Statut</span>
          <div className="grid grid-cols-3 gap-2">
            {(["public", "private", "inactive"] as Status[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`rounded-lg border px-2 py-2 text-xs font-medium transition ${
                  status === s
                    ? "border-brand-400 bg-brand-50 text-brand-700"
                    : "border-cream-200 text-taupe hover:bg-cream-100"
                }`}
              >
                {STATUS_META[s].label}
              </button>
            ))}
          </div>
          <p className="text-xs text-taupe">
            {status === "public" && "Accessible à toute personne ayant le lien."}
            {status === "private" && "Protégé par un mot de passe."}
            {status === "inactive" && "Le lien est désactivé."}
          </p>
        </div>

        {status === "private" && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Mot de passe</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mot de passe du module"
              className="rounded-lg border border-cream-200 px-3 py-2 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </label>
        )}

        {error && <p className="text-sm text-brand-700">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-cream-200 px-4 py-2 text-sm font-medium text-taupe transition hover:bg-cream-100"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-60"
          >
            {submitting
              ? "…"
              : form.mode === "create"
                ? "Uploader"
                : "Enregistrer"}
          </button>
        </div>
      </form>
    </Overlay>
  );
}

function LockModal({
  module,
  onClose,
  onSave,
}: {
  module: ModuleItem;
  onClose: () => void;
  onSave: (password: string) => Promise<void>;
}) {
  const [password, setPassword] = useState(module.password ?? "");
  const [reveal, setReveal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!password.trim()) {
      setError("Le mot de passe ne peut pas être vide.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(password);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
      setSaving(false);
    }
  }

  return (
    <Overlay onClose={onClose}>
      <ModalHeader title="Mot de passe du module" onClose={onClose} />
      <p className="mt-1 text-sm text-taupe">{module.title}</p>
      <div className="mt-4 flex gap-2">
        <input
          type={reveal ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="flex-1 rounded-lg border border-cream-200 px-3 py-2 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />
        <button
          onClick={() => setReveal((r) => !r)}
          className="flex items-center rounded-lg border border-cream-200 px-3 text-taupe transition hover:bg-cream-100"
          title={reveal ? "Masquer" : "Afficher"}
        >
          <Icon name={reveal ? "visibility_off" : "visibility"} />
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-brand-700">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-lg border border-cream-200 px-4 py-2 text-sm font-medium text-taupe transition hover:bg-cream-100"
        >
          Annuler
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-60"
        >
          {saving ? "…" : "Enregistrer"}
        </button>
      </div>
    </Overlay>
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
    <Overlay onClose={onClose}>
      <ModalHeader title="Lien de partage" onClose={onClose} />
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
          <Icon
            name={copied ? "check" : "content_copy"}
            className="text-[18px]"
          />
          {copied ? "Copié" : "Copier"}
        </button>
      </div>
      {module.status === "private" && (
        <p className="mt-3 text-xs text-amber-700">
          Ce module est privé : un mot de passe sera demandé à l’ouverture.
        </p>
      )}
      {module.status === "inactive" && (
        <p className="mt-3 text-xs text-stone-500">
          Ce module est inactif : le lien est actuellement désactivé.
        </p>
      )}
    </Overlay>
  );
}
