import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { presignPut } from "@/lib/r2";
import { contentTypeFor } from "@/lib/mime";
import { isSafeRelPath } from "@/lib/ids";
import { limitForPlan } from "@/lib/plans";
import { formatBytes } from "@/lib/format";

const MAX_FILES = 5000;

/**
 * Génère des URLs signées pour envoyer chaque fichier du module directement
 * dans R2 depuis le navigateur. N'enregistre rien en base (cela se fait au
 * `commit`, une fois les fichiers transférés).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const files = (body as { files?: unknown })?.files;
  if (!Array.isArray(files) || files.length === 0) {
    return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Trop de fichiers (maximum ${MAX_FILES}).` },
      { status: 400 },
    );
  }
  for (const p of files) {
    if (typeof p !== "string" || !isSafeRelPath(p)) {
      return NextResponse.json(
        { error: `Chemin de fichier invalide : ${String(p)}` },
        { status: 400 },
      );
    }
  }

  // Vérification du quota AVANT tout envoi.
  const totalBytes = Number((body as { totalBytes?: unknown })?.totalBytes ?? 0);
  if (!Number.isFinite(totalBytes) || totalBytes < 0) {
    return NextResponse.json({ error: "Taille invalide" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, storage_used_bytes")
    .eq("user_id", user.id)
    .single();

  const limit = limitForPlan(profile?.plan);
  let used = Number(profile?.storage_used_bytes ?? 0);

  // Remplacement d'un module existant : on ne recompte pas l'ancienne version.
  const replaceModuleId = body
    ? String((body as { replaceModuleId?: unknown }).replaceModuleId ?? "")
    : "";
  if (replaceModuleId) {
    const { data: old } = await supabase
      .from("modules")
      .select("size_bytes")
      .eq("id", replaceModuleId)
      .single();
    if (old) used = Math.max(0, used - Number(old.size_bytes ?? 0));
  }

  if (used + totalBytes > limit) {
    const remaining = Math.max(0, limit - used);
    return NextResponse.json(
      {
        error: `Espace insuffisant : ce module fait ${formatBytes(
          totalBytes,
        )} mais il ne te reste que ${formatBytes(
          remaining,
        )} sur ${formatBytes(limit)}.`,
      },
      { status: 413 },
    );
  }

  const moduleId = randomUUID();
  const prefix = `users/${user.id}/modules/${moduleId}/`;

  const uploads = await Promise.all(
    (files as string[]).map(async (path) => {
      const contentType = contentTypeFor(path);
      const url = await presignPut(prefix + path, contentType);
      return { path, url, contentType };
    }),
  );

  return NextResponse.json({ moduleId, uploads });
}
