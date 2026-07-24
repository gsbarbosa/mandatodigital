/**
 * Gate de qualidade do Sentinela (sem browser).
 *
 * Uso:
 *   npm run sentinel:quality-gate
 *   PROFILE_ID=... npm run sentinel:quality-gate
 *   REFRESH=1 npm run sentinel:quality-gate   # força coleta+rank (caro/~2min)
 *
 * Exit 0 = ok; 1 = regressão de qualidade.
 */
import fs from "node:fs";
import path from "node:path";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

import { evaluateSentinelFeedQuality } from "../src/lib/sentinel-quality-assertions";
import { runWithStorageOwner } from "../src/lib/storage-context";
import {
  getSentinelSuggestions,
  invalidateSentinelMemoryCache,
} from "../src/lib/sentinel-suggestions";
import type { PoliticianProfile } from "../src/lib/types";
import type { MockSentinelSuggestion } from "../src/lib/sentinel-mock-suggestions";
import type { SentinelSuggestionsMeta } from "../src/lib/sentinel-types";

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
      value = value.slice(1, -1).replace(/\\n/g, "\n").replace(/\\"/g, '"');
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
      // continua no arquivo
    }
  }
  const line = fs
    .readFileSync(path.join(process.cwd(), ".env.local"), "utf8")
    .split("\n")
    .find((row) => row.startsWith("FIREBASE_SERVICE_ACCOUNT_JSON="));
  if (!line) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON ausente");
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
  if (!getApps().length) {
    initializeApp({ credential: cert(readFirebaseServiceAccount()) });
  }
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
    state: String(data.state ?? "MG"),
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

  const db = initAdmin();
  const forceRefresh = process.env.REFRESH === "1" || process.env.REFRESH === "true";
  const expectRank =
    process.env.EXPECT_RANK === "1" ||
    process.env.EXPECT_RANK === "true" ||
    forceRefresh;

  let suggestions: MockSentinelSuggestion[] = [];
  let meta: SentinelSuggestionsMeta | null = null;
  let source = "cache";

  if (forceRefresh) {
    const profileId =
      process.env.PROFILE_ID?.trim() || "ae8fed6f-0f09-4805-a47d-36d93f05e023";
    const snap = await db.collection("politicianProfiles").doc(profileId).get();
    if (!snap.exists) {
      throw new Error(`Perfil nao encontrado: ${profileId}`);
    }
    const raw = snap.data() as Record<string, unknown>;
    const ownerUserId =
      process.env.OWNER_USER_ID?.trim() || String(raw.ownerUserId ?? profileId);
    const profile = mapProfile(profileId, raw);
    if (
      !(
        profile.sentinelThemes.length ||
        profile.sentinelThemesFederal?.length ||
        profile.sentinelThemesEstadual?.length ||
        profile.customRadarThemes.length
      )
    ) {
      profile.sentinelThemesEstadual = [
        "Desemprego",
        "Carga Tributária",
        "Contratos Públicos",
        "Valorização Policial",
      ];
    }
    invalidateSentinelMemoryCache(profileId);
    source = "refresh";
    const result = await runWithStorageOwner(ownerUserId, () =>
      getSentinelSuggestions(profile, {
        forceRefresh: true,
        qualityRankEnabled: true,
      }),
    );
    suggestions = result.suggestions;
    meta = result.meta;
  } else {
    const snap = await db
      .collection("sentinelSuggestionCache")
      .orderBy("refreshedAt", "desc")
      .limit(1)
      .get();
    if (snap.empty) {
      throw new Error("Nenhum cache em sentinelSuggestionCache. Rode com REFRESH=1.");
    }
    const row = snap.docs[0]!.data();
    suggestions = (row.suggestions ?? []) as MockSentinelSuggestion[];
    meta = (row.meta ?? null) as SentinelSuggestionsMeta | null;
    source = `cache:${snap.docs[0]!.id}`;
  }

  const report = evaluateSentinelFeedQuality(
    { suggestions, meta },
    { expectQualityRank: expectRank },
  );

  console.log(
    JSON.stringify(
      {
        source,
        ok: report.ok,
        failures: report.failures,
        stats: report.stats,
        metaSnippet: {
          refreshedAt: meta?.refreshedAt,
          qualityRankStats: meta?.qualityRankStats,
          qualityReport: meta?.qualityReport,
        },
      },
      null,
      2,
    ),
  );

  if (!report.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
