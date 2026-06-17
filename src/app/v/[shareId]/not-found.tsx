import Link from "next/link";

export default function ModuleNotFound() {
  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-4 bg-zinc-50 px-6 text-center font-sans dark:bg-black">
      <h1 className="text-xl font-semibold">Module introuvable</h1>
      <p className="max-w-md text-sm text-black/60 dark:text-white/60">
        Ce lien de partage est invalide, ou le module a été supprimé par son
        auteur.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700"
      >
        Découvrir Popscorm
      </Link>
    </main>
  );
}
