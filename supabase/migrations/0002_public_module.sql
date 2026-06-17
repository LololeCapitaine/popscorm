-- =====================================================================
-- Popscorm — étape 5 : lecture publique d'un module par share_id
-- À exécuter dans Supabase : SQL Editor > New query > coller > Run
-- =====================================================================

-- Fonction qui renvoie UN module à partir de son share_id public.
-- SECURITY DEFINER : contourne la RLS de façon contrôlée (ne renvoie que
-- les champs nécessaires, et uniquement pour le share_id fourni).
create or replace function public.get_public_module(p_share_id text)
returns table (
  id             uuid,
  title          text,
  scorm_version  text,
  entry_path     text,
  storage_prefix text
)
language sql
security definer
set search_path = public
stable
as $$
  select id, title, scorm_version, entry_path, storage_prefix
  from public.modules
  where share_id = p_share_id
  limit 1;
$$;

-- Autorise les visiteurs anonymes (et connectés) à appeler cette fonction.
grant execute on function public.get_public_module(text) to anon, authenticated;
