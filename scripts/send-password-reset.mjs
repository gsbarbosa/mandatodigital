/**
 * Gera link de redefinição (Admin SDK) e envia pelo Resend.
 *
 * Uso:
 *   node scripts/send-password-reset.mjs --email voce@exemplo.com --confirm
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { Resend } from "resend";

const CANONICAL_CONTINUE_URL = "https://mandatodigital.ia.br/login";

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
  const args = { email: "", confirm: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--confirm") {
      args.confirm = true;
    } else if (arg === "--email") {
      args.email = argv[i + 1] ?? "";
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

  const { email, confirm } = parseArgs(process.argv.slice(2));
  const normalized = email.trim().toLowerCase();

  if (!normalized) {
    console.error("Uso: node scripts/send-password-reset.mjs --email X --confirm");
    process.exit(1);
  }

  if (!confirm) {
    console.log(`[DRY-RUN] Enviaria reset via Resend para: ${normalized}`);
    console.log("Rode com --confirm para executar.");
    return;
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  let from = process.env.EMAIL_FROM?.trim();
  if (!from || /@gmail\.com\s*>?$/i.test(from)) {
    from = "Mandato Digital <annafernandes@mandatodigital.ia.br>";
  }
  if (!apiKey || !from) {
    throw new Error("RESEND_API_KEY ou EMAIL_FROM ausentes em .env.local");
  }

  const link = await getAdminAuth().generatePasswordResetLink(normalized, {
    url: CANONICAL_CONTINUE_URL,
    handleCodeInApp: false,
  });

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from,
    to: normalized,
    subject: "Mandato Digital — redefinir senha",
    text: [
      "Olá,",
      "",
      "Recebemos um pedido para redefinir a senha da sua conta no Mandato Digital.",
      "Abra o link abaixo (válido por cerca de 1 hora) e escolha uma senha nova:",
      "",
      link,
      "",
      "Se você não pediu essa redefinição, ignore este e-mail.",
      "",
      "Equipe Mandato Digital",
    ].join("\n"),
  });

  if (error) {
    throw new Error(error.message || "Falha ao enviar e-mail pelo Resend.");
  }

  console.log(`Reset enviado via Resend para ${normalized} (id ${data?.id ?? "ok"}).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
