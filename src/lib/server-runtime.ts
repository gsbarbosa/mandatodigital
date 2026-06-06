/** Ambientes serverless (Vercel/Lambda) nao tem disco gravavel em `data/`. */
export function isServerlessRuntime() {
  return Boolean(
    process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.LAMBDA_TASK_ROOT,
  );
}

export function canUseLocalFilesystem() {
  return !isServerlessRuntime();
}

export const SUPABASE_REQUIRED_IN_PRODUCTION_MESSAGE =
  "Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente de producao (ex.: Vercel). " +
  "O armazenamento local em data/ nao funciona em serverless.";

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

export function supabaseSchemaOutdatedMessage(error: unknown) {
  const specific = formatSupabaseQueryError(error);
  if (specific) {
    return specific;
  }

  const details =
    error && typeof error === "object" && "message" in error
      ? String(error.message)
      : "";
  const code =
    error && typeof error === "object" && "code" in error ? String(error.code) : "";

  return (
    "O schema do Supabase esta desatualizado em relacao ao app. " +
    "Abra o SQL Editor do projeto e execute supabase/schema.sql. " +
    (code || details ? `Detalhe: ${[code, details].filter(Boolean).join(" — ")}` : "")
  );
}

export function assertLocalFilesystemAllowed() {
  if (!canUseLocalFilesystem()) {
    throw new Error(SUPABASE_REQUIRED_IN_PRODUCTION_MESSAGE);
  }
}
