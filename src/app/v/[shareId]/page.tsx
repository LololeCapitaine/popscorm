import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { accessCookieName, verifyAccess } from "@/lib/access";
import { Player } from "./player";
import { PasswordGate } from "./password-gate";

interface PublicModule {
  id: string;
  title: string;
  scorm_version: string;
  entry_path: string;
  storage_prefix: string;
  status: string;
}

async function fetchModule(shareId: string): Promise<PublicModule | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_module", {
    p_share_id: shareId,
  });
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as PublicModule) ?? null;
}

export async function generateMetadata(
  props: PageProps<"/v/[shareId]">,
): Promise<Metadata> {
  const { shareId } = await props.params;
  const mod = await fetchModule(shareId);
  return { title: mod ? `${mod.title} — Popscorm` : "Module introuvable" };
}

function Unavailable() {
  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-3 bg-cream px-6 text-center font-sans">
      <h1 className="text-xl font-semibold text-ink">Module indisponible</h1>
      <p className="max-w-md text-sm text-taupe">
        Ce module a été désactivé par son auteur.
      </p>
    </main>
  );
}

export default async function ViewerPage(props: PageProps<"/v/[shareId]">) {
  const { shareId } = await props.params;
  const mod = await fetchModule(shareId);
  if (!mod) notFound();

  if (mod.status === "inactive") {
    return <Unavailable />;
  }

  if (mod.status === "private") {
    const cookieStore = await cookies();
    const token = cookieStore.get(accessCookieName(shareId))?.value;
    if (!verifyAccess(shareId, token)) {
      return <PasswordGate shareId={shareId} title={mod.title} />;
    }
  }

  return (
    <Player
      shareId={shareId}
      title={mod.title}
      version={mod.scorm_version}
      entryPath={mod.entry_path}
    />
  );
}
