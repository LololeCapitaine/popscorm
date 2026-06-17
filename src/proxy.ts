import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next.js 16 : la convention `middleware` est renommée `proxy`.
// Runtime Node.js (l'edge n'est pas supporté par `proxy`).
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * S'exécute sur toutes les routes SAUF :
     * - les fichiers statiques de Next (_next/static, _next/image)
     * - les fichiers d'icônes / images du dossier public
     * Ainsi le rafraîchissement de session ne bloque pas le chargement des assets.
     */
    "/((?!_next/static|_next/image|favicon.ico|content/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
