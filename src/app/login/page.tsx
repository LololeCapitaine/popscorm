import Link from "next/link";
import { signIn, signUp, signInWithGoogle } from "./actions";
import { Logo } from "@/components/logo";
import { GoogleIcon } from "@/components/google-icon";

export default async function LoginPage(props: PageProps<"/login">) {
  const params = await props.searchParams;
  const error = typeof params.error === "string" ? params.error : null;
  const message = typeof params.message === "string" ? params.message : null;
  const redirectTo =
    typeof params.redirect === "string" ? params.redirect : "/dashboard";

  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center bg-gradient-to-b from-brand-50 to-zinc-50 px-6 py-16 font-sans dark:from-zinc-950 dark:to-black">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="mb-8 block text-center text-2xl font-bold tracking-tight"
        >
          <Logo />
        </Link>

        <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/15 dark:bg-zinc-950">
          <h1 className="text-lg font-semibold">Connexion</h1>
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">
            Connecte-toi ou crée un compte pour héberger tes modules.
          </p>

          {message === "verifie-tes-emails" && (
            <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              Compte créé. Vérifie tes e-mails pour confirmer ton adresse.
            </p>
          )}
          {error && (
            <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {error}
            </p>
          )}

          <form className="mt-5 flex flex-col gap-3">
            <input type="hidden" name="redirect" value={redirectTo} />
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">E-mail</span>
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                className="rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:border-white/20 dark:focus:border-brand-400 dark:focus:ring-brand-900/40"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Mot de passe</span>
              <input
                type="password"
                name="password"
                required
                minLength={6}
                autoComplete="current-password"
                className="rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:border-white/20 dark:focus:border-brand-400 dark:focus:ring-brand-900/40"
              />
            </label>

            <div className="mt-1 flex gap-2">
              <button
                formAction={signUp}
                className="flex-1 rounded-lg border border-black/15 px-4 py-2 text-sm font-medium transition hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
              >
                Créer un compte
              </button>
              <button
                formAction={signIn}
                className="flex-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
              >
                Se connecter
              </button>
            </div>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-black/40 dark:text-white/40">
            <span className="h-px flex-1 bg-black/10 dark:bg-white/15" />
            ou
            <span className="h-px flex-1 bg-black/10 dark:bg-white/15" />
          </div>

          <form action={signInWithGoogle}>
            <input type="hidden" name="redirect" value={redirectTo} />
            <button className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-black/15 bg-white px-4 py-2 text-sm font-medium text-black/80 transition hover:bg-black/[0.03] dark:border-white/20 dark:bg-transparent dark:text-white/90 dark:hover:bg-white/10">
              <GoogleIcon className="h-[18px] w-[18px]" />
              Se connecter avec Google
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
