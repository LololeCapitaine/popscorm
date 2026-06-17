import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 px-6 py-24 text-center font-sans dark:bg-black">
      <p className="text-5xl font-bold">404</p>
      <h1 className="text-xl font-semibold">Page introuvable</h1>
      <p className="max-w-md text-sm text-black/60 dark:text-white/60">
        Cette page n’existe pas ou a été déplacée.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-md bg-black px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 dark:bg-white dark:text-black"
      >
        Retour à l’accueil
      </Link>
    </main>
  );
}
