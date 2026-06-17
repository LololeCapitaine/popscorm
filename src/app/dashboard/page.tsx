import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
import { formatBytes } from "@/lib/format";
import { UploadModule } from "./upload-module";
import { ModuleRow } from "./module-row";

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
      .select("id, title, share_id, scorm_version, size_bytes, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("storage_used_bytes")
      .eq("user_id", user.id)
      .single(),
  ]);

  const used = Number(profile?.storage_used_bytes ?? 0);
  const list = modules ?? [];

  return (
    <main className="flex flex-1 flex-col bg-zinc-50 font-sans dark:bg-black">
      <header className="flex items-center justify-between border-b border-black/10 px-6 py-4 dark:border-white/15">
        <span className="text-lg font-bold tracking-tight">Popscorm</span>
        <div className="flex items-center gap-4 text-sm">
          <span className="hidden text-black/60 sm:inline dark:text-white/60">
            {user.email}
          </span>
          <form action={signOut}>
            <button className="rounded-md border border-black/15 px-3 py-1.5 font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10">
              Se déconnecter
            </button>
          </form>
        </div>
      </header>

      <section className="mx-auto w-full max-w-3xl px-6 py-10">
        <div className="flex items-end justify-between">
          <h1 className="text-2xl font-semibold">Mes modules</h1>
          <span className="text-xs text-black/50 dark:text-white/50">
            Espace utilisé : {formatBytes(used)}
          </span>
        </div>

        <div className="mt-6">
          <UploadModule />
        </div>

        <div className="mt-8">
          {list.length === 0 ? (
            <div className="rounded-xl border border-dashed border-black/15 p-10 text-center text-sm text-black/50 dark:border-white/20 dark:text-white/50">
              Aucun module pour l’instant. Dépose ton premier SCORM ci-dessus.
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {list.map((m) => (
                <ModuleRow
                  key={m.id}
                  id={m.id}
                  title={m.title}
                  shareId={m.share_id}
                  scormVersion={m.scorm_version}
                  sizeLabel={formatBytes(Number(m.size_bytes ?? 0))}
                  createdLabel={new Date(m.created_at).toLocaleDateString("fr-FR")}
                />
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
