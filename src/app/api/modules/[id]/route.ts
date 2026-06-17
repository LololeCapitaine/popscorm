import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deletePrefix } from "@/lib/r2";

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
