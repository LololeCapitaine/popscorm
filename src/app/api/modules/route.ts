import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateShareId, isSafeRelPath } from "@/lib/ids";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Enregistre un module en base APRÈS que ses fichiers ont été transférés dans
 * R2 via les URLs signées. Le préfixe de stockage est reconstruit côté serveur
 * à partir de l'utilisateur authentifié (on ne fait pas confiance au client).
 */
export async function POST(request: Request) {
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

  const moduleId = String(body.moduleId ?? "");
  const scormVersion = String(body.scormVersion ?? "");
  const entryPath = String(body.entryPath ?? "");
  const sizeBytes = Number(body.sizeBytes ?? 0);
  let title = String(body.title ?? "").trim();

  if (!UUID_RE.test(moduleId)) {
    return NextResponse.json({ error: "moduleId invalide" }, { status: 400 });
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
  if (!title) title = "Module sans titre";
  if (title.length > 200) title = title.slice(0, 200);

  const status = String(body.status ?? "public");
  if (!["public", "private", "inactive"].includes(status)) {
    return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
  }
  let password: string | null = null;
  if (status === "private") {
    password = String(body.password ?? "").trim();
    if (!password) {
      return NextResponse.json(
        { error: "Un mot de passe est requis pour un module privé." },
        { status: 400 },
      );
    }
    if (password.length > 200) password = password.slice(0, 200);
  }
  const tool = body.tool ? String(body.tool).slice(0, 40) : null;

  const storagePrefix = `users/${user.id}/modules/${moduleId}/`;

  // Insertion avec quelques tentatives en cas de collision de share_id.
  let shareId = "";
  let inserted = false;
  let lastError: string | null = null;
  for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
    shareId = generateShareId();
    const { error } = await supabase.from("modules").insert({
      id: moduleId,
      user_id: user.id,
      title,
      scorm_version: scormVersion,
      entry_path: entryPath,
      size_bytes: sizeBytes,
      storage_prefix: storagePrefix,
      share_id: shareId,
      status,
      password,
      tool,
    });
    if (!error) {
      inserted = true;
    } else if (error.code === "23505" && error.message.includes("share_id")) {
      continue; // collision improbable -> on régénère
    } else {
      lastError = error.message;
      break;
    }
  }

  if (!inserted) {
    return NextResponse.json(
      { error: lastError ?? "Échec de l'enregistrement du module" },
      { status: 500 },
    );
  }

  // Met à jour l'espace de stockage utilisé.
  const { data: profile } = await supabase
    .from("profiles")
    .select("storage_used_bytes")
    .eq("user_id", user.id)
    .single();
  const current = Number(profile?.storage_used_bytes ?? 0);
  await supabase
    .from("profiles")
    .update({ storage_used_bytes: current + sizeBytes })
    .eq("user_id", user.id);

  return NextResponse.json({ id: moduleId, shareId });
}
