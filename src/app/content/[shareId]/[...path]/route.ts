import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getObject } from "@/lib/r2";
import { contentTypeFor } from "@/lib/mime";
import { isSafeRelPath } from "@/lib/ids";
import { accessCookieName, verifyAccess } from "@/lib/access";

// Cache mémoire (par instance) : share_id -> { prefix, status }.
const CACHE = new Map<
  string,
  { prefix: string; status: string; expires: number }
>();
const TTL_MS = 30_000;

async function resolveModule(shareId: string) {
  const hit = CACHE.get(shareId);
  if (hit && hit.expires > Date.now()) return hit;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_module", {
    p_share_id: shareId,
  });
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.storage_prefix) return null;
  const entry = {
    prefix: row.storage_prefix as string,
    status: (row.status as string) ?? "public",
    expires: Date.now() + TTL_MS,
  };
  CACHE.set(shareId, entry);
  return entry;
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

  const mod = await resolveModule(shareId);
  if (!mod) {
    return new Response("Module introuvable", { status: 404 });
  }

  // Contrôle d'accès selon le statut.
  if (mod.status === "inactive") {
    return new Response("Module indisponible", { status: 404 });
  }
  if (mod.status === "private") {
    const cookieStore = await cookies();
    const token = cookieStore.get(accessCookieName(shareId))?.value;
    if (!verifyAccess(shareId, token)) {
      return new Response("Accès refusé", { status: 403 });
    }
  }

  try {
    const obj = await getObject(mod.prefix + rel);
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
    headers.set("Cache-Control", "private, max-age=3600");

    return new Response(stream, { status: 200, headers });
  } catch {
    return new Response("Fichier introuvable", { status: 404 });
  }
}
