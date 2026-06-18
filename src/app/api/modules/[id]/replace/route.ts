import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deletePrefix } from "@/lib/r2";
import { isSafeRelPath } from "@/lib/ids";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Remplace le fichier d'un module existant par une nouvelle version (déjà
 * transférée dans R2 sous un nouveau préfixe), sans changer son share_id.
 * Met à jour les métadonnées, recale le quota et supprime l'ancien contenu.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const newModuleId = String(body.newModuleId ?? "");
  const scormVersion = String(body.scormVersion ?? "");
  const entryPath = String(body.entryPath ?? "");
  const sizeBytes = Number(body.sizeBytes ?? 0);

  if (!UUID_RE.test(newModuleId)) {
    return NextResponse.json({ error: "newModuleId invalide" }, { status: 400 });
  }
  if (scormVersion !== "1.2" && scormVersion !== "2004") {
    return NextResponse.json(
      { error: "Version SCORM invalide" },
      { status: 400 },
    );
  }
  if (!entryPath || !isSafeRelPath(entryPath)) {
    return NextResponse.json(
      { error: "Fichier de lancement invalide" },
      { status: 400 },
    );
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes < 0) {
    return NextResponse.json({ error: "Taille invalide" }, { status: 400 });
  }

  // Module existant (RLS garantit la propriété).
  const { data: mod, error } = await supabase
    .from("modules")
    .select("storage_prefix, size_bytes")
    .eq("id", id)
    .single();
  if (error || !mod) {
    return NextResponse.json({ error: "Module introuvable" }, { status: 404 });
  }

  const oldPrefix = mod.storage_prefix as string;
  const newPrefix = `users/${user.id}/modules/${newModuleId}/`;

  const { error: upErr } = await supabase
    .from("modules")
    .update({
      storage_prefix: newPrefix,
      scorm_version: scormVersion,
      entry_path: entryPath,
      size_bytes: sizeBytes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  // Recale l'espace utilisé : - ancienne taille + nouvelle.
  const { data: profile } = await supabase
    .from("profiles")
    .select("storage_used_bytes")
    .eq("user_id", user.id)
    .single();
  const next = Math.max(
    0,
    Number(profile?.storage_used_bytes ?? 0) -
      Number(mod.size_bytes ?? 0) +
      sizeBytes,
  );
  await supabase
    .from("profiles")
    .update({ storage_used_bytes: next })
    .eq("user_id", user.id);

  // Supprime l'ancien contenu R2 (après bascule sur le nouveau préfixe).
  if (oldPrefix && oldPrefix !== newPrefix) {
    await deletePrefix(oldPrefix);
  }

  return NextResponse.json({ ok: true });
}
