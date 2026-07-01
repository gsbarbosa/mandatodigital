/**
 * Aplica migracao platform_credentials (admin integracoes).
 *
 * Opcao A: SQL Editor — supabase/migrations/20260630_platform_credentials.sql
 * Opcao B: SUPABASE_DB_URL='postgresql://...' node scripts/apply-platform-credentials-migration.mjs --confirm
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
  "supabase/migrations/20260630_platform_credentials.sql",
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
    console.log("Dry-run. Use --confirm para aplicar via SUPABASE_DB_URL.\n");
    console.log(sql);
    process.exit(0);
  }

  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: dbUrl });

  try {
    await client.connect();
    await client.query(sql);
    console.log("Migracao platform_credentials aplicada.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
