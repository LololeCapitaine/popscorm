import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Rafraîchit la session Supabase à chaque requête et protège les routes
 * privées. Appelé depuis `src/proxy.ts` (convention Next.js 16 qui remplace
 * l'ancien `middleware`).
 *
 * Important : on renvoie l'objet `NextResponse` créé ici (avec ses cookies)
 * pour que la session reste synchronisée entre le navigateur et le serveur.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // NE PAS exécuter de code entre createServerClient et getUser() :
  // cela éviterait des bugs subtils de déconnexion aléatoire.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Routes privées : rediriger vers /login si non connecté.
  const path = request.nextUrl.pathname;
  const isProtected = path.startsWith("/dashboard");

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", path);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
