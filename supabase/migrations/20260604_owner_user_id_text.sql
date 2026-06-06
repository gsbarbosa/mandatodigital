-- Firebase UID nao e UUID; alinha coluna com auth externa.
alter table if exists politician_profiles
  alter column owner_user_id type text using owner_user_id::text;
