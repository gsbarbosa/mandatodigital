/** Ambientes serverless (Firebase App Hosting / Cloud Run / Lambda) não tem disco gravavel em `data/`. */
export function isServerlessRuntime() {
  return Boolean(
    process.env.K_SERVICE ||
      process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.LAMBDA_TASK_ROOT,
  );
}

export function canUseLocalFilesystem() {
  return !isServerlessRuntime();
}

export const SUPABASE_REQUIRED_IN_PRODUCTION_MESSAGE =
  "Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente de producao (ex.: Firebase App Hosting). " +
  "O armazenamento local em data/ não funciona em serverless.";

export function formatSupabaseQueryError(error: unknown): string | null {
  const details =
    error && typeof error === "object" && "message" in error
      ? String(error.message)
      : "";
  const code =
    error && typeof error === "object" && "code" in error ? String(error.code) : "";
  const normalized = `${code} ${details}`.toLowerCase();

  if (
    code === "22P02" &&
    (normalized.includes("uuid") || normalized.includes("owner_user_id"))
  ) {
    return (
      "O banco ainda trata owner_user_id como UUID, mas o login Firebase usa outro formato de ID. " +
      "No Supabase (SQL Editor), execute: " +
      "alter table politician_profiles alter column owner_user_id type text using owner_user_id::text;"
    );
  }

  return null;
}

function formatMissingTableHint(error: unknown) {
  const details =
    error && typeof error === "object" && "message" in error
      ? String(error.message)
      : "";
  const normalized = details.toLowerCase();

  if (normalized.includes("creative_projects")) {
    return (
      "Falta a tabela creative_projects no Supabase. " +
      "No SQL Editor, execute o arquivo supabase/migrations/20260606_creative_projects.sql " +
      "(ou rode: npm run db:migrate:creative-projects). " +
      "Detalhe: PGRST205 — Could not find the table 'public.creative_projects' in the schema cache"
    );
  }

  if (
    normalized.includes("sentinel_suggestion_cache") ||
    normalized.includes("sentinel_signals") ||
    normalized.includes("sentinel_theme_expansions")
  ) {
    return (
      "Faltam tabelas do Sentinela no Supabase. " +
      "No SQL Editor, execute supabase/migrations/20260624_sentinel_foundation.sql " +
      "(ou rode: npm run db:migrate:sentinel-foundation)."
    );
  }

  if (normalized.includes("platform_credentials")) {
    return (
      "Falta a tabela platform_credentials no Supabase. " +
      "No SQL Editor, execute supabase/migrations/20260630_platform_credentials.sql " +
      "(ou rode: npm run db:migrate:platform-credentials)."
    );
  }

  if (
    normalized.includes("audit_log") ||
    normalized.includes("sentinel_fact_checks")
  ) {
    return (
      "Faltam tabelas do Validador no Supabase. " +
      "No SQL Editor, execute supabase/migrations/20260625_auditor_foundation.sql " +
      "(ou rode: npm run db:migrate:auditor-foundation)."
    );
  }

  return null;
}

export function supabaseSchemaOutdatedMessage(error: unknown) {
  const specific = formatSupabaseQueryError(error);
  if (specific) {
    return specific;
  }

  const missingTable = formatMissingTableHint(error);
  if (missingTable) {
    return missingTable;
  }

  const details =
    error && typeof error === "object" && "message" in error
      ? String(error.message)
      : "";
  const code =
    error && typeof error === "object" && "code" in error ? String(error.code) : "";

  return (
    "O schema do Supabase está desatualizado em relação ao app. " +
    "Abra o SQL Editor do projeto e execute supabase/schema.sql. " +
    (code || details ? `Detalhe: ${[code, details].filter(Boolean).join(" — ")}` : "")
  );
}

export function assertLocalFilesystemAllowed() {
  if (!canUseLocalFilesystem()) {
    throw new Error(SUPABASE_REQUIRED_IN_PRODUCTION_MESSAGE);
  }
}
