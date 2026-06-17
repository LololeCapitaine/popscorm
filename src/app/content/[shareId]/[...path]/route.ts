import { createClient } from "@/lib/supabase/server";
import { getObject } from "@/lib/r2";
import { contentTypeFor } from "@/lib/mime";
import { isSafeRelPath } from "@/lib/ids";

// Cache mémoire (par instance) : share_id -> préfixe de stockage.
// Évite une requête base pour chaque fichier d'un même module.
const CACHE = new Map<string, { prefix: string; expires: number }>();
const TTL_MS = 60_000;

async function resolvePrefix(shareId: string): Promise<string | null> {
  const hit = CACHE.get(shareId);
  if (hit && hit.expires > Date.now()) return hit.prefix;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_module", {
    p_share_id: shareId,
  });
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  const prefix = row?.storage_prefix ?? null;
  if (prefix) CACHE.set(shareId, { prefix, expires: Date.now() + TTL_MS });
  return prefix;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ shareId: string; path: string[] }> },
) {
  const { shareId, path } = await params;

  const rel = path.map((seg) => decodeURIComponent(seg)).join("/");
  if (!isSafeRelPath(rel)) {
    return new Response("Chemin invalide", { status: 400 });
  }

  const prefix = await resolvePrefix(shareId);
  if (!prefix) {
    return new Response("Module introuvable", { status: 404 });
  }

  try {
    const obj = await getObject(prefix + rel);
    const stream = (
      obj.Body as { transformToWebStream: () => ReadableStream }
    ).transformToWebStream();

    const headers = new Headers();
    headers.set(
      "Content-Type",
      obj.ContentType || contentTypeFor(rel) || "application/octet-stream",
    );
    if (obj.ContentLength != null) {
      headers.set("Content-Length", String(obj.ContentLength));
    }
    headers.set("Cache-Control", "public, max-age=3600");

    return new Response(stream, { status: 200, headers });
  } catch {
    return new Response("Fichier introuvable", { status: 404 });
  }
}
