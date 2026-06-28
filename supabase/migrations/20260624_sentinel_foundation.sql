-- Fase 0 Sentinela: cache persistido, historico de sinais e expansoes semanticas (Fase 1).

create table if not exists sentinel_suggestion_cache (
  profile_id uuid primary key references politician_profiles(id) on delete cascade,
  owner_user_id text not null default '',
  suggestions jsonb not null default '[]'::jsonb,
  meta jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  refreshed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sentinel_suggestion_cache_owner_user_id_idx
  on sentinel_suggestion_cache(owner_user_id);

create table if not exists sentinel_signals (
  id uuid primary key default gen_random_uuid(),
  signal_id text not null,
  profile_id uuid not null references politician_profiles(id) on delete cascade,
  owner_user_id text not null default '',
  pipeline text not null default 'legacy',
  theme_label text not null default '',
  relevance_score integer not null default 0,
  payload jsonb not null,
  scanned_at timestamptz not null default now()
);

create index if not exists sentinel_signals_profile_scanned_idx
  on sentinel_signals(profile_id, scanned_at desc);

create index if not exists sentinel_signals_profile_signal_id_idx
  on sentinel_signals(profile_id, signal_id);

create table if not exists sentinel_theme_expansions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references politician_profiles(id) on delete cascade,
  owner_user_id text not null default '',
  source_theme text not null,
  expanded_terms text[] not null default '{}',
  generated_at timestamptz not null default now(),
  unique (profile_id, source_theme)
);

create index if not exists sentinel_theme_expansions_profile_id_idx
  on sentinel_theme_expansions(profile_id);
