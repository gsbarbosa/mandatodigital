/**
 * Extrai envs do App Hosting (apphosting.yaml + Cloud Run) e resolve secrets
 * do Secret Manager para arquivos locais (.env.stg / .env.prod).
 *
 * Uso:
 *   npm run env:pull -- --env stg
 *   npm run env:pull -- --env prod
 *   npm run env:pull -- --env stg --use          # também copia para .env.local
 *   npm run env:pull -- --env prod --out .env.prod
 *
 * Requer: gcloud autenticado no projeto madatodigital (conta com secretAccessor).
 *
 * Next.js não carrega .env.stg/.env.prod sozinho — use --use ou:
 *   cp .env.stg .env.local && npm run dev
 */

import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const PROJECT = process.env.GCP_PROJECT?.trim() || "madatodigital";
const REGION = process.env.GCP_REGION?.trim() || "us-central1";
const YAML_PATH = resolve(process.cwd(), "apphosting.yaml");

/** secret-id no Secret Manager → env var(s) locais */
const SECRET_TO_ENVS = {
  "openai-api-key": ["OPENAI_API_KEY"],
  "anthropic-api-key": ["ANTHROPIC_API_KEY"],
  "heygen-api-key": ["HEYGEN_API_KEY"],
  "elevenlabs-api-key": ["ELEVENLABS_API_KEY"],
  "apify-api-token": ["APIFY_API_TOKEN", "APIFY_TOKEN"],
  "training-asset-access-secret": ["TRAINING_ASSET_ACCESS_SECRET"],
  "firebase-service-account-json": ["FIREBASE_SERVICE_ACCOUNT_JSON"],
  "resend-api-key": ["RESEND_API_KEY"],
  "jobs-worker-shared-secret": ["JOBS_WORKER_SHARED_SECRET"],
};

const ENV_PRESETS = {
  stg: {
    label: "staging",
    cloudRunService: "mandatodigital-stg",
    defaultOut: ".env.stg",
    appBaseUrl:
      "https://mandatodigital-stg--madatodigital.us-central1.hosted.app",
  },
  prod: {
    label: "production",
    cloudRunService: "mandatodigital",
    defaultOut: ".env.prod",
    appBaseUrl: "https://mandatodigital--madatodigital.us-central1.hosted.app",
  },
};

function usage() {
  console.log(`Uso:
  npm run env:pull -- --env stg|prod [--out FILE] [--use] [--dry-run]

Opções:
  --env stg|prod   Backend Cloud Run (mandatodigital-stg | mandatodigital)
  --out FILE       Destino (default: .env.stg / .env.prod)
  --use            Copia o arquivo gerado para .env.local
  --dry-run        Lista chaves sem gravar (não imprime valores secretos)
`);
}

function parseArgs(argv) {
  const args = { env: null, out: null, use: false, dryRun: false, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--help" || a === "-h") args.help = true;
    else if (a === "--use") args.use = true;
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--env") args.env = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else if (a.startsWith("--env=")) args.env = a.slice("--env=".length);
    else if (a.startsWith("--out=")) args.out = a.slice("--out=".length);
  }
  return args;
}

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    env: process.env,
    ...opts,
  });
  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || "").trim();
    throw new Error(
      `${cmd} ${args.join(" ")} falhou (${result.status}): ${err.slice(0, 500)}`,
    );
  }
  return (result.stdout || "").trim();
}

function escapeEnvValue(value) {
  const text = String(value);
  if (text === "") return '""';
  if (/[\n\r#]/.test(text) || /[\s"'`$\\]/.test(text) || text.includes("=")) {
    return `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r")}"`;
  }
  return text;
}

/** Parse simplificado do bloco env: do apphosting.yaml */
function parseAppHostingEnv(yamlText) {
  const entries = [];
  const lines = yamlText.split(/\r?\n/);
  let inEnv = false;
  let current = null;

  for (const line of lines) {
    if (/^env:\s*$/.test(line)) {
      inEnv = true;
      continue;
    }
    if (inEnv && /^\S/.test(line) && !line.startsWith("#")) {
      break;
    }
    if (!inEnv) continue;

    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const varMatch = trimmed.match(/^-?\s*variable:\s*(.+)$/);
    if (varMatch) {
      if (current?.variable) entries.push(current);
      current = { variable: varMatch[1].trim(), value: null, secret: null };
      continue;
    }
    if (!current) continue;

    const valueMatch = trimmed.match(/^value:\s*(.*)$/);
    if (valueMatch) {
      let v = valueMatch[1].trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      current.value = v;
      continue;
    }

    const secretMatch = trimmed.match(/^secret:\s*(.+)$/);
    if (secretMatch) {
      current.secret = secretMatch[1].trim();
    }
  }
  if (current?.variable) entries.push(current);
  return entries;
}

function fetchCloudRunPlainEnv(serviceName) {
  const raw = run("gcloud", [
    "run",
    "services",
    "describe",
    serviceName,
    `--project=${PROJECT}`,
    `--region=${REGION}`,
    "--format=json",
  ]);
  const json = JSON.parse(raw);
  const envList =
    json?.spec?.template?.spec?.containers?.[0]?.env ??
    json?.spec?.template?.spec?.containers?.[0]?.envVars ??
    [];
  /** @type {Record<string, string>} */
  const plain = {};
  for (const item of envList) {
    const name = item?.name;
    if (!name) continue;
    if (typeof item.value === "string") {
      plain[name] = item.value;
    }
  }
  return plain;
}

function listSecretIds() {
  const raw = run("gcloud", [
    "secrets",
    "list",
    `--project=${PROJECT}`,
    "--format=value(name)",
  ]);
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((name) => name.split("/").pop());
}

function accessSecret(secretId) {
  return run("gcloud", [
    "secrets",
    "versions",
    "access",
    "latest",
    `--secret=${secretId}`,
    `--project=${PROJECT}`,
  ]);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.env) {
    usage();
    process.exit(args.help ? 0 : 1);
  }

  const preset = ENV_PRESETS[args.env];
  if (!preset) {
    console.error(`--env inválido: ${args.env} (use stg ou prod)`);
    process.exit(1);
  }

  const outPath = resolve(process.cwd(), args.out || preset.defaultOut);

  if (!existsSync(YAML_PATH)) {
    console.error(`Não achei ${YAML_PATH}`);
    process.exit(1);
  }

  console.log(`Projeto=${PROJECT} env=${args.env} service=${preset.cloudRunService}`);
  console.log(`Lendo ${YAML_PATH}…`);

  const yamlEntries = parseAppHostingEnv(readFileSync(YAML_PATH, "utf8"));
  /** @type {Record<string, string>} */
  const envMap = {};
  /** @type {Set<string>} */
  const secretIdsNeeded = new Set();
  /** @type {string[]} */
  const notes = [];

  for (const entry of yamlEntries) {
    if (entry.secret) {
      secretIdsNeeded.add(entry.secret);
      continue;
    }
    if (entry.value != null) {
      envMap[entry.variable] = entry.value;
    }
  }

  console.log(`Cloud Run plain envs (${preset.cloudRunService})…`);
  let cloudRunPlain = {};
  try {
    cloudRunPlain = fetchCloudRunPlainEnv(preset.cloudRunService);
    for (const [key, value] of Object.entries(cloudRunPlain)) {
      envMap[key] = value;
    }
  } catch (error) {
    notes.push(
      `Cloud Run indisponível (${error instanceof Error ? error.message : error}); usando só yaml.`,
    );
  }

  // Prefer URL do preset se Cloud Run ainda apontar prod em ambos (caso atual do stg)
  if (args.env === "stg") {
    const hosted = envMap.APP_BASE_URL || "";
    if (!hosted.includes("mandatodigital-stg")) {
      envMap.APP_BASE_URL = preset.appBaseUrl;
      envMap.NEXT_PUBLIC_APP_BASE_URL = preset.appBaseUrl;
      notes.push(
        "APP_BASE_URL forçada para URL stg (Cloud Run ainda tinha URL de prod).",
      );
    }
  }

  console.log("Listando secrets no Secret Manager…");
  const allSecrets = listSecretIds();
  for (const id of allSecrets) {
    if (SECRET_TO_ENVS[id]) {
      secretIdsNeeded.add(id);
    }
  }
  // Sempre útil no local (Admin SDK)
  if (allSecrets.includes("firebase-service-account-json")) {
    secretIdsNeeded.add("firebase-service-account-json");
  }

  /** @type {string[]} */
  const missingSecrets = [];
  /** @type {string[]} */
  const resolvedSecrets = [];

  for (const secretId of [...secretIdsNeeded].sort()) {
    process.stdout.write(`  secret ${secretId}… `);
    try {
      const value = accessSecret(secretId);
      const envKeys = SECRET_TO_ENVS[secretId] ?? [];
      // Também aplica variáveis do yaml que apontam para este secret
      for (const entry of yamlEntries) {
        if (entry.secret === secretId) {
          envMap[entry.variable] = value;
        }
      }
      for (const key of envKeys) {
        envMap[key] = value;
      }
      if (envKeys.length === 0 && !yamlEntries.some((e) => e.secret === secretId)) {
        notes.push(`Secret ${secretId} existe mas sem mapeamento de env (ignorado).`);
      }
      resolvedSecrets.push(secretId);
      console.log("ok");
    } catch (error) {
      missingSecrets.push(secretId);
      console.log("FALHOU");
      notes.push(
        `Falha ao ler ${secretId}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  const unmapped = allSecrets.filter(
    (id) => !SECRET_TO_ENVS[id] && !yamlEntries.some((e) => e.secret === id),
  );

  const sortedKeys = Object.keys(envMap).sort((a, b) => a.localeCompare(b));
  const header = [
    `# Gerado por scripts/pull-remote-env.mjs`,
    `# env=${args.env} (${preset.label}) project=${PROJECT}`,
    `# service=${preset.cloudRunService} em ${new Date().toISOString()}`,
    `# NÃO COMMITAR. Contém secrets.`,
    `# Uso: cp ${args.out || preset.defaultOut} .env.local && npm run dev`,
    `#      ou: npm run env:pull -- --env ${args.env} --use`,
    "",
  ];

  const body = sortedKeys.map((key) => `${key}=${escapeEnvValue(envMap[key])}`);
  const footer =
    unmapped.length > 0
      ? [
          "",
          "# Secrets no Secret Manager sem mapeamento neste script:",
          ...unmapped.map((id) => `# - ${id}`),
        ]
      : [];

  const content = [...header, ...body, ...footer, ""].join("\n");

  console.log("");
  console.log(`Chaves: ${sortedKeys.length}`);
  console.log(`Secrets resolvidos: ${resolvedSecrets.length}`);
  if (missingSecrets.length) {
    console.log(`Secrets faltando/falha: ${missingSecrets.join(", ")}`);
  }
  for (const note of notes) {
    console.log(`Nota: ${note}`);
  }

  if (args.dryRun) {
    console.log("\n[dry-run] chaves que seriam gravadas:");
    for (const key of sortedKeys) {
      const secretish =
        /KEY|SECRET|TOKEN|PASSWORD|JSON|SERVICE_ROLE/i.test(key) ||
        key === "FIREBASE_SERVICE_ACCOUNT_JSON";
      console.log(`  ${key}=${secretish ? "<redacted>" : envMap[key]}`);
    }
    return;
  }

  writeFileSync(outPath, content, "utf8");
  console.log(`\nGravado: ${outPath}`);

  if (args.use) {
    const localPath = resolve(process.cwd(), ".env.local");
    copyFileSync(outPath, localPath);
    console.log(`Copiado para: ${localPath}`);
  } else {
    console.log(`\nPara usar no Next:\n  cp ${args.out || preset.defaultOut} .env.local && npm run dev`);
    console.log(`  ou: npm run env:pull -- --env ${args.env} --use`);
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
