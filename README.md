# Popscorm

SaaS d'hébergement et de visualisation de modules SCORM. Déposez un paquet
SCORM (`.zip`) et obtenez un lien web public pour le visionner — sans LMS.

## Stack

- **Next.js** (App Router, TypeScript) — hébergé sur **Vercel**
- **Supabase** — authentification (e-mail + Google) et base Postgres
- **Cloudflare R2** — stockage des fichiers SCORM (pas de frais d'egress)
- **scorm-again** — runtime SCORM côté navigateur (mode sans persistance)

## Démarrage local

```bash
npm install
cp .env.example .env.local   # puis remplir les valeurs
npm run dev                  # http://localhost:3000
```

## Avancement (8 étapes)

1. ✅ Squelette Next.js + page d'accueil
2. ✅ Authentification Supabase (e-mail/mot de passe + Google) — vérifié en prod
3. ✅ Connexion Cloudflare R2 (testée : put/list/get/delete)
4. ✅ Pipeline SCORM (dézippage navigateur + manifest + upload R2 + base)
5. ✅ Lecteur public `/v/{shareId}` avec scorm-again (1.2 + 2004, sans persistance)
6. ⬜ Quotas de stockage par utilisateur
7. ⬜ Page d'accueil + page de tarifs (placeholder)
8. ⬜ Finitions (design, erreurs, messages)

## Variables d'environnement

Voir [`.env.example`](./.env.example). Les secrets vont dans `.env.local`
(jamais committé) en local, et dans les variables d'environnement Vercel en
production.
