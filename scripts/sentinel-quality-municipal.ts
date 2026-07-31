/**
 * Gate de qualidade municipal do Sentinela (municípios pequenos / interior).
 *
 * Verifica se o refresh devolve reportagens ATUAIS alinhadas aos TEMAS e à REGIÃO.
 *
 * Uso:
 *   npm run sentinel:quality-municipal
 *   SCENARIO=jericoacoara npm run sentinel:quality-municipal
 *   QUERIES_ONLY=1 npm run sentinel:quality-municipal          # só shape das queries (sem rede)
 *   REFRESH=1 npm run sentinel:quality-municipal               # coleta live (~2 min)
 *   CITY="Jijoca de Jericoacoara" STATE=CE REFRESH=1 npm run sentinel:quality-municipal
 *
 * Exit 0 = ok; 1 = falha de qualidade / cobertura.
 */
import fs from "node:fs";
import path from "node:path";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

import {
  buildMunicipalTestProfile,
  evaluateMunicipalFeedQuality,
  evaluateMunicipalQueryShape,
  resolveMunicipalScenario,
  type MunicipalQualityScenario,
} from "../src/lib/sentinel-quality-municipal";
import type { MockSentinelSuggestion } from "../src/lib/sentinel-mock-suggestions";
import { buildSentinelRssQueries } from "../src/lib/sentinel-rss";
import { runWithStorageOwner } from "../src/lib/storage-context";
import {
  getSentinelSuggestions,
  invalidateSentinelMemoryCache,
} from "../src/lib/sentinel-suggestions";
import type { SentinelSuggestionsMeta } from "../src/lib/sentinel-types";
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
    municipalCities: strArr(data.municipalCities),
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

function applyScenarioOverrides(
  base: MunicipalQualityScenario,
): MunicipalQualityScenario {
  const city = process.env.CITY?.trim();
  const state = process.env.STATE?.trim()?.toUpperCase();
  const aliases = process.env.CITY_ALIASES?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!city && !state && !aliases?.length) {
    return base;
  }

  return {
    ...base,
    id: `${(city ?? base.city).toLowerCase().replace(/\s+/g, "-")}-${(state ?? base.state).toLowerCase()}`,
    label: `${city ?? base.city} — ${state ?? base.state}`,
    city: city || base.city,
    state: state || base.state,
    cityAliases: aliases?.length ? aliases : base.cityAliases,
  };
}

async function main() {
  const queriesOnly =
    process.env.QUERIES_ONLY === "1" || process.env.QUERIES_ONLY === "true";
  const forceRefresh =
    process.env.REFRESH === "1" ||
    process.env.REFRESH === "true" ||
    (!queriesOnly && process.env.REFRESH !== "0");

  const scenario = applyScenarioOverrides(resolveMunicipalScenario(process.env.SCENARIO));
  let profile = buildMunicipalTestProfile(scenario);

  console.log(
    JSON.stringify(
      {
        mode: queriesOnly ? "queries-only" : forceRefresh ? "refresh" : "cache",
        scenario: {
          id: scenario.id,
          label: scenario.label,
          city: scenario.city,
          state: scenario.state,
          aliases: scenario.cityAliases,
          themesFederal: scenario.themesFederal,
          themesEstadual: scenario.themesEstadual,
          customThemes: scenario.customThemes,
        },
      },
      null,
      2,
    ),
  );

  const queries = buildSentinelRssQueries(profile);
  const queryShape = evaluateMunicipalQueryShape(queries, scenario);

  if (queriesOnly) {
    console.log(
      JSON.stringify(
        {
          ok: queryShape.ok,
          failures: queryShape.failures,
          expectedGeo: queryShape.expectedGeo,
          queryCount: queries.length,
          queries: queryShape.sample,
        },
        null,
        2,
      ),
    );
    process.exit(queryShape.ok ? 0 : 1);
  }

  process.env.SENTINEL_LLM_QUALITY_RANK ??= "true";
  process.env.SENTINEL_V2_PIPELINES ??= "true";
  process.env.SENTINEL_LLM_THEME_VERIFY ??= "true";
  // Evita poluir cache de contas reais com o perfil sintético municipal.
  process.env.SENTINEL_PERSIST_CACHE ??= "false";

  const db = initAdmin();
  const baseProfileId =
    process.env.PROFILE_ID?.trim() || "ae8fed6f-0f09-4805-a47d-36d93f05e023";
  const snap = await db.collection("politicianProfiles").doc(baseProfileId).get();
  if (!snap.exists) {
    throw new Error(
      `Perfil base nao encontrado: ${baseProfileId} (precisa de ownerUserId p/ storage).`,
    );
  }
  const raw = snap.data() as Record<string, unknown>;
  const ownerUserId =
    process.env.OWNER_USER_ID?.trim() || String(raw.ownerUserId ?? baseProfileId);

  // Reusa id do perfil base só para storage/owner; radar fica 100% do cenário municipal.
  const baseMapped = mapProfile(baseProfileId, raw);
  profile = buildMunicipalTestProfile(scenario, {
    id: baseProfileId,
    fullName: baseMapped.fullName || profile.fullName,
    notificationEmail: baseMapped.notificationEmail,
  });

  const requireCityHit =
    process.env.REQUIRE_CITY_HIT === "1" ||
    process.env.REQUIRE_CITY_HIT === "true" ||
    process.env.REQUIRE_CITY_HIT === undefined;
  // Soft por default em município muito pequeno: falha hard só se REGIONAL também faltar.
  const softCity =
    process.env.SOFT_CITY === "1" || process.env.SOFT_CITY === "true";

  let suggestions: MockSentinelSuggestion[] = [];
  let meta: SentinelSuggestionsMeta | null = null;
  let source = "cache";
  const started = Date.now();

  if (forceRefresh) {
    invalidateSentinelMemoryCache(baseProfileId);
    source = "refresh";
    const result = await runWithStorageOwner(ownerUserId, () =>
      getSentinelSuggestions(profile, {
        forceRefresh: true,
        qualityRankEnabled: process.env.QUALITY_RANK !== "false",
      }),
    );
    suggestions = result.suggestions;
    meta = result.meta;
  } else {
    const cacheSnap = await db
      .collection("sentinelSuggestionCache")
      .doc(baseProfileId)
      .get();
    if (!cacheSnap.exists) {
      throw new Error("Cache ausente. Rode com REFRESH=1 (default) ou PROFILE_ID válido.");
    }
    const row = cacheSnap.data()!;
    suggestions = (row.suggestions ?? []) as MockSentinelSuggestion[];
    meta = (row.meta ?? null) as SentinelSuggestionsMeta | null;
    source = `cache:${baseProfileId}`;
  }

  const elapsedMs = Date.now() - started;
  const report = evaluateMunicipalFeedQuality(
    { suggestions, meta, profile, scenario, queries },
    {
      maxAgeDays: Number(process.env.MAX_AGE_DAYS ?? 14),
      minCards: Number(process.env.MIN_CARDS ?? 2),
      minRegionalHits: Number(process.env.MIN_REGIONAL_HITS ?? 1),
      minCityHits: Number(process.env.MIN_CITY_HITS ?? 1),
      requireCityHit: softCity ? false : requireCityHit,
      minThemeAlignmentRatio: Number(process.env.MIN_THEME_RATIO ?? 0.4),
    },
  );

  console.log(
    JSON.stringify(
      {
        source,
        elapsedMs,
        ok: report.ok,
        failures: report.failures,
        warnings: report.warnings,
        stats: report.stats,
        queryShape: {
          ok: report.queryShape.ok,
          expectedGeo: report.queryShape.expectedGeo,
          sample: report.queryShape.sample,
        },
        metaSnippet: {
          refreshedAt: meta?.refreshedAt,
          articlesScanned: meta?.articlesScanned,
          portalsMonitored: meta?.portalsMonitored,
          qualityRankStats: meta?.qualityRankStats,
          themeVerificationStats: meta?.themeVerificationStats,
          qualityReport: meta?.qualityReport,
          llmCostEstimate: meta?.llmCostEstimate,
        },
        cards: report.cards.slice(0, 15),
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
