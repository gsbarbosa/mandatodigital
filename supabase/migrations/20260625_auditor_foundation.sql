-- Fase 2 Validador: fact-check, audit log e metadados TSE em creative_projects.

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text not null default '',
  profile_id uuid null references politician_profiles(id) on delete set null,
  project_id uuid null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  consent_text_version text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists audit_log_owner_user_id_idx on audit_log(owner_user_id);
create index if not exists audit_log_profile_id_idx on audit_log(profile_id);

create table if not exists sentinel_fact_checks (
  signal_id text not null,
  profile_id uuid not null references politician_profiles(id) on delete cascade,
  owner_user_id text not null default '',
  status text not null default 'pending',
  verdict text not null default '',
  confidence integer not null default 0,
  result jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now(),
  primary key (profile_id, signal_id)
);

create index if not exists sentinel_fact_checks_profile_status_idx
  on sentinel_fact_checks(profile_id, status);

alter table creative_projects
  add column if not exists metadata jsonb not null default '{}'::jsonb;
