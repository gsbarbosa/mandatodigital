#!/usr/bin/env node
/**
 * Eval offline da spike de qualidade — lê caches do Supabase e aplica a heurística.
 * Uso: npm run sentinel:quality-eval
 * Requer NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY no .env.local
 *
 * Mantém a fórmula alinhada a src/lib/sentinel-quality.ts (testes unitários são a fonte da verdade).
 */
const fs = require("fs");
const path = require("path");

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
  if ((suggestion.matchedThemes?.length ?? 0) >= 2) score += 0.05;
  const final = Math.max(0, Math.min(1, score));
  return { kind: "news", score: final, pautavel: final >= THRESHOLD };
}

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env.local");
    process.exit(1);
  }

  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const res = await fetch(
    `${url}/rest/v1/sentinel_suggestion_cache?select=owner_user_id,profile_id,refreshed_at,meta,suggestions&order=refreshed_at.desc&limit=15`,
    { headers },
  );
  const rows = await res.json();
  if (!Array.isArray(rows)) {
    console.error(rows);
    process.exit(1);
  }

  console.log("Spike Sentinela qualidade — eval de cache\n");
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
    console.log(
      String(row.refreshed_at || "").padEnd(28),
      String(row.owner_user_id || "").slice(0, 8).padEnd(10),
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
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
