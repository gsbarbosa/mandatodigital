import { createHash } from "node:crypto";

import type {
  MockSentinelSuggestion,
  SentinelSocialNetwork,
  SentinelVerifiedActor,
} from "@/lib/sentinel-mock-suggestions";
import { splitProfileThemesBySphere } from "@/lib/sentinel-profile-themes";
import { buildGoogleNewsRssUrl, matchSentinelThemes, parseRssFeed } from "@/lib/sentinel-rss";
import type { PoliticianProfile, SocialHandle } from "@/lib/types";

const RSS_FETCH_TIMEOUT_MS = 12_000;
const MAX_SOCIAL_SUGGESTIONS = 8;

function normalizeNetwork(network: string): SentinelSocialNetwork {
  const value = network.trim().toLowerCase();
  if (value.includes("tiktok")) {
    return "tiktok";
  }
  if (value.includes("twitter") || value === "x" || value.includes("x /")) {
    return "x";
  }
  return "instagram";
}

function normalizeHandle(handle: string): string {
  return handle.trim().replace(/^@+/, "");
}

function buildSocialSuggestionId(handle: string, link: string) {
  const hash = createHash("sha256").update(`social|${handle}|${link}`).digest("hex").slice(0, 16);
  return `sentinela-social-${hash}`;
}

function buildActor(
  row: SocialHandle,
  sourceList: "interest" | "opposition",
  link: string,
): SentinelVerifiedActor {
  return {
    handle: normalizeHandle(row.handle),
    network: normalizeNetwork(row.network),
    postUrl: link,
    profileLabel: row.network,
    sourceList,
  };
}

async function fetchGoogleNewsRss(query: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RSS_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(buildGoogleNewsRssUrl(query), {
      headers: {
        Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
        "User-Agent": "MandatoDigital-Sentinela/1.0",
      },
      signal: controller.signal,
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      return [];
    }

    const xml = await response.text();
    return parseRssFeed(xml);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

function buildSocialQueries(row: SocialHandle, geo: string): string[] {
  const handle = normalizeHandle(row.handle);
  if (!handle) {
    return [];
  }

  const network = row.network.trim();
  const queries = [`"@${handle}"`, `${handle} ${network}`, `${handle} ${geo}`.trim()];

  return [...new Set(queries.filter((query) => query.replace(/\s/g, "").length >= 3))].slice(0, 2);
}

function scoreSocialSuggestion(input: {
  matchedThemes: string[];
  publishedAt: Date | null;
  sourceList: "interest" | "opposition";
}): number {
  let score = input.sourceList === "opposition" ? 55 : 45;
  score += input.matchedThemes.length * 12;

  if (input.publishedAt) {
    const ageHours = (Date.now() - input.publishedAt.getTime()) / 3_600_000;
    if (ageHours <= 24) {
      score += 18;
    } else if (ageHours <= 72) {
      score += 10;
    }
  }

  return Math.min(99, Math.max(20, score));
}

async function buildSuggestionsForProfiles(input: {
  profiles: SocialHandle[];
  sourceList: "interest" | "opposition";
  profile: PoliticianProfile;
  matchThemes: string[];
}): Promise<MockSentinelSuggestion[]> {
  const geo = [input.profile.city.trim(), input.profile.state.trim()].filter(Boolean).join(" ");
  const suggestions: MockSentinelSuggestion[] = [];
  const seen = new Set<string>();

  for (const row of input.profiles) {
    const handle = normalizeHandle(row.handle);
    if (!handle) {
      continue;
    }

    const queries = buildSocialQueries(row, geo);
    const batches = await Promise.all(queries.map((query) => fetchGoogleNewsRss(query)));
    const items = batches.flat();

    for (const item of items) {
      const key = `${handle}|${item.link}`;
      if (seen.has(key)) {
        continue;
      }

      const haystack = `${item.title} ${handle} ${item.sourceName ?? ""}`;
      const matchedThemes =
        input.sourceList === "opposition"
          ? matchSentinelThemes(haystack, input.matchThemes).length > 0
            ? matchSentinelThemes(haystack, input.matchThemes)
            : [handle]
          : matchSentinelThemes(haystack, input.matchThemes);

      if (input.sourceList === "interest" && matchedThemes.length === 0) {
        continue;
      }

      seen.add(key);
      const actor = buildActor(row, input.sourceList, item.link);
      const relevanceScore = scoreSocialSuggestion({
        matchedThemes,
        publishedAt: item.publishedAt,
        sourceList: input.sourceList,
      });

      suggestions.push({
        id: buildSocialSuggestionId(handle, item.link),
        themeLabel: matchedThemes[0] ?? handle,
        matchedThemes,
        relevanceScore,
        pipeline: "social",
        topic: `${handle} · ${item.title.slice(0, 100)}`,
        evidence: {
          postsAnalyzed: 1,
          outletCount: 1,
          engagementTrendPercent: 0,
          byNetwork: [
            {
              network: actor.network,
              likes: 0,
              comments: 0,
              shares: 0,
            },
          ],
          actors: [actor],
          articles: [
            {
              title: item.title,
              url: item.link,
              sourceName: item.sourceName,
              publishedAt: item.pubDate ?? undefined,
            },
          ],
        },
        engagement: {
          relevanceScore,
          scoreTrendPercent: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          postsAnalyzed: 1,
          sources: [actor.network],
          byNetwork: [
            {
              network: actor.network,
              likes: 0,
              comments: 0,
              shares: 0,
            },
          ],
        },
      });
    }
  }

  return suggestions
    .sort((left, right) => right.relevanceScore - left.relevanceScore)
    .slice(0, MAX_SOCIAL_SUGGESTIONS);
}

export async function buildSocialSentinelSuggestions(
  profile: PoliticianProfile,
): Promise<MockSentinelSuggestion[]> {
  const themes = splitProfileThemesBySphere(profile);

  return buildSuggestionsForProfiles({
    profiles: profile.interestProfiles,
    sourceList: "interest",
    profile,
    matchThemes: themes.interest,
  });
}
