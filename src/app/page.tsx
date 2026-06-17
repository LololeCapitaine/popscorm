export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 bg-zinc-50 px-6 py-24 text-center font-sans dark:bg-black">
      <div className="flex flex-col items-center gap-4">
        <span className="rounded-full border border-black/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-black/60 dark:border-white/15 dark:text-white/60">
          Bientôt disponible
        </span>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Popscorm
        </h1>
        <p className="max-w-xl text-lg text-black/70 dark:text-white/70">
          Déposez un module SCORM et obtenez un lien web public pour le
          visionner — sans LMS, sans abonnement à un outil-auteur.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <span className="rounded-md bg-black px-5 py-2.5 text-sm font-medium text-white opacity-50 dark:bg-white dark:text-black">
          Commencer (à venir)
        </span>
        <span className="rounded-md border border-black/10 px-5 py-2.5 text-sm font-medium text-black/60 dark:border-white/15 dark:text-white/60">
          Tarifs (à venir)
        </span>
      </div>

      <p className="text-xs text-black/40 dark:text-white/40">
        Étape 1 / 8 — squelette Next.js en place. ✅
      </p>
    </main>
  );
}
