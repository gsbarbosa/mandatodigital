-- Credenciais de integracao (admin) — valores criptografados no servidor.

create table if not exists platform_credentials (
  service_id text primary key,
  ciphertext text not null,
  iv text not null,
  auth_tag text not null,
  masked_hint text not null default '',
  updated_by_email text not null default '',
  updated_at timestamptz not null default now(),
  last_tested_at timestamptz null,
  last_test_status text not null default '',
  last_test_message text not null default ''
);

create index if not exists platform_credentials_updated_at_idx
  on platform_credentials(updated_at desc);
