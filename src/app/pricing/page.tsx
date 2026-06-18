import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { Logo } from "@/components/logo";

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
    <div className="flex min-h-dvh flex-col bg-cream font-sans">
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
              className={`relative flex flex-col rounded-2xl border p-6 ${
                plan.highlight
                  ? "border-brand-500 bg-white shadow-sm ring-1 ring-brand-200 dark:bg-zinc-950 dark:ring-brand-900/40"
                  : "border-black/10 bg-white dark:border-white/15 dark:bg-zinc-950"
              }`}
            >
              {plan.highlight && (
                <span className="absolute -top-2.5 left-6 rounded-full bg-brand-600 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  Disponible
                </span>
              )}
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
                  className="mt-6 rounded-lg bg-brand-600 px-4 py-2.5 text-center text-sm font-medium text-white transition hover:bg-brand-700"
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
        <Logo /> — hébergement et visualisation de modules SCORM.
      </footer>
    </div>
  );
}
