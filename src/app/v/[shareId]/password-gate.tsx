"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/logo";
import { Icon } from "@/components/icon";

export function PasswordGate({
  shareId,
  title,
}: {
  shareId: string;
  title: string;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/modules/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareId, password }),
      });
      if (!res.ok) {
        setError("Mot de passe incorrect.");
        setLoading(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Une erreur est survenue.");
      setLoading(false);
    }
  }

  return (
    <main className="flex h-dvh flex-col items-center justify-center bg-gradient-to-b from-brand-50 to-cream px-6 font-sans">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center text-2xl font-bold tracking-tight">
          <Logo />
        </div>
        <form
          onSubmit={submit}
          className="rounded-2xl border border-cream-200 bg-white p-6 shadow-sm"
        >
          <div className="flex items-center gap-2 text-ink">
            <Icon name="lock" className="text-brand-500" />
            <h1 className="text-lg font-semibold">Module protégé</h1>
          </div>
          <p className="mt-1 text-sm text-taupe">
            « {title} » est protégé par un mot de passe.
          </p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe"
            autoFocus
            className="mt-4 w-full rounded-lg border border-cream-200 px-3 py-2 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
          {error && (
            <p className="mt-2 text-sm text-brand-700">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading || !password}
            className="mt-4 w-full rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-60"
          >
            {loading ? "Vérification…" : "Accéder au module"}
          </button>
        </form>
      </div>
    </main>
  );
}
