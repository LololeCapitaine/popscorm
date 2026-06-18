import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { accessCookieName, accessToken } from "@/lib/access";

/**
 * Vérifie le mot de passe d'un module privé. En cas de succès, pose un cookie
 * d'accès signé (httpOnly) qui autorise la lecture du contenu.
 */
export async function POST(request: Request) {
  let body: { shareId?: unknown; password?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const shareId = String(body.shareId ?? "");
  const password = String(body.password ?? "");
  if (!shareId || !password) {
    return NextResponse.json({ error: "Champs manquants" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("check_module_password", {
    p_share_id: shareId,
    p_password: password,
  });

  if (error || data !== true) {
    return NextResponse.json(
      { error: "Mot de passe incorrect" },
      { status: 401 },
    );
  }

  const cookieStore = await cookies();
  cookieStore.set(accessCookieName(shareId), accessToken(shareId), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12, // 12 h
  });

  return NextResponse.json({ ok: true });
}
