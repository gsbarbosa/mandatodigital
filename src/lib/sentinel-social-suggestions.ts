import { createHash } from "node:crypto";

import { isSentinelSocialEnabled } from "@/lib/feature-flags";
import { fetchInstagramPostsForUsername, type ApifyInstagramPost } from "@/lib/sentinel-apify-instagram";
import type { MockSentinelSuggestion, SentinelSocialNetwork } from "@/lib/sentinel-mock-suggestions";
import { applyPipelineWeight } from "@/lib/sentinel-pipeline";
import {
  findThemeTermMatches,
  pickPrimaryThemeMatch,
} from "@/lib/sentinel-theme-synonyms";
import {
  computeEngagementGrowthPercent,
  computePostEngagement,
  scoreSocialRelevance,
  type EngagementSample,
} from "@/lib/sentinel-social-engagement";
import type { PoliticianProfile, SocialHandle } from "@/lib/types";

const MAX_PROFILES_PER_LIST = 5;
const POSTS_PER_PROFILE = 5;
const SOCIAL_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

type SocialProfileTarget = SocialHandle & {
  sourceList: "interest" | "opposition";
};

type CachedProfilePosts = {
  expiresAt: number;
  posts: ApifyInstagramPost[];
};

const profilePostsCache = new Map<string, CachedProfilePosts>();

function isInstagramNetwork(network: string) {
  return network.trim().toLowerCase().includes("instagram");
}

function collectInstagramTargets(profile: PoliticianProfile): SocialProfileTarget[] {
  const interest = profile.interestProfiles
    .filter((row) => isInstagramNetwork(row.network) && row.handle.trim())
    .slice(0, MAX_PROFILES_PER_LIST)
    .map((row) => ({ ...row, sourceList: "interest" as const }));

  const opposition = profile.oppositionProfiles
    .filter((row) => isInstagramNetwork(row.network) && row.handle.trim())
    .slice(0, MAX_PROFILES_PER_LIST)
    .map((row) => ({ ...row, sourceList: "opposition" as const }));

  return [...interest, ...opposition];
}

function cacheKey(profileId: string, target: SocialProfileTarget) {
  return `${profileId}:${target.sourceList}:${target.handle.trim().toLowerCase()}`;
}

async function loadPostsForTarget(profileId: string, target: SocialProfileTarget) {
  const key = cacheKey(profileId, target);
  const cached = profilePostsCache.get(key);
  const now = Date.now();

  if (cached && cached.expiresAt > now) {
    return cached.posts;
  }

  const posts = await fetchInstagramPostsForUsername(target.handle, {
    resultsLimit: POSTS_PER_PROFILE,
  });

  profilePostsCache.set(key, {
    posts,
    expiresAt: now + SOCIAL_CACHE_TTL_MS,
  });

  return posts;
}

function buildSuggestionId(postUrl: string) {
  const hash = createHash("sha256").update(`social|${postUrl}`).digest("hex").slice(0, 16);
  return `sentinela-social-${hash}`;
}

function buildTopicLabel(themeLabel: string, handle: string, caption: string) {
  const snippet = caption.trim().replace(/\s+/g, " ").slice(0, 90);
  const prefix = `${themeLabel} · @${handle.replace(/^@+/, "")}`;
  return snippet ? `${prefix}: ${snippet}` : prefix;
}

function buildSuggestionFromPost(input: {
  post: ApifyInstagramPost;
  target: SocialProfileTarget;
  matchedThemes: string[];
  primaryTheme: string;
  growthPercent: number;
}): MockSentinelSuggestion {
  const { post, target, matchedThemes, primaryTheme, growthPercent } = input;
  const themeLabel = primaryTheme;
  const likes = post.likesCount;
  const comments = post.commentsCount;
  const shares = post.sharesCount;
  const baseEngagement = computePostEngagement(likes, comments, shares);
  const baseScore = scoreSocialRelevance({
    baseEngagement,
    growthPercent,
    sourceList: target.sourceList,
    matchedThemeCount: matchedThemes.length,
  });
  const relevanceScore = applyPipelineWeight(baseScore, "social");
  const network: SentinelSocialNetwork = "instagram";
  const handle = post.ownerUsername || target.handle;

  return {
    id: buildSuggestionId(post.url || `${handle}-${post.id}`),
    themeLabel,
    matchedThemes,
    relevanceScore,
    pipeline: "social",
    topic: buildTopicLabel(themeLabel, handle, post.caption),
    evidence: {
      postsAnalyzed: 1,
      outletCount: 1,
      engagementTrendPercent: growthPercent,
      byNetwork: [
        {
          network,
          likes,
          comments,
          shares,
        },
      ],
      actors: [
        {
          handle,
          network,
          postUrl: post.url,
          profileLabel: handle,
          sourceList: target.sourceList,
        },
      ],
      articles: post.url
        ? [
            {
              title: post.caption.slice(0, 160) || `Post de @${handle}`,
              url: post.url,
              sourceName: "Instagram",
              publishedAt: post.timestamp?.toISOString(),
            },
          ]
        : [],
    },
    engagement: {
      relevanceScore,
      scoreTrendPercent: growthPercent,
      likes,
      comments,
      shares,
      postsAnalyzed: 1,
      sources: [network],
      byNetwork: [
        {
          network,
          likes,
          comments,
          shares,
        },
      ],
    },
  };
}

export function mergeSentinelSuggestions(
  batches: MockSentinelSuggestion[][],
  max = 5,
): MockSentinelSuggestion[] {
  const byId = new Map<string, MockSentinelSuggestion>();

  for (const batch of batches) {
    for (const suggestion of batch) {
      const existing = byId.get(suggestion.id);
      if (!existing || suggestion.relevanceScore > existing.relevanceScore) {
        byId.set(suggestion.id, suggestion);
      }
    }
  }

  return [...byId.values()]
    .sort((left, right) => right.relevanceScore - left.relevanceScore)
    .slice(0, max);
}

export async function buildSocialSuggestions(profile: PoliticianProfile) {
  if (!isSentinelSocialEnabled()) {
    return { suggestions: [], profilesScanned: 0, postsScanned: 0 };
  }

  const profileId = profile.id?.trim() || "default";
  const targets = collectInstagramTargets(profile);

  if (targets.length === 0) {
    return { suggestions: [], profilesScanned: 0, postsScanned: 0 };
  }

  const interestThemes = [
    ...profile.sentinelThemes,
    ...profile.customRadarThemes.map((theme) => theme.trim()).filter(Boolean),
  ];
  const oppositionThemes = profile.oppositionThemes;
  const suggestions: MockSentinelSuggestion[] = [];
  let postsScanned = 0;

  for (const target of targets) {
    let posts: ApifyInstagramPost[] = [];

    try {
      posts = await loadPostsForTarget(profileId, target);
    } catch {
      continue;
    }

    postsScanned += posts.length;

    const engagementSamples: EngagementSample[] = posts.map((post) => ({
      timestamp: post.timestamp,
      engagement: computePostEngagement(
        post.likesCount,
        post.commentsCount,
        post.sharesCount,
      ),
    }));
    const growthPercent = computeEngagementGrowthPercent(engagementSamples);

    for (const post of posts) {
      const haystack = post.caption;
      const interestMatches = findThemeTermMatches(haystack, interestThemes);
      const oppositionMatches = findThemeTermMatches(haystack, oppositionThemes);
      const allMatches = [...interestMatches, ...oppositionMatches];
      const matchedThemes = [...new Set(allMatches.map((row) => row.theme))];

      if (matchedThemes.length === 0) {
        continue;
      }

      const primary =
        pickPrimaryThemeMatch(allMatches) ??
        (matchedThemes[0] ? { theme: matchedThemes[0], term: matchedThemes[0] } : null);

      suggestions.push(
        buildSuggestionFromPost({
          post,
          target,
          matchedThemes,
          primaryTheme: primary?.theme ?? matchedThemes[0] ?? "Monitoramento social",
          growthPercent,
        }),
      );
    }
  }

  return {
    suggestions: mergeSentinelSuggestions([suggestions]),
    profilesScanned: targets.length,
    postsScanned,
  };
}

export function clearSentinelSocialCacheForTests() {
  profilePostsCache.clear();
}
