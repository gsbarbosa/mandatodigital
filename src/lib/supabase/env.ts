import { getRuntimeEnv, isRuntimeEnvSet } from "@/lib/runtime-env";

export function getSupabaseUrl() {
  return (
    getRuntimeEnv("NEXT_PUBLIC_SUPABASE_URL") || getRuntimeEnv("SUPABASE_URL")
  );
}

/** Chave anon/publica — ainda necessaria para upload resumavel (TUS) no Storage. */
export function getSupabaseAnonKey() {
  return (
    getRuntimeEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") ||
    getRuntimeEnv("SUPABASE_ANON_KEY")
  );
}

/** Chave para TUS no browser (anon) ou no servidor (service role como fallback). */
export function getSupabaseStorageApiKey() {
  const anon = getSupabaseAnonKey();
  if (anon) {
    return anon;
  }
  return getRuntimeEnv("SUPABASE_SERVICE_ROLE_KEY");
}

export function isSupabaseBackendConfigured() {
  return (
    isRuntimeEnvSet("SUPABASE_URL") || isRuntimeEnvSet("NEXT_PUBLIC_SUPABASE_URL")
  ) && isRuntimeEnvSet("SUPABASE_SERVICE_ROLE_KEY");
}

export function isSupabaseStorageUploadConfigured() {
  return isSupabaseBackendConfigured() && Boolean(getSupabaseAnonKey());
}
