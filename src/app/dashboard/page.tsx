import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { limitForPlan } from "@/lib/plans";
import { DashboardClient } from "./dashboard-client";

function initialsFrom(name: string, email: string): string {
  const base = name.trim() || email.split("@")[0] || "";
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  const letters =
    parts.length >= 2
      ? parts[0][0] + parts[1][0]
      : base.slice(0, 2);
  return letters.toUpperCase();
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/dashboard");
  }

  const [{ data: modules }, { data: profile }] = await Promise.all([
    supabase
      .from("modules")
      .select(
        "id, title, share_id, scorm_version, size_bytes, created_at, status, password, tool",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("plan, storage_used_bytes")
      .eq("user_id", user.id)
      .single(),
  ]);

  const meta = user.user_metadata ?? {};
  const fullName: string = meta.full_name ?? meta.name ?? "";
  const avatarUrl: string | null = meta.avatar_url ?? meta.picture ?? null;

  return (
    <DashboardClient
      user={{
        email: user.email ?? "",
        fullName,
        avatarUrl,
        initials: initialsFrom(fullName, user.email ?? ""),
      }}
      modules={modules ?? []}
      used={Number(profile?.storage_used_bytes ?? 0)}
      limit={limitForPlan(profile?.plan)}
    />
  );
}
