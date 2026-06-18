-- =====================================================================
-- Popscorm — étape dashboard 2/4 : statut + mot de passe + outil
-- À exécuter dans Supabase : SQL Editor > New query > coller > Run
-- =====================================================================

-- 1) Nouvelles colonnes sur modules
alter table public.modules
  add column if not exists status     text not null default 'public',
  add column if not exists password   text,
  add column if not exists tool       text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.modules drop constraint if exists modules_status_check;
alter table public.modules add constraint modules_status_check
  check (status in ('public', 'private', 'inactive'));

-- 2) get_public_module : on ajoute le statut au retour.
--    (drop + recreate car la signature de retour change)
drop function if exists public.get_public_module(text);
create function public.get_public_module(p_share_id text)
returns table (
  id             uuid,
  title          text,
  scorm_version  text,
  entry_path     text,
  storage_prefix text,
  status         text
)
language sql
security definer
set search_path = public
stable
as $$
  select id, title, scorm_version, entry_path, storage_prefix, status
  from public.modules
  where share_id = p_share_id
  limit 1;
$$;
grant execute on function public.get_public_module(text) to anon, authenticated;

-- 3) Vérification du mot de passe SANS jamais exposer le mot de passe.
create or replace function public.check_module_password(
  p_share_id text,
  p_password text
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.modules
    where share_id = p_share_id
      and status = 'private'
      and password = p_password
  );
$$;
grant execute on function public.check_module_password(text, text) to anon, authenticated;
