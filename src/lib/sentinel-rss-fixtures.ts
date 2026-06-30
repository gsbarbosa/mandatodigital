import { readFileSync } from "node:fs";
import path from "node:path";

import { parseRssFeed, type RssNewsItem } from "@/lib/sentinel-rss";
import { normalizeSentinelText } from "@/lib/sentinel-text";
import type { PoliticianProfile } from "@/lib/types";

export type SentinelFixtureManifest = {
  capturedAt: string;
  source: string;
  profile: Pick<
    PoliticianProfile,
    "city" | "state" | "sentinelThemes" | "oppositionThemes" | "customRadarThemes"
  >;
  feeds: Array<{ query: string; file: string }>;
};

const FIXTURE_ROOT = path.join(process.cwd(), "tests", "fixtures", "sentinel");
const RSS_DIR = path.join(FIXTURE_ROOT, "rss");

let cachedManifest: SentinelFixtureManifest | null = null;

export function loadSentinelFixtureManifest(): SentinelFixtureManifest {
  if (cachedManifest) {
    return cachedManifest;
  }

  const raw = readFileSync(path.join(FIXTURE_ROOT, "manifest.json"), "utf8");
  cachedManifest = JSON.parse(raw) as SentinelFixtureManifest;
  return cachedManifest;
}

export function readSentinelFixtureXml(filename: string) {
  return readFileSync(path.join(RSS_DIR, filename), "utf8");
}

function normalizeQuery(query: string) {
  return normalizeSentinelText(decodeURIComponent(query.replace(/\+/g, " ")));
}

export function resolveSentinelFixtureFileForRssUrl(url: string) {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (!parsed.hostname.includes("news.google.com") || !parsed.pathname.includes("/rss/search")) {
    return null;
  }

  const query = parsed.searchParams.get("q");
  if (!query) {
    return null;
  }

  const normalizedRequest = normalizeQuery(query);
  const manifest = loadSentinelFixtureManifest();

  for (const feed of manifest.feeds) {
    if (normalizeQuery(feed.query) === normalizedRequest) {
      return feed.file;
    }
  }

  return null;
}

export function createSentinelFixtureFetch(): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    const fixtureFile = resolveSentinelFixtureFileForRssUrl(url);

    if (!fixtureFile) {
      return new Response("Not found", { status: 404, statusText: "Fixture missing" });
    }

    const xml = readSentinelFixtureXml(fixtureFile);
    return new Response(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        ...(init?.headers instanceof Headers ? Object.fromEntries(init.headers.entries()) : {}),
      },
    });
  };
}

export function loadAllSentinelFixtureArticles(): RssNewsItem[] {
  const manifest = loadSentinelFixtureManifest();
  const seen = new Set<string>();
  const articles: RssNewsItem[] = [];

  for (const feed of manifest.feeds) {
    const items = parseRssFeed(readSentinelFixtureXml(feed.file)).map((item) => ({
      ...item,
      origin: "google-news" as const,
    }));

    for (const item of items) {
      const key = `${normalizeSentinelText(item.title)}|${item.link}`;
      if (!normalizeSentinelText(item.title) || seen.has(key)) {
        continue;
      }
      seen.add(key);
      articles.push(item);
    }
  }

  return articles;
}

export function buildSentinelFixtureProfile(
  overrides: Partial<PoliticianProfile> = {},
): PoliticianProfile {
  const manifest = loadSentinelFixtureManifest();

  return {
    id: "sentinel-fixture-profile",
    fullName: "Perfil Fixture Sentinela",
    role: "Vereador",
    city: manifest.profile.city,
    state: manifest.profile.state,
    audience: "Eleitorado local",
    spectrum: "Centro",
    archetype: "O Conciliador (Uniao/Pontes)",
    voiceTones: [],
    keyIssues: ["Saude"],
    slogans: [],
    redLines: [],
    referenceExamples: [],
    bio: "Bio de teste com mais de vinte caracteres para validacao do Sentinela.",
    personaArchetypes: [],
    sentinelThemes: [...manifest.profile.sentinelThemes],
    oppositionThemes: [...manifest.profile.oppositionThemes],
    customRadarThemes: [...manifest.profile.customRadarThemes],
    interestProfiles: [],
    interestSites: [],
    oppositionProfiles: [],
    oppositionSites: [],
    glossaryTerms: [],
    trainingReferenceLinks: [],
    youtubeVideoUrl: "",
    avatarType: "",
    avatarVideoTopic: "",
    argilAvatarId: "",
    argilVoiceId: "",
    avatarTrainingStatus: "",
    notificationEmail: "",
    avatarEmotions: [],
    voicePace: "Manter velocidade original",
    editingStyles: [],
    factCheckingSources: [],
    hardDataSources: [],
    distributionChannels: [],
    distributionWindows: [],
    autoPublish: false,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}
