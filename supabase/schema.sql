create extension if not exists pgcrypto;

create table if not exists politician_profiles (
  id uuid primary key default gen_random_uuid(),
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
  topic text not null,
  objective text not null,
  format text not null,
  intensity text not null,
  context text not null default '',
  key_facts text[] not null default '{}',
  desired_call_to_action text not null default '',
  created_at timestamptz not null default now()
);

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

alter table if exists product_feedback
  add column if not exists criticality text not null default 'media';

alter table if exists product_feedback
  add column if not exists implementation_prompt text not null default '';

create index if not exists generated_contents_request_id_idx
  on generated_contents(content_request_id);

create index if not exists content_feedback_generated_content_id_idx
  on content_feedback(generated_content_id);

create index if not exists product_feedback_created_at_idx
  on product_feedback(created_at desc);
