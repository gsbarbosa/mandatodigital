/**
 * Roda o pipeline do Sentinela localmente (sem cookie HTTP).
 * Uso:
 *   npx vite-node --config vitest.config.ts scripts/sentinel-refresh-local.ts
 *
 * Vars: PROFILE_ID (opcional), OWNER_USER_ID (opcional), QUALITY_RANK=true|false
 */
import fs from "node:fs";
import path from "node:path";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

import { runWithStorageOwner } from "../src/lib/storage-context";
import { getSentinelSuggestions, invalidateSentinelMemoryCache } from "../src/lib/sentinel-suggestions";
import type { PoliticianProfile } from "../src/lib/types";

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    return;
  }
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    if (!line || line.startsWith("#") || !line.includes("=")) {
      continue;
    }
    const i = line.indexOf("=");
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
      // JSON embutido como string escapada: "{\"type\":...}"
      if (value.startsWith("{") || value.startsWith("[")) {
        try {
          value = JSON.parse(`"${value.replace(/"/g, '\\"')}"`);
        } catch {
          value = value.replace(/\\n/g, "\n").replace(/\\"/g, '"');
        }
      } else {
        value = value.replace(/\\n/g, "\n").replace(/\\"/g, '"');
      }
    }
    if (!(key in process.env) || !String(process.env[key] ?? "").trim()) {
      process.env[key] = value;
    }
  }
}

loadEnvLocal();

function readFirebaseServiceAccount() {
  const fromEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (fromEnv) {
    try {
      return JSON.parse(fromEnv);
    } catch {
      // node --env-file às vezes corrompe aspas do JSON; lê do arquivo.
    }
  }

  const envPath = path.join(process.cwd(), ".env.local");
  const line = fs
    .readFileSync(envPath, "utf8")
    .split("\n")
    .find((row) => row.startsWith("FIREBASE_SERVICE_ACCOUNT_JSON="));
  if (!line) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON ausente (.env.local).");
  }
  let value = line.slice("FIREBASE_SERVICE_ACCOUNT_JSON=".length);
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = JSON.parse(value);
  }
  return typeof value === "string" ? JSON.parse(value) : value;
}

function initAdmin() {
  if (getApps().length) {
    return getFirestore();
  }
  initializeApp({
    credential: cert(readFirebaseServiceAccount()),
  });
  return getFirestore();
}

function mapProfile(id: string, data: Record<string, unknown>): PoliticianProfile {
  const strArr = (value: unknown) =>
    Array.isArray(value) ? value.map((item) => String(item)) : [];

  return {
    id,
    fullName: String(data.fullName ?? ""),
    role: String(data.role ?? ""),
    city: String(data.city ?? ""),
    state: String(data.state ?? ""),
    audience: String(data.audience ?? ""),
    spectrum: String(data.spectrum ?? ""),
    archetype: String(data.archetype ?? ""),
    voiceTones: strArr(data.voiceTones),
    keyIssues: strArr(data.keyIssues),
    slogans: strArr(data.slogans),
    redLines: strArr(data.redLines),
    referenceExamples: strArr(data.referenceExamples),
    bio: String(data.bio ?? ""),
    personaArchetypes: strArr(data.personaArchetypes),
    sentinelThemes: strArr(data.sentinelThemes),
    sentinelThemesFederal: strArr(data.sentinelThemesFederal),
    sentinelThemesEstadual: strArr(data.sentinelThemesEstadual),
    oppositionThemes: strArr(data.oppositionThemes),
    customRadarThemes: strArr(data.customRadarThemes),
    interestProfiles: Array.isArray(data.interestProfiles)
      ? (data.interestProfiles as PoliticianProfile["interestProfiles"])
      : [],
    interestSites: strArr(data.interestSites),
    oppositionProfiles: Array.isArray(data.oppositionProfiles)
      ? (data.oppositionProfiles as PoliticianProfile["oppositionProfiles"])
      : [],
    oppositionSites: strArr(data.oppositionSites),
    glossaryTerms: Array.isArray(data.glossaryTerms)
      ? (data.glossaryTerms as PoliticianProfile["glossaryTerms"])
      : [],
    trainingReferenceLinks: strArr(data.trainingReferenceLinks),
    youtubeVideoUrl: String(data.youtubeVideoUrl ?? ""),
    avatarType: String(data.avatarType ?? ""),
    avatarVideoTopic: String(data.avatarVideoTopic ?? ""),
    notificationEmail: String(data.notificationEmail ?? ""),
    avatarEmotions: strArr(data.avatarEmotions),
    voicePace: String(data.voicePace ?? ""),
    editingStyles: strArr(data.editingStyles),
    factCheckingSources: strArr(data.factCheckingSources),
    hardDataSources: strArr(data.hardDataSources),
    distributionChannels: strArr(data.distributionChannels),
    distributionWindows: strArr(data.distributionWindows),
    autoPublish: Boolean(data.autoPublish),
    updatedAt: String(data.updatedAt ?? new Date().toISOString()),
  };
}

async function main() {
  process.env.SENTINEL_LLM_QUALITY_RANK ??= "true";
  process.env.SENTINEL_V2_PIPELINES ??= "true";
  process.env.SENTINEL_LLM_THEME_VERIFY ??= "true";
  // Garante OpenAI key etc. via loadEnvLocal; SA via readFirebaseServiceAccount.
  if (!process.env.OPENAI_API_KEY?.trim() && !process.env.ANTHROPIC_API_KEY?.trim()) {
    console.warn("Aviso: sem OPENAI_API_KEY/ANTHROPIC_API_KEY o quality rank pode falhar abertamente.");
  }

  const db = initAdmin();
  const profileId =
    process.env.PROFILE_ID?.trim() || "ae8fed6f-0f09-4805-a47d-36d93f05e023";

  const snap = await db.collection("politicianProfiles").doc(profileId).get();
  if (!snap.exists) {
    throw new Error(`Perfil nao encontrado: ${profileId}`);
  }

  const raw = snap.data()!;
  const ownerUserId =
    process.env.OWNER_USER_ID?.trim() || String(raw.ownerUserId ?? profileId);
  const profile = mapProfile(profileId, raw);

  // Temas podem viver só no radar do dashboard — se perfil estiver vazio, usa fallback da amostra.
  if (
    !(profile.sentinelThemes?.length ||
      profile.sentinelThemesFederal?.length ||
      profile.sentinelThemesEstadual?.length ||
      profile.customRadarThemes?.length)
  ) {
    profile.sentinelThemesEstadual = [
      "Desemprego",
      "Carga Tributária",
      "Contratos Públicos",
      "Valorização Policial",
      "Combate a Fake News",
    ];
    console.log("Perfil sem temas no doc — usando fallback de teste MG.");
  }

  const qualityRankEnabled = process.env.QUALITY_RANK !== "false";
  console.log("Iniciando refresh...", { profileId, ownerUserId, qualityRankEnabled });

  invalidateSentinelMemoryCache(profileId);

  const started = Date.now();
  const result = await runWithStorageOwner(ownerUserId, () =>
    getSentinelSuggestions(profile, {
      forceRefresh: true,
      qualityRankEnabled,
    }),
  );
  const elapsedMs = Date.now() - started;

  const themes: Record<string, number> = {};
  for (const s of result.suggestions) {
    themes[s.themeLabel] = (themes[s.themeLabel] ?? 0) + 1;
  }

  console.log(
    JSON.stringify(
      {
        elapsedMs,
        count: result.suggestions.length,
        themes,
        withBriefing: result.suggestions.filter((s) => s.briefing?.trim()).length,
        withAngle: result.suggestions.filter((s) => s.creativeAngle?.trim()).length,
        meta: {
          qualityRankStats: result.meta.qualityRankStats,
          qualityReport: result.meta.qualityReport,
          llmCostEstimate: result.meta.llmCostEstimate,
          themeVerificationStats: result.meta.themeVerificationStats,
          articlesScanned: result.meta.articlesScanned,
        },
        top5: result.suggestions.slice(0, 5).map((s) => ({
          theme: s.themeLabel,
          title: s.evidence.articles?.[0]?.title?.slice(0, 90),
          briefing: s.briefing?.slice(0, 120),
          angle: s.creativeAngle?.slice(0, 80),
          topic: s.topic.slice(0, 100),
        })),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
