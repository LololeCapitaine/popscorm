"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Construit l'URL absolue du site (préfère la variable d'env, sinon l'en-tête). */
async function getSiteUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

function safeRedirectPath(value: FormDataEntryValue | null): string {
  const v = typeof value === "string" ? value : "";
  // N'autorise que les chemins internes (évite les redirections ouvertes).
  return v.startsWith("/") && !v.startsWith("//") ? v : "/dashboard";
}

/** Connexion par e-mail + mot de passe. */
export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = safeRedirectPath(formData.get("redirect"));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }
  redirect(next);
}

/** Création de compte par e-mail + mot de passe. */
export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = safeRedirectPath(formData.get("redirect"));
  const siteUrl = await getSiteUrl();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${siteUrl}/auth/callback` },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }
  // Si la confirmation e-mail est désactivée, une session existe déjà :
  // l'utilisateur est connecté, on l'envoie directement vers sa destination.
  if (data.session) {
    redirect(next);
  }
  // Sinon, un e-mail de confirmation a été envoyé.
  redirect("/login?message=verifie-tes-emails");
}

/** Connexion via Google OAuth. */
export async function signInWithGoogle(formData: FormData) {
  const next = safeRedirectPath(formData.get("redirect"));
  const siteUrl = await getSiteUrl();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }
  if (data?.url) {
    redirect(data.url);
  }
}

/** Déconnexion. */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
