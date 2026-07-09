-- Cache global: veredito LLM (artigo x tema) compartilhado entre perfis.

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
