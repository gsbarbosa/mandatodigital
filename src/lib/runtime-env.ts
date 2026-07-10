/**
 * Leitura dinâmica de env evita que o Next.js inlined `undefined` no build
 * quando secrets só existem no runtime do Cloud Run (Firebase App Hosting).
 */
export function getRuntimeEnv(name: string): string {
  return (process.env[name] ?? "").trim();
}

export function isRuntimeEnvSet(name: string): boolean {
  return getRuntimeEnv(name).length > 0;
}
