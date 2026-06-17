import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/logo";

export async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-black/10 bg-white/80 px-6 py-4 backdrop-blur-md dark:border-white/15 dark:bg-black/70">
      <Link href="/" className="text-lg font-bold tracking-tight">
        <Logo />
      </Link>
      <nav className="flex items-center gap-2 text-sm sm:gap-4">
        <Link
          href="/pricing"
          className="rounded-lg px-3 py-1.5 font-medium text-black/70 transition hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/10"
        >
          Tarifs
        </Link>
        {user ? (
          <Link
            href="/dashboard"
            className="rounded-lg bg-brand-600 px-4 py-1.5 font-medium text-white transition hover:bg-brand-700"
          >
            Tableau de bord
          </Link>
        ) : (
          <Link
            href="/login"
            className="rounded-lg bg-brand-600 px-4 py-1.5 font-medium text-white transition hover:bg-brand-700"
          >
            Se connecter
          </Link>
        )}
      </nav>
    </header>
  );
}
