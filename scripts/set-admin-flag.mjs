/**
 * Ativa/desativa o acesso ao /admin via flag `isAdmin` no cadastro do usuário
 * (userRegistrations) — sem precisar de ADMIN_EMAIL/ADMIN_PASSWORD separado.
 * O usuário precisa já ter feito login pelo menos uma vez no app (conta Firebase Auth existente).
 *
 * Uso:
 *   node scripts/set-admin-flag.mjs email@exemplo.com
 *   node scripts/set-admin-flag.mjs email@exemplo.com off
 *   node scripts/set-admin-flag.mjs email1@x.com email2@y.com   (múltiplos, todos "on")
 *
 * Requer FIREBASE_SERVICE_ACCOUNT_JSON (.env.local) ou ADC.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Mesmo algoritmo de src/lib/owner-user-id.ts — não importar de src/ aqui (script standalone). */
function toDatabaseOwnerUserId(ownerUserId) {
  const trimmed = ownerUserId.trim();
  if (UUID_PATTERN.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  const digest = createHash("sha256").update(`mandato:owner:${trimmed}`).digest();
  const bytes = Uint8Array.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Buffer.from(bytes).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
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

function initAdmin() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (raw) {
    return initializeApp({ credential: cert(JSON.parse(raw)) });
  }
  if (process.env.FIREBASE_CONFIG || process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return initializeApp();
  }
  throw new Error(
    "FIREBASE_SERVICE_ACCOUNT_JSON nao configurado. Carregue .env.local ou exporte GOOGLE_APPLICATION_CREDENTIALS.",
  );
}

async function main() {
  loadEnvFile(resolve(process.cwd(), ".env.local"));
  loadEnvFile(resolve(process.cwd(), ".env"));

  const args = process.argv.slice(2);
  if (!args.length) {
    console.error("Uso: node scripts/set-admin-flag.mjs email@exemplo.com [off]");
    process.exit(1);
  }

  const turnOff = args[args.length - 1] === "off";
  const emails = (turnOff ? args.slice(0, -1) : args).filter((a) => a.includes("@"));

  if (!emails.length) {
    console.error("Informe ao menos um e-mail.");
    process.exit(1);
  }

  initAdmin();
  const auth = getAuth();
  const db = getFirestore();
  db.settings({ ignoreUndefinedProperties: true });

  const isAdmin = !turnOff;
  const results = [];

  for (const rawEmail of emails) {
    const email = rawEmail.trim().toLowerCase();
    try {
      const user = await auth.getUserByEmail(email);
      const ownerUserId = toDatabaseOwnerUserId(user.uid);
      await db
        .collection("userRegistrations")
        .doc(ownerUserId)
        .set({ isAdmin, updatedAt: new Date().toISOString() }, { merge: true });
      results.push({ email, uid: user.uid, ownerUserId, isAdmin, ok: true });
    } catch (error) {
      results.push({ email, ok: false, error: error?.message || String(error) });
    }
  }

  console.log("");
  for (const r of results) {
    if (r.ok) {
      console.log(`✔ ${r.email} → isAdmin=${r.isAdmin} (uid=${r.uid}, doc=userRegistrations/${r.ownerUserId})`);
    } else {
      console.log(`✘ ${r.email} — ${r.error}`);
    }
  }
  console.log("");

  if (results.some((r) => !r.ok)) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
