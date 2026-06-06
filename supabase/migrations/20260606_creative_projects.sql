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
