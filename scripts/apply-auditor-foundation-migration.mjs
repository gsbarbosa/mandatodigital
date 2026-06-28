/**
 * Aplica migracao Fase 2 (Validador + audit_log + metadata).
 *
 * Opcao A: SQL Editor — supabase/migrations/20260625_auditor_foundation.sql
 * Opcao B: SUPABASE_DB_URL='postgresql://...' node scripts/apply-auditor-foundation-migration.mjs --confirm
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

const MIGRATION_PATH = resolve(
  process.cwd(),
  "supabase/migrations/20260625_auditor_foundation.sql",
);

async function main() {
  const confirm = process.argv.includes("--confirm");
  loadEnvFile(resolve(process.cwd(), ".env.local"));

  const sql = readFileSync(MIGRATION_PATH, "utf8").trim();
  const dbUrl = process.env.SUPABASE_DB_URL?.trim();

  if (!dbUrl) {
    console.log("SUPABASE_DB_URL nao definido.\n");
    console.log("Cole no SQL Editor:\n");
    console.log(sql);
    process.exit(confirm ? 1 : 0);
  }

  if (!confirm) {
    console.log("[DRY-RUN] Aplicaria migracao auditor_foundation");
    console.log("Rode com --confirm para executar via SUPABASE_DB_URL.");
    return;
  }

  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(sql);
    console.log("Tabelas do Validador (Fase 2) criadas com sucesso.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
