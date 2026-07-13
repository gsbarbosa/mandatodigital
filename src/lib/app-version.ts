/** Versão do app (espelha `package.json` via `next.config.ts`). */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION?.trim() || "0.0.0";
