import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Player } from "./player";

interface PublicModule {
  id: string;
  title: string;
  scorm_version: string;
  entry_path: string;
  storage_prefix: string;
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

export default async function ViewerPage(props: PageProps<"/v/[shareId]">) {
  const { shareId } = await props.params;
  const mod = await fetchModule(shareId);
  if (!mod) notFound();

  return (
    <Player
      shareId={shareId}
      title={mod.title}
      version={mod.scorm_version}
      entryPath={mod.entry_path}
    />
  );
}
