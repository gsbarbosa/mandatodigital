import { createHash } from "node:crypto";

import type {
  MockSentinelSuggestion,
  SentinelSocialNetwork,
  SentinelVerifiedActor,
} from "@/lib/sentinel-mock-suggestions";
import { buildInterestPostSuggestions } from "@/lib/sentinel-opposition-posts";
import { fetchGoogleNewsQuery } from "@/lib/sentinel-rss";
import { weightedEngagement } from "@/lib/sphere-classifier";
import type { PoliticianProfile, SocialHandle } from "@/lib/types";

const MAX_SOCIAL_SUGGESTIONS = 12;

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

function isInstagramProfile(row: SocialHandle) {
  const network = row.network.trim().toLowerCase();
  return network.includes("instagram") || network === "ig";
}

function buildSocialSuggestionId(handle: string, link: string) {
  const hash = createHash("sha256").update(`social|${handle}|${link}`).digest("hex").slice(0, 16);
  return `sentinela-social-${hash}`;
}

function buildActor(
  row: SocialHandle,
  sourceList: "interest" | "opposition",
  link: string,
  publishedAt?: string,
): SentinelVerifiedActor {
  return {
    handle: normalizeHandle(row.handle),
    network: normalizeNetwork(row.network),
    postUrl: link,
    profileLabel: row.network,
    sourceList,
    publishedAt,
  };
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

function publishedAtMs(suggestion: MockSentinelSuggestion): number {
  const fromActor = suggestion.evidence.actors?.[0]?.publishedAt;
  const fromArticle = suggestion.evidence.articles?.[0]?.publishedAt;
  const raw = fromActor || fromArticle;
  if (!raw) {
    return 0;
  }
  const ms = new Date(raw).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function sortByEngagementThenRecency(suggestions: MockSentinelSuggestion[]) {
  return [...suggestions].sort((left, right) => {
    const leftEng = weightedEngagement(
      left.engagement.likes,
      left.engagement.comments,
      left.engagement.shares,
    );
    const rightEng = weightedEngagement(
      right.engagement.likes,
      right.engagement.comments,
      right.engagement.shares,
    );
    if (rightEng !== leftEng) {
      return rightEng - leftEng;
    }
    return publishedAtMs(right) - publishedAtMs(left);
  });
}

/**
 * Fallback para redes sem fetch de posts (TikTok/X): Google News pelo @,
 * sem cruzar temas do radar. Sem engajamento real → ordena por data.
 */
async function buildInterestNewsFallbacks(
  profile: PoliticianProfile,
  rows: SocialHandle[],
): Promise<MockSentinelSuggestion[]> {
  const geo = [profile.city.trim(), profile.state.trim()].filter(Boolean).join(" ");
  const suggestions: MockSentinelSuggestion[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const handle = normalizeHandle(row.handle);
    if (!handle) {
      continue;
    }

    const queries = buildSocialQueries(row, geo);
    const batches = await Promise.all(queries.map((query) => fetchGoogleNewsQuery(query)));
    const items = batches.flat();

    for (const item of items) {
      const key = `${handle}|${item.link}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      const publishedAt = item.pubDate ?? item.publishedAt?.toISOString();
      const actor = buildActor(row, "interest", item.link, publishedAt);
      const themeLabel = `@${handle}`;
      const relevanceScore = 40;

      suggestions.push({
        id: buildSocialSuggestionId(handle, item.link),
        themeLabel,
        matchedThemes: [themeLabel],
        relevanceScore,
        pipeline: "social",
        topic: `@${handle} · ${item.title.slice(0, 100)}`,
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
              publishedAt,
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

  return suggestions;
}

export async function buildSocialSentinelSuggestions(
  profile: PoliticianProfile,
): Promise<MockSentinelSuggestion[]> {
  const rows = profile.interestProfiles.filter((row) => row.handle.trim());
  if (!rows.length) {
    return [];
  }

  const instagramRows = rows.filter(isInstagramProfile);
  const otherRows = rows.filter((row) => !isInstagramProfile(row));

  const [instagramSuggestions, newsFallbacks] = await Promise.all([
    buildInterestPostSuggestions({
      ...profile,
      interestProfiles: instagramRows,
    }),
    buildInterestNewsFallbacks(profile, otherRows),
  ]);

  return sortByEngagementThenRecency([...instagramSuggestions, ...newsFallbacks]).slice(
    0,
    MAX_SOCIAL_SUGGESTIONS,
  );
}
