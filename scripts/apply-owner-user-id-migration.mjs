/**
 * Aplica migracao owner_user_id uuid -> text (necessaria apos Firebase Auth).
 *
 * Opcao A (recomendada): cole no SQL Editor do Supabase:
 *   supabase/migrations/20260604_owner_user_id_text.sql
 *
 * Opcao B (CLI, se tiver senha do banco):
 *   SUPABASE_DB_URL='postgresql://postgres:SENHA@db.PROJECT_REF.supabase.co:5432/postgres' \
 *     node scripts/apply-owner-user-id-migration.mjs --confirm
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      continue;
    }

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

const SQL = `
alter table if exists politician_profiles
  alter column owner_user_id type text using owner_user_id::text;
`.trim();

async function main() {
  const confirm = process.argv.includes("--confirm");
  loadEnvFile(resolve(process.cwd(), ".env.local"));

  const dbUrl = process.env.SUPABASE_DB_URL?.trim();
  if (!dbUrl) {
    console.log("SUPABASE_DB_URL nao definido.");
    console.log("Rode este SQL no Supabase → SQL Editor:\n");
    console.log(SQL);
    process.exit(confirm ? 1 : 0);
  }

  if (!confirm) {
    console.log("[DRY-RUN] Aplicaria migracao owner_user_id -> text");
    console.log("Rode com --confirm para executar via SUPABASE_DB_URL.");
    return;
  }

  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(SQL);
    console.log("Migracao aplicada com sucesso.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
