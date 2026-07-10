/**
 * Aplica owner_user_id em product_feedback.
 *
 * SQL Editor: supabase/migrations/20260709_product_feedback_owner_user_id.sql
 * CLI: SUPABASE_DB_URL='postgresql://...' node scripts/apply-product-feedback-owner-migration.mjs --confirm
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

    if (!(key in process.env) || !String(process.env[key] ?? "").trim()) {
      process.env[key] = value;
    }
  }
}

async function main() {
  const confirm = process.argv.includes("--confirm");
  for (const file of [".env.local", ".env"]) {
    loadEnvFile(resolve(process.cwd(), file));
  }

  const migrationPath = resolve(
    process.cwd(),
    "supabase/migrations/20260709_product_feedback_owner_user_id.sql",
  );
  const sql = readFileSync(migrationPath, "utf8");
  const dbUrl = process.env.SUPABASE_DB_URL?.trim();

  if (!dbUrl) {
    console.log("SUPABASE_DB_URL nao definido.\n");
    console.log("Cole no SQL Editor do Supabase:\n");
    console.log(sql);
    process.exit(0);
  }

  if (!confirm) {
    console.log("Rode com --confirm para executar via SUPABASE_DB_URL.");
    process.exit(0);
  }

  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();
  try {
    await client.query(sql);
    console.log("Migration product_feedback owner_user_id aplicada.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
