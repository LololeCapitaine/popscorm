import { createBrowserClient } from "@supabase/ssr";

/**
 * Client Supabase à utiliser dans les Composants Client (navigateur).
 * Lit les variables publiques injectées au build / runtime.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
