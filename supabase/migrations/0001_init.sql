-- =====================================================================
-- Popscorm — schéma initial (étape 4)
-- À exécuter dans Supabase : Dashboard > SQL Editor > New query > coller > Run
-- =====================================================================

-- 1) Table des profils (1 ligne par utilisateur) -----------------------
create table if not exists public.profiles (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  plan               text   not null default 'free',
  storage_used_bytes bigint not null default 0,
  created_at         timestamptz not null default now()
);

-- 2) Table des modules SCORM -------------------------------------------
create table if not exists public.modules (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid   not null references auth.users (id) on delete cascade,
  title          text   not null,
  scorm_version  text   not null check (scorm_version in ('1.2', '2004')),
  entry_path     text   not null,                    -- fichier de lancement
  size_bytes     bigint not null default 0,
  storage_prefix text   not null,                    -- préfixe R2 (users/.../modules/...)
  share_id       text   not null unique,             -- jeton public non devinable
  created_at     timestamptz not null default now()
);

create index if not exists modules_user_id_idx on public.modules (user_id);

-- 3) Row Level Security : chacun ne voit/gère que ses données -----------
alter table public.profiles enable row level security;
alter table public.modules  enable row level security;

-- Profils : l'utilisateur accède uniquement à sa propre ligne
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = user_id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Modules : l'utilisateur gère uniquement ses propres modules.
-- (La lecture publique via share_id se fera côté serveur avec la clé
--  service_role à l'étape 5 — pas de politique de lecture anonyme ici.)
drop policy if exists modules_select_own on public.modules;
create policy modules_select_own on public.modules
  for select using (auth.uid() = user_id);

drop policy if exists modules_insert_own on public.modules;
create policy modules_insert_own on public.modules
  for insert with check (auth.uid() = user_id);

drop policy if exists modules_update_own on public.modules;
create policy modules_update_own on public.modules
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists modules_delete_own on public.modules;
create policy modules_delete_own on public.modules
  for delete using (auth.uid() = user_id);

-- 4) Création automatique du profil à l'inscription --------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5) Rattrapage : créer les profils des comptes déjà existants ----------
insert into public.profiles (user_id)
select id from auth.users
on conflict (user_id) do nothing;
