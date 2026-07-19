/**
 * Imprime os comandos para cadastrar secrets no Firebase App Hosting
 * a partir de variaveis em .env.local / .env.
 *
 * Uso:
 *   npm run firebase:secrets:guide
 *   node scripts/firebase-secrets-guide.mjs --apply
 */

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const SECRET_MAP = [
  ["OPENAI_API_KEY", "openai-api-key"],
  ["ANTHROPIC_API_KEY", "anthropic-api-key"],
  ["HEYGEN_API_KEY", "heygen-api-key"],
  ["ELEVENLABS_API_KEY", "elevenlabs-api-key"],
  ["APIFY_API_TOKEN", "apify-api-token"],
  ["TRAINING_ASSET_ACCESS_SECRET", "training-asset-access-secret"],
  ["FIREBASE_SERVICE_ACCOUNT_JSON", "firebase-service-account-json"],
  ["RESEND_API_KEY", "resend-api-key"],
  ["JOBS_WORKER_SHARED_SECRET", "jobs-worker-shared-secret"],
];

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

function setSecret(secretId, value) {
  const tempDir = mkdtempSync(join(tmpdir(), "firebase-secret-"));
  const dataFile = join(tempDir, secretId);

  try {
    writeFileSync(dataFile, value, "utf8");

    const result = spawnSync(
      "sh",
      [
        "-c",
        `printf 'n\\n' | firebase apphosting:secrets:set ${secretId} --project madatodigital --force --data-file ${JSON.stringify(dataFile)}`,
      ],
      {
        stdio: "inherit",
        env: { ...process.env, CI: "true" },
      },
    );

    return result.status ?? 1;
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function main() {
  const apply = process.argv.includes("--apply");

  for (const file of [".env.local", ".env.prod", ".env.stg", ".env"]) {
    loadEnvFile(resolve(process.cwd(), file));
  }

  console.log("Secrets referenciados em apphosting.yaml:\n");

  const applied = [];
  const seen = new Set();

  for (const [envKey, secretId] of SECRET_MAP) {
    if (seen.has(secretId)) {
      continue;
    }
    seen.add(secretId);

    const value = process.env[envKey]?.trim();
    const command = `firebase apphosting:secrets:set ${secretId} --project madatodigital --force`;

    if (!value) {
      console.log(`# [pendente] ${secretId} (defina ${envKey} no .env.local)`);
      console.log(`${command}\n`);
      continue;
    }

    console.log(`# ${secretId} ← ${envKey}`);
    console.log(`${command}\n`);

    if (apply) {
      const status = setSecret(secretId, value);
      if (status !== 0) {
        console.error(`Falha ao cadastrar secret ${secretId}.`);
        process.exit(status);
      }
      applied.push(secretId);
    }
  }

  if (apply && applied.length > 0) {
    console.log("\nLiberando secrets para o backend mandatodigital...\n");
    const grant = spawnSync(
      "firebase",
      [
        "apphosting:secrets:grantaccess",
        applied.join(","),
        "--backend",
        "mandatodigital",
        "--project",
        "madatodigital",
        "--location",
        "us-central1",
      ],
      { stdio: "inherit", env: { ...process.env, CI: "true" } },
    );

    if (grant.status !== 0) {
      console.error("Falha ao liberar secrets para o backend.");
      process.exit(grant.status ?? 1);
    }
  }

  console.log("\nProximo passo:");
  console.log("  npm run deploy:firebase");
}

main();
