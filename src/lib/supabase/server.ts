import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Client Supabase à utiliser côté serveur (Composants Serveur, Server Actions,
 * Route Handlers). En Next.js 16, `cookies()` est asynchrone : on l'attend.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Appelé depuis un Composant Serveur : l'écriture des cookies est
            // gérée par le `proxy`. On peut ignorer cette erreur en toute
            // sécurité tant que la session est rafraîchie côté proxy.
          }
        },
      },
    },
  );
}
