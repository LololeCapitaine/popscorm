import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";
import { Logo } from "@/components/logo";

const STEPS = [
  {
    n: "1",
    title: "Déposez votre SCORM",
    desc: "Glissez votre fichier .zip exporté depuis Rise, Storyline, Genially ou tout autre outil-auteur.",
  },
  {
    n: "2",
    title: "Obtenez un lien",
    desc: "Popscorm lit le module, l'héberge et génère un lien web public, prêt à partager.",
  },
  {
    n: "3",
    title: "Partagez",
    desc: "Vos apprenants ouvrent le lien et lancent le module dans leur navigateur. Aucun LMS requis.",
  },
];

const FEATURES = [
  {
    title: "Sans LMS",
    desc: "Plus besoin d'une plateforme lourde pour diffuser un simple module.",
  },
  {
    title: "Indépendant de l'outil-auteur",
    desc: "Vos modules restent accessibles, même sans abonnement à Rise ou Storyline.",
  },
  {
    title: "Un lien permanent",
    desc: "Un lien stable et non devinable, que vous contrôlez et pouvez supprimer.",
  },
];

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const ctaHref = user ? "/dashboard" : "/login";

  return (
    <div className="flex min-h-dvh flex-col bg-cream font-sans">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 to-transparent dark:from-brand-900/15">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 py-20 text-center sm:py-28">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-medium text-brand-700 dark:border-brand-900/60 dark:bg-brand-950/40 dark:text-brand-300">
              🍿 Hébergement SCORM sans LMS
            </span>
            <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
              Hébergez et partagez vos modules SCORM,{" "}
              <span className="text-brand-500">sans LMS.</span>
            </h1>
          <p className="max-w-xl text-lg text-black/70 dark:text-white/70">
            Déposez un module SCORM et obtenez un lien web public pour le
            visionner — sans plateforme, sans dépendre d’un outil-auteur ni d’un
            abonnement.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href={ctaHref}
              className="rounded-lg bg-brand-600 px-6 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700"
            >
              {user ? "Aller au tableau de bord" : "Commencer gratuitement"}
            </Link>
            <Link
              href="/pricing"
              className="rounded-lg border border-black/15 px-6 py-3 text-sm font-medium transition hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
            >
              Voir les tarifs
            </Link>
            </div>
          </div>
        </section>

        {/* Comment ça marche */}
        <section className="mx-auto max-w-4xl px-6 py-12">
          <h2 className="text-center text-2xl font-semibold">
            Comment ça marche
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div
                key={s.n}
                className="rounded-xl border border-black/10 bg-white p-6 dark:border-white/15 dark:bg-zinc-950"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
                  {s.n}
                </span>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-black/60 dark:text-white/60">
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Pourquoi Popscorm */}
        <section className="mx-auto max-w-4xl px-6 py-12">
          <div className="grid gap-6 sm:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title}>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-black/60 dark:text-white/60">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA bas de page */}
        <section className="mx-auto max-w-3xl px-6 py-16 text-center">
          <h2 className="text-2xl font-semibold">Prêt à partager un module ?</h2>
          <p className="mt-2 text-black/60 dark:text-white/60">
            Créez un compte gratuit et déposez votre premier SCORM en quelques
            secondes.
          </p>
          <Link
            href={ctaHref}
            className="mt-6 inline-block rounded-md bg-black px-6 py-3 text-sm font-medium text-white hover:opacity-90 dark:bg-white dark:text-black"
          >
            {user ? "Aller au tableau de bord" : "Commencer gratuitement"}
          </Link>
        </section>
      </main>

      <footer className="border-t border-black/10 px-6 py-6 text-center text-xs text-black/40 dark:border-white/15 dark:text-white/40">
        <Logo /> — hébergement et visualisation de modules SCORM.
      </footer>
    </div>
  );
}
