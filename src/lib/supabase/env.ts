export function getSupabaseUrl() {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "").trim();
}

export function getSupabaseAnonKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    ""
  ).trim();
}

export function isSupabaseAuthConfigured() {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}

export function isSupabaseBackendConfigured() {
  return Boolean(getSupabaseUrl() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

/** Backend no ar mas anon key ausente — login fica desligado sem aviso. */
export function getAuthSetupMessage(): string | null {
  if (isSupabaseAuthConfigured()) {
    return null;
  }

  if (!isSupabaseBackendConfigured()) {
    return null;
  }

  if (!getSupabaseUrl()) {
    return "Configure SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_URL na Vercel.";
  }

  if (!getSupabaseAnonKey()) {
    return (
      "Login desativado: falta NEXT_PUBLIC_SUPABASE_ANON_KEY na Vercel. " +
      "No Supabase (Settings → API), copie a chave anon public, adicione a variavel e faca Redeploy."
    );
  }

  return null;
}

export function shouldEnforceLogin() {
  return isSupabaseAuthConfigured() || Boolean(getAuthSetupMessage());
}
