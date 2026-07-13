-- Aceites de contrato com trilha de auditoria (IP, UA, hashes, PDFs).

create table if not exists contract_acceptances (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text not null default '',
  campaign_name text not null,
  campaign_cnpj text not null,
  campaign_address text not null default '',
  financial_responsible text not null default '',
  email text not null default '',
  plan_id text not null default '',
  amount_cents integer not null default 0,
  natureza_juridica text not null default '',
  ip text not null default '',
  user_agent text not null default '',
  accepted_at timestamptz not null default now(),
  contract_text_hash text not null,
  dossier_text_hash text not null,
  contract_template_version text not null default '',
  dossier_template_version text not null default '',
  contract_pdf_path text not null default '',
  dossier_pdf_path text not null default '',
  email_sent boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists contract_acceptances_owner_user_id_idx
  on contract_acceptances(owner_user_id);

create index if not exists contract_acceptances_campaign_cnpj_idx
  on contract_acceptances(campaign_cnpj);
