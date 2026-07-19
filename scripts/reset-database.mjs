/**
 * Apaga todas as collections da app no Firestore (ambiente zerado).
 *
 * Uso:
 *   npm run db:reset            # dry-run / instrucoes
 *   npm run db:reset:confirm    # apaga de verdade
 *
 * Requer FIREBASE_SERVICE_ACCOUNT_JSON (ou ADC no App Hosting).
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const COLLECTIONS = [
  "politicianProfiles",
  "mandateWorkflowConfigs",
  "contentRequests",
  "generatedContents",
  "contentFeedback",
  "profileTrainingAssets",
  "creativeProjects",
  "evaluationRuns",
  "evaluationCandidates",
  "evaluationScores",
  "sentinelSuggestionCache",
  "sentinelSignals",
  "sentinelThemeExpansions",
  "sentinelArticleThemeVerdicts",
  "sentinelFactChecks",
  "asyncJobs",
  "auditLog",
  "contractAcceptances",
  "userRegistrations",
  "earlyAccessReservations",
];

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
    "FIREBASE_SERVICE_ACCOUNT_JSON nao configurado. Carregue .env.local ou exporte a var.",
  );
}

async function deleteCollection(db, name, batchSize = 200) {
  const collectionRef = db.collection(name);
  let deleted = 0;

  for (;;) {
    const snap = await collectionRef.limit(batchSize).get();
    if (snap.empty) break;

    const batch = db.batch();
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
    deleted += snap.size;
  }

  return deleted;
}

async function main() {
  loadEnvFile(resolve(process.cwd(), ".env.local"));
  loadEnvFile(resolve(process.cwd(), ".env"));

  const confirm = process.argv.includes("--confirm");
  if (!confirm) {
    console.log(
      "Dry-run: apagaria as collections Firestore da app:\n  " +
        COLLECTIONS.join("\n  ") +
        "\n\nPara executar de verdade: npm run db:reset:confirm\n",
    );
    return;
  }

  initAdmin();
  const db = getFirestore();

  console.log("Apagando collections Firestore...");
  for (const name of COLLECTIONS) {
    const count = await deleteCollection(db, name);
    console.log(`  ${name}: ${count} docs`);
  }
  console.log("Reset concluido.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
