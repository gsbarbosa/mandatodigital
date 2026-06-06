/**
 * Cria usuario no Firebase Auth (util para bootstrap sem UI).
 *
 * Uso:
 *   node scripts/create-auth-user.mjs --email voce@exemplo.com --password 'sua-senha' --confirm
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

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
  const args = { email: "", password: "", confirm: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--confirm") {
      args.confirm = true;
    } else if (arg === "--email") {
      args.email = argv[i + 1] ?? "";
      i += 1;
    } else if (arg === "--password") {
      args.password = argv[i + 1] ?? "";
      i += 1;
    }
  }

  return args;
}

function getAdminAuth() {
  if (!getApps().length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
    if (!raw) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON nao configurado em .env.local");
    }

    initializeApp({
      credential: cert(JSON.parse(raw)),
    });
  }

  return getAuth();
}

async function main() {
  loadEnvFile(resolve(process.cwd(), ".env.local"));

  const { email, password, confirm } = parseArgs(process.argv.slice(2));

  if (!email || !password) {
    console.error("Uso: node scripts/create-auth-user.mjs --email X --password Y --confirm");
    process.exit(1);
  }

  if (!confirm) {
    console.log(`[DRY-RUN] Criaria usuario Firebase: ${email}`);
    console.log("Rode com --confirm para executar.");
    return;
  }

  const user = await getAdminAuth().createUser({
    email,
    password,
    emailVerified: true,
  });

  console.log(`Usuario criado: ${user.email} (${user.uid})`);
  console.log("Acesse /login e use Entrar com esse e-mail e senha.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
