#!/usr/bin/env node
/**
 * Eval offline da spike de qualidade — lê caches do Firestore e aplica a heurística.
 * Uso: npm run sentinel:quality-eval
 * Requer FIREBASE_SERVICE_ACCOUNT_JSON no .env.local
 *
 * Mantém a fórmula alinhada a src/lib/sentinel-quality.ts (testes unitários são a fonte da verdade).
 */
const fs = require("fs");
const path = require("path");
const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const COLLECTION = "sentinelSuggestionCache";
const LIMIT = 15;

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    return {};
  }
  return Object.fromEntries(
    fs
      .readFileSync(envPath, "utf8")
      .split("\n")
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const i = line.indexOf("=");
        return [line.slice(0, i), line.slice(i + 1)];
      }),
  );
}

function initFirebaseAdmin(env) {
  if (getApps().length) {
    return getFirestore();
  }

  const raw =
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim() ||
    env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();

  if (!raw) {
    console.error("Falta FIREBASE_SERVICE_ACCOUNT_JSON no .env.local (ou exportada no shell).");
    console.error("");
    console.error("Instruções:");
    console.error("  1. Copie o JSON da service account para FIREBASE_SERVICE_ACCOUNT_JSON no .env.local");
    console.error("  2. Rode: npm run sentinel:quality-eval");
    process.exit(1);
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(raw);
  } catch {
    console.error("FIREBASE_SERVICE_ACCOUNT_JSON invalido (esperado JSON em uma linha).");
    process.exit(1);
  }

  initializeApp({ credential: cert(serviceAccount) });
  return getFirestore();
}

const THRESHOLD = 0.55;

function isOpposition(suggestion) {
  return (suggestion.evidence?.actors || []).some((actor) => actor.sourceList === "opposition");
}

function primaryTitle(suggestion) {
  const articleTitle = suggestion.evidence?.articles?.[0]?.title?.trim() || "";
  if (articleTitle) return articleTitle;
  const topic = (suggestion.topic || "").trim();
  const parts = topic.split(" · ");
  return (parts.length > 1 ? parts.slice(1).join(" · ") : topic).trim();
}

function scoreSuggestionPautavel(suggestion) {
  let score = 0;
  const opposition = isOpposition(suggestion);
  if (opposition) {
    const hasPost = Boolean(suggestion.evidence?.actors?.[0]?.postUrl);
    score += hasPost ? 0.45 : 0.1;
    if (suggestion.themeLabel?.trim()) score += 0.15;
    const final = Math.min(1, score);
    return { kind: "opposition", score: final, pautavel: final >= THRESHOLD };
  }

  const title = primaryTitle(suggestion);
  if (title.length >= 28) score += 0.25;
  else if (title.length >= 12) score += 0.12;
  if (suggestion.themeLabel?.trim()) score += 0.2;
  const relevance = suggestion.relevanceScore ?? 0;
  if (relevance >= 70) score += 0.25;
  else if (relevance >= 45) score += 0.15;
  else if (relevance >= 25) score += 0.08;
  const outlets = suggestion.evidence?.outletCount ?? suggestion.evidence?.articles?.length ?? 0;
  if (outlets >= 3) score += 0.15;
  else if (outlets >= 2) score += 0.1;
  else if (outlets >= 1) score += 0.05;
  const titleNorm = title.toLowerCase();
  if (["veja", "saiba mais", "ao vivo", "confira"].some((m) => titleNorm.includes(m)) && title.length < 40) {
    score -= 0.15;
  }
  // Espelha sentinel-quality.ts — classificados / fake news fraca.
  const jobListing =
    /\babre\s+(?:\d+\s+)?vagas?\b/.test(titleNorm) ||
    /\bvagas?\s+de\s+est[aá]gio\b/.test(titleNorm) ||
    /\bprograma\s+de\s+est[aá]gio\b/.test(titleNorm) ||
    /\bsaiba\s+como\s+se\s+candidatar\b/.test(titleNorm) ||
    /\bcomo\s+se\s+candidatar\b/.test(titleNorm) ||
    /\btem\s+emprego\b/.test(titleNorm);
  if (jobListing) score -= 0.35;
  if ((suggestion.matchedThemes?.length ?? 0) >= 2) score += 0.05;
  const final = Math.max(0, Math.min(1, score));
  return { kind: "news", score: final, pautavel: final >= THRESHOLD };
}

function toIso(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value.toDate && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

async function main() {
  const env = loadEnv();
  for (const [key, value] of Object.entries(env)) {
    if (!(key in process.env) || !String(process.env[key] ?? "").trim()) {
      process.env[key] = value;
    }
  }

  const db = initFirebaseAdmin(env);
  const snap = await db
    .collection(COLLECTION)
    .orderBy("refreshedAt", "desc")
    .limit(LIMIT)
    .get();

  const rows = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  console.log("Spike Sentinela qualidade — eval de cache (Firestore)\n");
  console.log(
    "refreshed_at".padEnd(28),
    "owner".padEnd(10),
    "news",
    "paut%",
    "art",
    "usd~",
    "rank",
  );

  for (const row of rows) {
    const suggestions = Array.isArray(row.suggestions) ? row.suggestions : [];
    const scored = suggestions.map(scoreSuggestionPautavel);
    const news = scored.filter((s) => s.kind === "news");
    const pautavel = news.filter((s) => s.pautavel).length;
    const pct = news.length ? Math.round((pautavel / news.length) * 1000) / 10 : 0;
    const meta = row.meta || {};
    const usd = meta.llmCostEstimate?.estimatedUsd;
    const rank = meta.qualityRankStats?.llmCalls ?? 0;
    const owner = row.ownerUserId ?? row.owner_user_id ?? "";
    const refreshedAt = toIso(row.refreshedAt ?? row.refreshed_at);
    console.log(
      String(refreshedAt).padEnd(28),
      String(owner).slice(0, 8).padEnd(10),
      String(news.length).padStart(4),
      String(pct).padStart(5),
      String(meta.articlesScanned ?? "?").padStart(4),
      String(usd ?? meta.qualityReport?.newsPautavelPercent ?? "-").toString().padStart(6),
      String(rank).padStart(4),
    );
    if (meta.qualityReport) {
      console.log(
        "  meta.qualityReport:",
        `${meta.qualityReport.newsPautavelPercent}% pautavel`,
        `(${meta.qualityReport.newsPautavel}/${meta.qualityReport.newsTotal} news)`,
      );
    }
  }

  if (rows.length === 0) {
    console.log("\nNenhum documento em sentinelSuggestionCache.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
