import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deletePrefix } from "@/lib/r2";

/** Édition d'un module : titre, statut, mot de passe, outil. */
export async function PATCH(
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

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.title !== undefined) {
    let title = String(body.title).trim();
    if (!title) title = "Module sans titre";
    update.title = title.slice(0, 200);
  }

  if (body.tool !== undefined) {
    update.tool = body.tool ? String(body.tool).slice(0, 40) : null;
  }

  if (body.status !== undefined) {
    const status = String(body.status);
    if (!["public", "private", "inactive"].includes(status)) {
      return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
    }
    update.status = status;
    if (status === "private") {
      const password = String(body.password ?? "").trim();
      if (!password) {
        return NextResponse.json(
          { error: "Un mot de passe est requis pour un module privé." },
          { status: 400 },
        );
      }
      update.password = password.slice(0, 200);
    } else {
      update.password = null; // public/inactif : on efface le mot de passe
    }
  } else if (body.password !== undefined) {
    // Modification du mot de passe seul (depuis le cadenas).
    const password = String(body.password).trim();
    update.password = password ? password.slice(0, 200) : null;
  }

  const { error } = await supabase.from("modules").update(update).eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/** Supprime un module : ses fichiers dans R2, sa ligne en base, et décrémente le quota. */
export async function DELETE(
  _request: Request,
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

  // RLS garantit que l'on ne récupère que ses propres modules.
  const { data: mod, error } = await supabase
    .from("modules")
    .select("storage_prefix, size_bytes")
    .eq("id", id)
    .single();

  if (error || !mod) {
    return NextResponse.json({ error: "Module introuvable" }, { status: 404 });
  }

  // Supprime les fichiers dans R2.
  await deletePrefix(mod.storage_prefix);

  // Supprime la ligne (RLS protège déjà, on filtre quand même par sécurité).
  const { error: delError } = await supabase
    .from("modules")
    .delete()
    .eq("id", id);
  if (delError) {
    return NextResponse.json({ error: delError.message }, { status: 500 });
  }

  // Décrémente l'espace utilisé (sans descendre sous 0).
  const { data: profile } = await supabase
    .from("profiles")
    .select("storage_used_bytes")
    .eq("user_id", user.id)
    .single();
  const next = Math.max(
    0,
    Number(profile?.storage_used_bytes ?? 0) - Number(mod.size_bytes ?? 0),
  );
  await supabase
    .from("profiles")
    .update({ storage_used_bytes: next })
    .eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}
