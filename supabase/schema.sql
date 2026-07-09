create extension if not exists pgcrypto;

create table if not exists politician_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text unique,
  full_name text not null,
  role text not null,
  city text not null,
  state text not null,
  audience text not null,
  spectrum text not null,
  archetype text not null,
  voice_tones text[] not null default '{}',
  key_issues text[] not null default '{}',
  slogans text[] not null default '{}',
  red_lines text[] not null default '{}',
  reference_examples text[] not null default '{}',
  bio text not null,
  updated_at timestamptz not null default now()
);

create table if not exists content_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid null references politician_profiles(id) on delete cascade,
  topic text not null,
  objective text not null,
  format text not null,
  intensity text not null,
  context text not null default '',
  key_facts text[] not null default '{}',
  desired_call_to_action text not null default '',
  mandatory_terms text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table if exists content_requests
  add column if not exists mandatory_terms text[] not null default '{}';

create table if not exists generated_contents (
  id uuid primary key default gen_random_uuid(),
  content_request_id uuid not null references content_requests(id) on delete cascade,
  title text not null,
  angle text not null,
  body text not null,
  status text not null default 'rascunho',
  prompt_preview text not null,
  provider text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists content_feedback (
  id uuid primary key default gen_random_uuid(),
  generated_content_id uuid not null references generated_contents(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now()
);

create table if not exists product_feedback (
  id uuid primary key default gen_random_uuid(),
  screen text not null default '',
  worked_well text not null default '',
  issue_observed text not null,
  classification text not null,
  criticality text not null default 'media',
  rationale text not null,
  scope_assessment text not null,
  suggested_action text not null,
  implementation_prompt text not null default '',
  provider text not null,
  created_at timestamptz not null default now()
);

create table if not exists mandate_workflow_configs (
  profile_id uuid primary key references politician_profiles(id) on delete cascade,
  persona_archetypes text[] not null default '{}',
  sentinel_themes text[] not null default '{}',
  sentinel_themes_federal text[] not null default '{}',
  sentinel_themes_estadual text[] not null default '{}',
  opposition_themes text[] not null default '{}',
  custom_radar_themes text[] not null default '{}',
  interest_profiles jsonb not null default '[]'::jsonb,
  interest_sites text[] not null default '{}',
  opposition_profiles jsonb not null default '[]'::jsonb,
  opposition_sites text[] not null default '{}',
  glossary_terms text[] not null default '{}',
  training_reference_links text[] not null default '{}',
  youtube_video_url text not null default '',
  avatar_type text not null default '',
  avatar_video_topic text not null default '',
  argil_avatar_id text not null default '',
  argil_voice_id text not null default '',
  avatar_training_status text not null default '',
  notification_email text not null default '',
  avatar_emotions text[] not null default '{}',
  voice_pace text not null default 'Manter velocidade original',
  editing_styles text[] not null default '{}',
  fact_checking_sources text[] not null default '{}',
  hard_data_sources text[] not null default '{}',
  distribution_channels text[] not null default '{}',
  distribution_windows text[] not null default '{}',
  auto_publish boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Limite por bucket: 150 MB (ajuste no Dashboard se o plano permitir mais).
-- O limite global do projeto (Storage → Settings) deve ser >= ao do bucket.
insert into storage.buckets (id, name, public, file_size_limit)
values ('persona-training-videos', 'persona-training-videos', false, 157286400)
on conflict (id) do update
set file_size_limit = excluded.file_size_limit;

create table if not exists profile_training_assets (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid null references politician_profiles(id) on delete set null,
  draft_profile_id uuid null,
  source_type text not null default 'upload',
  training_role text not null default 'dataset',
  storage_provider text not null default 'local',
  storage_bucket text null,
  storage_path text not null,
  original_filename text not null,
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null default 0,
  status text not null default 'uploaded',
  error_message text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (profile_id is not null or draft_profile_id is not null)
);

alter table if exists profile_training_assets
  add column if not exists draft_profile_id uuid null;

alter table if exists profile_training_assets
  add column if not exists source_type text not null default 'upload';

alter table if exists profile_training_assets
  add column if not exists training_role text not null default 'dataset';

alter table if exists profile_training_assets
  add column if not exists storage_provider text not null default 'local';

alter table if exists profile_training_assets
  add column if not exists storage_bucket text null;

alter table if exists profile_training_assets
  add column if not exists storage_path text;

alter table if exists profile_training_assets
  add column if not exists original_filename text;

alter table if exists profile_training_assets
  add column if not exists mime_type text not null default 'application/octet-stream';

alter table if exists profile_training_assets
  add column if not exists size_bytes bigint not null default 0;

alter table if exists profile_training_assets
  add column if not exists status text not null default 'uploaded';

alter table if exists profile_training_assets
  add column if not exists error_message text not null default '';

alter table if exists profile_training_assets
  add column if not exists created_at timestamptz not null default now();

alter table if exists profile_training_assets
  add column if not exists updated_at timestamptz not null default now();

create table if not exists profile_avatar_trainings (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid null references politician_profiles(id) on delete set null,
  draft_profile_id uuid null,
  argil_avatar_id text null,
  argil_voice_id text null,
  status text not null default 'TRAINING',
  dry_run boolean not null default false,
  dataset_asset_id uuid null,
  consent_asset_id uuid null,
  voice_audio_asset_id uuid null,
  avatar_name text not null default '',
  error_message text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (profile_id is not null or draft_profile_id is not null)
);

create table if not exists avatar_video_generations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid null references politician_profiles(id) on delete set null,
  topic text not null,
  transcript text not null,
  name text not null,
  argil_video_id text null,
  status text not null default 'IDLE',
  dry_run boolean not null default false,
  preview_url text not null default '',
  video_url text not null default '',
  video_url_subtitled text not null default '',
  error_message text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists mandate_workflow_configs
  add column if not exists sentinel_themes_federal text[] not null default '{}';

alter table if exists mandate_workflow_configs
  add column if not exists sentinel_themes_estadual text[] not null default '{}';

alter table if exists mandate_workflow_configs
  add column if not exists persona_archetypes text[] not null default '{}';

alter table if exists mandate_workflow_configs
  add column if not exists youtube_video_url text not null default '';

alter table if exists mandate_workflow_configs
  add column if not exists avatar_type text not null default '';

alter table if exists mandate_workflow_configs
  add column if not exists avatar_video_topic text not null default '';

alter table if exists mandate_workflow_configs
  add column if not exists argil_avatar_id text not null default '';

alter table if exists mandate_workflow_configs
  add column if not exists argil_voice_id text not null default '';

alter table if exists mandate_workflow_configs
  add column if not exists avatar_training_status text not null default '';

alter table if exists mandate_workflow_configs
  add column if not exists notification_email text not null default '';

alter table if exists profile_avatar_trainings
  add column if not exists voice_audio_asset_id uuid null;

alter table if exists politician_profiles
  add column if not exists owner_user_id text unique;

alter table if exists content_requests
  add column if not exists profile_id uuid null references politician_profiles(id) on delete cascade;

create index if not exists politician_profiles_owner_user_id_idx
  on politician_profiles(owner_user_id);

create index if not exists content_requests_profile_id_idx
  on content_requests(profile_id);

alter table if exists product_feedback
  add column if not exists criticality text not null default 'media';

alter table if exists product_feedback
  add column if not exists implementation_prompt text not null default '';

create table if not exists evaluation_runs (
  id uuid primary key default gen_random_uuid(),
  content_request_id uuid references content_requests(id) on delete set null,
  profile_id uuid references politician_profiles(id) on delete set null,
  mode text not null default 'shadow',
  status text not null default 'pending',
  primary_provider text not null default '',
  primary_model text not null default '',
  judge_provider text not null default '',
  judge_model text not null default '',
  winner_candidate_id uuid null,
  winner_recommendation text not null default '',
  judge_summary text not null default '',
  error_message text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists evaluation_candidates (
  id uuid primary key default gen_random_uuid(),
  evaluation_run_id uuid not null references evaluation_runs(id) on delete cascade,
  content_request_id uuid references content_requests(id) on delete set null,
  generated_content_ids uuid[] not null default '{}',
  role text not null,
  provider text not null,
  model text not null default '',
  prompt_version text not null,
  template_id text not null,
  latency_ms integer not null default 0,
  prompt_preview text not null,
  raw_response text not null default '',
  token_usage jsonb null,
  output_variants jsonb not null default '[]'::jsonb,
  status text not null default 'completed',
  created_at timestamptz not null default now()
);

create table if not exists evaluation_scores (
  id uuid primary key default gen_random_uuid(),
  evaluation_run_id uuid not null references evaluation_runs(id) on delete cascade,
  candidate_id uuid not null references evaluation_candidates(id) on delete cascade,
  criterion text not null,
  score numeric(4, 2) not null,
  rationale text not null,
  verdict text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists generated_contents_request_id_idx
  on generated_contents(content_request_id);

create index if not exists content_feedback_generated_content_id_idx
  on content_feedback(generated_content_id);

create index if not exists product_feedback_created_at_idx
  on product_feedback(created_at desc);

create index if not exists mandate_workflow_configs_updated_at_idx
  on mandate_workflow_configs(updated_at desc);

create index if not exists profile_training_assets_profile_id_idx
  on profile_training_assets(profile_id);

create index if not exists profile_training_assets_draft_profile_id_idx
  on profile_training_assets(draft_profile_id);

create index if not exists profile_training_assets_created_at_idx
  on profile_training_assets(created_at desc);

create index if not exists profile_avatar_trainings_profile_id_idx
  on profile_avatar_trainings(profile_id);

create index if not exists profile_avatar_trainings_draft_profile_id_idx
  on profile_avatar_trainings(draft_profile_id);

create index if not exists profile_avatar_trainings_argil_avatar_id_idx
  on profile_avatar_trainings(argil_avatar_id);

create index if not exists profile_avatar_trainings_created_at_idx
  on profile_avatar_trainings(created_at desc);

create index if not exists avatar_video_generations_profile_id_idx
  on avatar_video_generations(profile_id);

create index if not exists avatar_video_generations_argil_video_id_idx
  on avatar_video_generations(argil_video_id);

create index if not exists avatar_video_generations_created_at_idx
  on avatar_video_generations(created_at desc);

create table if not exists creative_projects (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid null references politician_profiles(id) on delete cascade,
  topic text not null default '',
  persona_archetypes text[] not null default '{}',
  voice_tones text[] not null default '{}',
  script_draft text not null default '',
  script_approved boolean not null default false,
  free_prompt text not null default '',
  use_free_prompt boolean not null default false,
  avatar_track text not null default 'realistic',
  caricature_asset_id text not null default '',
  heygen_video_id text null,
  video_url text not null default '',
  caption_url text not null default '',
  status text not null default 'draft',
  error_message text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creative_projects_profile_id_idx
  on creative_projects(profile_id);

create index if not exists creative_projects_created_at_idx
  on creative_projects(created_at desc);

create index if not exists evaluation_runs_created_at_idx
  on evaluation_runs(created_at desc);

create index if not exists evaluation_candidates_run_id_idx
  on evaluation_candidates(evaluation_run_id);

create index if not exists evaluation_scores_run_id_idx
  on evaluation_scores(evaluation_run_id);

create unique index if not exists evaluation_scores_unique_idx
  on evaluation_scores(evaluation_run_id, candidate_id, criterion);

-- Cache global Sentinela: veredito LLM artigo x tema (compartilhado entre perfis).
create table if not exists sentinel_article_theme_verdicts (
  id uuid primary key default gen_random_uuid(),
  article_fingerprint text not null,
  article_title text not null default '',
  article_url text not null default '',
  article_source text not null default '',
  theme_canonical text not null,
  theme_label text not null default '',
  approved boolean not null,
  confidence numeric(5, 4) not null default 0,
  rationale text not null default '',
  model_version text not null default '1',
  verified_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (article_fingerprint, theme_canonical, model_version)
);

create index if not exists sentinel_article_theme_verdicts_lookup_idx
  on sentinel_article_theme_verdicts (article_fingerprint, theme_canonical, model_version);

create index if not exists sentinel_article_theme_verdicts_expires_idx
  on sentinel_article_theme_verdicts (expires_at);

create index if not exists sentinel_article_theme_verdicts_theme_idx
  on sentinel_article_theme_verdicts (theme_canonical, verified_at desc);

