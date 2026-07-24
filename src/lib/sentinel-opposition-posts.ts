import { createHash } from "node:crypto";

import {
  fetchInstagramProfilePosts,
  isApifyConfigured,
  isInstagramFeedPost,
  normalizeInstagramHandle,
  type InstagramProfilePost,
} from "@/lib/sentinel-instagram-posts";
import { isSentinelSocialEnabled } from "@/lib/feature-flags";
import type {
  MockSentinelSuggestion,
  SentinelVerifiedActor,
} from "@/lib/sentinel-mock-suggestions";
import { weightedEngagement } from "@/lib/sphere-classifier";
import type { PoliticianProfile, SocialHandle } from "@/lib/types";

const MAX_OPPOSITION_SUGGESTIONS = 12;
const MAX_INTEREST_SUGGESTIONS = 12;
const MAX_POSTS_PER_PROFILE = 12;

function buildProfilePostSuggestionId(
  sourceList: "interest" | "opposition",
  handle: string,
  postUrl: string,
) {
  const hash = createHash("sha256")
    .update(`${sourceList}|${handle}|${postUrl}`)
    .digest("hex")
    .slice(0, 16);
  return `sentinela-${sourceList}-${hash}`;
}

function buildActor(
  row: SocialHandle,
  post: InstagramProfilePost,
  sourceList: "interest" | "opposition",
): SentinelVerifiedActor {
  return {
    handle: normalizeInstagramHandle(row.handle),
    network: "instagram",
    postUrl: post.url,
    profileLabel: row.network,
    sourceList,
    publishedAt: post.publishedAt ?? undefined,
  };
}

function captionHeadline(caption: string, handle: string) {
  const trimmed = caption.trim();
  if (trimmed) {
    return trimmed.length > 180 ? `${trimmed.slice(0, 177)}...` : trimmed;
  }
  return `Novo post de @${handle}`;
}

function defaultThemeLabel(handle: string) {
  return `@${handle}`;
}

function suggestionFromPost(input: {
  row: SocialHandle;
  post: InstagramProfilePost;
  sourceList: "interest" | "opposition";
}): MockSentinelSuggestion | null {
  const handle = normalizeInstagramHandle(input.row.handle);
  if (!handle || !isInstagramFeedPost(input.post)) {
    return null;
  }

  const likes = input.post.likes;
  const comments = input.post.comments;
  const shares = input.post.shares;
  const engagement = weightedEngagement(likes, comments, shares);
  // relevanceScore fica alinhado ao engajamento para ordenação/UI sem cruzar temas.
  const relevanceScore = Math.min(99, Math.max(20, Math.round(30 + Math.log10(engagement + 1) * 22)));
  const themeLabel = defaultThemeLabel(handle);
  const actor = buildActor(input.row, input.post, input.sourceList);
  const headline = captionHeadline(input.post.caption, handle);

  return {
    id: buildProfilePostSuggestionId(input.sourceList, handle, input.post.url),
    themeLabel,
    matchedThemes: [themeLabel],
    relevanceScore,
    pipeline: "social",
    topic: `@${handle} · ${headline}`,
    evidence: {
      postsAnalyzed: 1,
      outletCount: 1,
      engagementTrendPercent: 0,
      byNetwork: [
        {
          network: "instagram",
          likes,
          comments,
          shares,
        },
      ],
      actors: [actor],
      articles: [],
    },
    engagement: {
      relevanceScore,
      scoreTrendPercent: 0,
      likes,
      comments,
      shares,
      postsAnalyzed: 1,
      sources: ["instagram"],
      byNetwork: [
        {
          network: "instagram",
          likes,
          comments,
          shares,
        },
      ],
    },
  };
}

function isInstagramProfile(row: SocialHandle) {
  const network = row.network.trim().toLowerCase();
  return network.includes("instagram") || network === "ig";
}

function publishedAtMs(suggestion: MockSentinelSuggestion): number {
  const raw = suggestion.evidence.actors?.[0]?.publishedAt;
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

export async function buildInstagramProfilePostSuggestions(input: {
  profiles: SocialHandle[];
  sourceList: "interest" | "opposition";
  maxSuggestions: number;
}): Promise<MockSentinelSuggestion[]> {
  const profiles = input.profiles.filter((row) => row.handle.trim() && isInstagramProfile(row));

  if (!profiles.length || !isApifyConfigured()) {
    return [];
  }

  const suggestions: MockSentinelSuggestion[] = [];
  const seen = new Set<string>();

  for (const row of profiles) {
    const handle = normalizeInstagramHandle(row.handle);
    const posts = await fetchInstagramProfilePosts(handle, MAX_POSTS_PER_PROFILE);

    for (const post of posts) {
      const key = `${handle}|${post.url}`;
      if (seen.has(key)) {
        continue;
      }

      const suggestion = suggestionFromPost({
        row,
        post,
        sourceList: input.sourceList,
      });
      if (!suggestion) {
        continue;
      }

      seen.add(key);
      suggestions.push(suggestion);
    }
  }

  return sortByEngagementThenRecency(suggestions).slice(0, input.maxSuggestions);
}

export function oppositionMonitoringUnavailableReason() {
  if (isApifyConfigured()) {
    return null;
  }

  if (!isSentinelSocialEnabled()) {
    return "Ative SENTINEL_SOCIAL_ENABLED para monitorar os ultimos posts do Instagram dos adversarios.";
  }

  return "Configure APIFY_TOKEN ou APIFY_API_TOKEN para monitorar os ultimos posts do Instagram dos adversarios.";
}

export async function buildOppositionPostSuggestions(
  profile: PoliticianProfile,
): Promise<MockSentinelSuggestion[]> {
  return buildInstagramProfilePostSuggestions({
    profiles: profile.oppositionProfiles,
    sourceList: "opposition",
    maxSuggestions: MAX_OPPOSITION_SUGGESTIONS,
  });
}

export async function buildInterestPostSuggestions(
  profile: PoliticianProfile,
): Promise<MockSentinelSuggestion[]> {
  return buildInstagramProfilePostSuggestions({
    profiles: profile.interestProfiles,
    sourceList: "interest",
    maxSuggestions: MAX_INTEREST_SUGGESTIONS,
  });
}
