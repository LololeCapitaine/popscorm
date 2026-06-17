import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Double sécurité : le proxy protège déjà /dashboard, mais on revérifie ici.
  if (!user) {
    redirect("/login?redirect=/dashboard");
  }

  return (
    <main className="flex flex-1 flex-col bg-zinc-50 font-sans dark:bg-black">
      <header className="flex items-center justify-between border-b border-black/10 px-6 py-4 dark:border-white/15">
        <span className="text-lg font-bold tracking-tight">Popscorm</span>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-black/60 dark:text-white/60">{user.email}</span>
          <form action={signOut}>
            <button className="rounded-md border border-black/15 px-3 py-1.5 font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10">
              Se déconnecter
            </button>
          </form>
        </div>
      </header>

      <section className="mx-auto w-full max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-semibold">Mes modules</h1>
        <p className="mt-2 text-sm text-black/60 dark:text-white/60">
          Bientôt : dépôt de modules SCORM, liste, suppression et lien de
          partage. (Étape 4)
        </p>

        <div className="mt-8 rounded-xl border border-dashed border-black/15 p-10 text-center text-sm text-black/50 dark:border-white/20 dark:text-white/50">
          Aucun module pour l’instant.
        </div>
      </section>
    </main>
  );
}
