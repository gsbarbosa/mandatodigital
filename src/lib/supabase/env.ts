export function getSupabaseUrl() {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "").trim();
}

/** Chave anon/publica — ainda necessaria para upload resumavel (TUS) no Storage. */
export function getSupabaseAnonKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    ""
  ).trim();
}

/** Chave para TUS no browser (anon) ou no servidor (service role como fallback). */
export function getSupabaseStorageApiKey() {
  const anon = getSupabaseAnonKey();
  if (anon) {
    return anon;
  }
  return (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
}

export function isSupabaseBackendConfigured() {
  return Boolean(getSupabaseUrl() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

export function isSupabaseStorageUploadConfigured() {
  return isSupabaseBackendConfigured() && Boolean(getSupabaseAnonKey());
}
