/**
 * Zera dados da aplicacao (Supabase + arquivos locais) como no primeiro deploy.
 *
 * Uso:
 *   node scripts/reset-database.mjs --dry-run
 *   node scripts/reset-database.mjs --confirm
 *   node scripts/reset-database.mjs --confirm --skip-auth
 *   node scripts/reset-database.mjs --confirm --env production
 */

import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

const APP_TABLES = [
  "evaluation_scores",
  "evaluation_candidates",
  "evaluation_runs",
  "content_feedback",
  "generated_contents",
  "content_requests",
  "product_feedback",
  "avatar_video_generations",
  "profile_avatar_trainings",
  "profile_training_assets",
  "mandate_workflow_configs",
  "politician_profiles",
];

const EMPTY_LOCAL_DATABASE = {
  profile: null,
  trainingAssets: [],
  contentRequests: [],
  generatedContents: [],
  feedback: [],
  productFeedbacks: [],
  evaluationRuns: [],
  evaluationCandidates: [],
  evaluationScores: [],
};

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

function parseArgs(argv) {
  const args = {
    dryRun: true,
    skipAuth: false,
    envFile: ".env.local",
  };

  for (const arg of argv) {
    if (arg === "--confirm") {
      args.dryRun = false;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--skip-auth") {
      args.skipAuth = true;
    } else if (arg.startsWith("--env=")) {
      const envName = arg.slice("--env=".length).trim();
      args.envFile =
        envName === "production"
          ? ".env.vercel.production"
          : envName === "preview"
            ? ".env.vercel.preview"
            : ".env.local";
    }
  }

  return args;
}

async function countRows(client, table) {
  const { count, error } = await client
    .from(table)
    .select("*", { count: "exact", head: true });

  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01") {
      return { table, count: 0, missing: true };
    }
    throw new Error(`${table}: ${error.message}`);
  }

  return { table, count: count ?? 0, missing: false };
}

async function deleteAllRows(client, table, dryRun) {
  if (dryRun) {
    return;
  }

  const filterColumn = table === "mandate_workflow_configs" ? "profile_id" : "id";
  const { error } = await client
    .from(table)
    .delete()
    .neq(filterColumn, "00000000-0000-0000-0000-000000000000");

  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01") {
      return;
    }
    throw new Error(`${table}: ${error.message}`);
  }
}

async function listStoragePaths(client, bucket, prefix = "") {
  const paths = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const { data, error } = await client.storage.from(bucket).list(prefix, {
      limit,
      offset,
      sortBy: { column: "name", order: "asc" },
    });

    if (error) {
      throw new Error(`storage:${bucket}/${prefix}: ${error.message}`);
    }

    if (!data?.length) {
      break;
    }

    for (const item of data) {
      const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) {
        const nested = await listStoragePaths(client, bucket, fullPath);
        paths.push(...nested);
      } else {
        paths.push(fullPath);
      }
    }

    if (data.length < limit) {
      break;
    }

    offset += limit;
  }

  return paths;
}

async function clearStorageBucket(client, bucket, dryRun) {
  const paths = await listStoragePaths(client, bucket);
  if (!paths.length) {
    return { bucket, removed: 0 };
  }

  if (!dryRun) {
    const chunkSize = 100;
    for (let i = 0; i < paths.length; i += chunkSize) {
      const chunk = paths.slice(i, i + chunkSize);
      const { error } = await client.storage.from(bucket).remove(chunk);
      if (error) {
        throw new Error(`storage remove ${bucket}: ${error.message}`);
      }
    }
  }

  return { bucket, removed: paths.length };
}

async function listFirebaseAuthUsers() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) {
    return { users: [], skipped: true };
  }

  const { cert, getApps, initializeApp } = await import("firebase-admin/app");
  const { getAuth } = await import("firebase-admin/auth");

  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(raw)) });
  }

  const users = [];
  let pageToken = undefined;

  while (true) {
    const result = await getAuth().listUsers(200, pageToken);
    users.push(...result.users);
    pageToken = result.pageToken;
    if (!pageToken) {
      break;
    }
  }

  return { users, skipped: false };
}

async function clearAuthUsers(dryRun) {
  const { users, skipped } = await listFirebaseAuthUsers();
  if (skipped) {
    return { removed: 0, skipped: true };
  }

  if (!dryRun) {
    const { getAuth } = await import("firebase-admin/auth");
    for (const user of users) {
      await getAuth().deleteUser(user.uid);
    }
  }

  return { removed: users.length, skipped: false };
}

function resetLocalFiles(dryRun) {
  const root = process.cwd();
  const dbPath = join(root, "data", "mandato-digital.json");
  const trainingDir = join(root, "data", "training-assets");
  const result = { localJsonReset: false, localTrainingFilesRemoved: 0 };

  if (!dryRun) {
    writeFileSync(dbPath, `${JSON.stringify(EMPTY_LOCAL_DATABASE, null, 2)}\n`, "utf8");
    result.localJsonReset = true;
  } else if (existsSync(dbPath)) {
    result.localJsonReset = true;
  }

  if (existsSync(trainingDir)) {
    const files = readdirSync(trainingDir, { withFileTypes: true });
    result.localTrainingFilesRemoved = files.filter((entry) => entry.isFile()).length;
    if (!dryRun) {
      for (const entry of files) {
        if (entry.isFile()) {
          rmSync(join(trainingDir, entry.name), { force: true });
        }
      }
    }
  }

  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const envPath = resolve(process.cwd(), args.envFile);
  loadEnvFile(envPath);

  const url = process.env.SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket =
    process.env.SUPABASE_TRAINING_ASSETS_BUCKET?.trim() || "persona-training-videos";

  if (!url || !serviceKey) {
    console.error(
      `SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorios (carregado de ${args.envFile}).`,
    );
    process.exit(1);
  }

  const client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const mode = args.dryRun ? "DRY-RUN" : "CONFIRM";
  console.log(`[${mode}] reset-database usando ${args.envFile}`);
  console.log(`[${mode}] Supabase: ${url}`);

  const counts = [];
  for (const table of APP_TABLES) {
    counts.push(await countRows(client, table));
  }

  console.log("\nTabelas:");
  for (const row of counts) {
    const suffix = row.missing ? " (tabela ausente)" : "";
    console.log(`  - ${row.table}: ${row.count} registro(s)${suffix}`);
  }

  const storage = await clearStorageBucket(client, bucket, true);
  console.log(`\nStorage bucket "${storage.bucket}": ${storage.removed} arquivo(s)`);

  if (!args.skipAuth) {
    const authPreview = await clearAuthUsers(true);
    if (authPreview.skipped) {
      console.log("\nAuth users (Firebase): pulado (FIREBASE_SERVICE_ACCOUNT_JSON ausente)");
    } else {
      console.log(`\nAuth users (Firebase): ${authPreview.removed} usuario(s)`);
    }
  } else {
    console.log("\nAuth users: pulado (--skip-auth)");
  }

  const local = resetLocalFiles(true);
  console.log(
    `\nLocal: mandato-digital.json ${local.localJsonReset ? "sera zerado" : "ausente"}, training-assets: ${local.localTrainingFilesRemoved} arquivo(s)`,
  );

  if (args.dryRun) {
    console.log("\nNada foi alterado. Rode com --confirm para executar.");
    return;
  }

  console.log("\nExecutando limpeza...");

  for (const table of APP_TABLES) {
    await deleteAllRows(client, table, false);
  }

  const storageResult = await clearStorageBucket(client, bucket, false);
  console.log(`Storage: removidos ${storageResult.removed} arquivo(s).`);

  if (!args.skipAuth) {
    const authResult = await clearAuthUsers(false);
    if (authResult.skipped) {
      console.log("Auth: Firebase nao configurado, usuarios nao removidos.");
    } else {
      console.log(`Auth: removidos ${authResult.removed} usuario(s) do Firebase.`);
    }
  }

  const localResult = resetLocalFiles(false);
  console.log(
    `Local: JSON zerado=${localResult.localJsonReset}, training-assets removidos=${localResult.localTrainingFilesRemoved}.`,
  );

  console.log("\nBanco zerado. Proximo passo: criar conta de novo em /login e refazer onboarding.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
