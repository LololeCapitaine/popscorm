import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Tarifs — Popscorm",
};

const PLANS = [
  {
    name: "Gratuit",
    price: "0 €",
    period: "",
    highlight: true,
    features: ["100 Mo de stockage", "Modules illimités", "Liens publics"],
    cta: "Commencer",
    href: "/login",
    available: true,
  },
  {
    name: "Pro",
    price: "Bientôt",
    period: "",
    highlight: false,
    features: ["Plus de stockage", "Statistiques", "Personnalisation du lien"],
    cta: "Bientôt disponible",
    href: "/pricing",
    available: false,
  },
];

export default function PricingPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-zinc-50 font-sans dark:bg-black">
      <SiteHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <h1 className="text-center text-3xl font-bold tracking-tight">Tarifs</h1>
        <p className="mt-3 text-center text-black/60 dark:text-white/60">
          Le paiement en ligne n’est pas encore disponible. L’offre gratuite est
          ouverte dès maintenant.
        </p>

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`flex flex-col rounded-2xl border p-6 ${
                plan.highlight
                  ? "border-black bg-white dark:border-white dark:bg-zinc-950"
                  : "border-black/10 bg-white dark:border-white/15 dark:bg-zinc-950"
              }`}
            >
              <h2 className="text-lg font-semibold">{plan.name}</h2>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-bold">{plan.price}</span>
                {plan.period && (
                  <span className="text-sm text-black/50 dark:text-white/50">
                    {plan.period}
                  </span>
                )}
              </div>
              <ul className="mt-6 flex flex-1 flex-col gap-2 text-sm text-black/70 dark:text-white/70">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <span aria-hidden>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              {plan.available ? (
                <Link
                  href={plan.href}
                  className="mt-6 rounded-md bg-black px-4 py-2.5 text-center text-sm font-medium text-white hover:opacity-90 dark:bg-white dark:text-black"
                >
                  {plan.cta}
                </Link>
              ) : (
                <span className="mt-6 cursor-not-allowed rounded-md border border-black/15 px-4 py-2.5 text-center text-sm font-medium text-black/40 dark:border-white/20 dark:text-white/40">
                  {plan.cta}
                </span>
              )}
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-black/10 px-6 py-6 text-center text-xs text-black/40 dark:border-white/15 dark:text-white/40">
        Popscorm — hébergement et visualisation de modules SCORM.
      </footer>
    </div>
  );
}
