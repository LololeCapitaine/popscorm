import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="flex items-center justify-between border-b border-black/10 px-6 py-4 dark:border-white/15">
      <Link href="/" className="text-lg font-bold tracking-tight">
        Popscorm
      </Link>
      <nav className="flex items-center gap-2 text-sm sm:gap-4">
        <Link
          href="/pricing"
          className="rounded-md px-3 py-1.5 font-medium text-black/70 hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/10"
        >
          Tarifs
        </Link>
        {user ? (
          <Link
            href="/dashboard"
            className="rounded-md bg-black px-4 py-1.5 font-medium text-white hover:opacity-90 dark:bg-white dark:text-black"
          >
            Tableau de bord
          </Link>
        ) : (
          <Link
            href="/login"
            className="rounded-md bg-black px-4 py-1.5 font-medium text-white hover:opacity-90 dark:bg-white dark:text-black"
          >
            Se connecter
          </Link>
        )}
      </nav>
    </header>
  );
}
