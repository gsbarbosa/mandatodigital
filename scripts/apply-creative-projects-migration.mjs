/**
 * Cria a tabela creative_projects (necessaria para salvar criativos apos geracao HeyGen).
 *
 * Opcao A (recomendada): cole no SQL Editor do Supabase:
 *   supabase/migrations/20260606_creative_projects.sql
 *
 * Opcao B (CLI, se tiver senha do banco):
 *   SUPABASE_DB_URL='postgresql://postgres:SENHA@db.PROJECT_REF.supabase.co:5432/postgres' \
 *     node scripts/apply-creative-projects-migration.mjs --confirm
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
  "supabase/migrations/20260606_creative_projects.sql",
);

function readMigrationSql() {
  return readFileSync(MIGRATION_PATH, "utf8").trim();
}

function resolveProjectRef() {
  const url = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) {
    return null;
  }

  try {
    return new URL(url).hostname.split(".")[0] || null;
  } catch {
    return null;
  }
}

async function main() {
  const confirm = process.argv.includes("--confirm");
  loadEnvFile(resolve(process.cwd(), ".env.local"));

  const sql = readMigrationSql();
  const projectRef = resolveProjectRef();

  const dbUrl = process.env.SUPABASE_DB_URL?.trim();
  if (!dbUrl) {
    console.log("SUPABASE_DB_URL nao definido.\n");
    if (projectRef) {
      console.log(
        `Abra o SQL Editor: https://supabase.com/dashboard/project/${projectRef}/sql/new\n`,
      );
    } else {
      console.log("Abra o SQL Editor do seu projeto Supabase.\n");
    }
    console.log("Cole e execute:\n");
    console.log(sql);
    process.exit(confirm ? 1 : 0);
  }

  if (!confirm) {
    console.log("[DRY-RUN] Aplicaria migracao creative_projects");
    console.log("Rode com --confirm para executar via SUPABASE_DB_URL.");
    return;
  }

  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(sql);
    console.log("Tabela creative_projects criada com sucesso.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
