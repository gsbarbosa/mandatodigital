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
import { splitProfileThemesBySphere } from "@/lib/sentinel-profile-themes";
import { pickBestMatchedTheme, matchThemesWithSynonyms } from "@/lib/sentinel-theme-synonyms";
import type { PoliticianProfile, SocialHandle } from "@/lib/types";

const MAX_OPPOSITION_SUGGESTIONS = 12;
const MAX_POSTS_PER_PROFILE = 12;

function buildOppositionSuggestionId(handle: string, postUrl: string) {
  const hash = createHash("sha256").update(`opposition|${handle}|${postUrl}`).digest("hex").slice(0, 16);
  return `sentinela-opposition-${hash}`;
}

function buildActor(
  row: SocialHandle,
  post: InstagramProfilePost,
): SentinelVerifiedActor {
  return {
    handle: normalizeInstagramHandle(row.handle),
    network: "instagram",
    postUrl: post.url,
    profileLabel: row.network,
    sourceList: "opposition",
    publishedAt: post.publishedAt ?? undefined,
  };
}

function oppositionThemesToMatch(profile: PoliticianProfile): string[] {
  const spheres = splitProfileThemesBySphere(profile);
  return [
    ...new Set([
      ...profile.oppositionThemes.map((theme) => theme.trim()).filter(Boolean),
      ...spheres.federal,
      ...spheres.estadual,
      ...spheres.municipalCustom,
    ]),
  ];
}

function scoreOppositionPost(input: {
  matchedThemes: string[];
  likes: number;
  comments: number;
  shares: number;
  publishedAt: string | null;
}): number {
  let score = 58 + input.matchedThemes.length * 14;
  score += Math.min(20, Math.log10(input.likes + 1) * 6);
  score += Math.min(12, Math.log10(input.comments + 1) * 5);

  if (input.publishedAt) {
    const ageHours = (Date.now() - new Date(input.publishedAt).getTime()) / 3_600_000;
    if (ageHours <= 48) {
      score += 18;
    } else if (ageHours <= 168) {
      score += 10;
    }
  }

  return Math.min(99, Math.max(30, Math.round(score)));
}

function captionHeadline(caption: string, handle: string) {
  const trimmed = caption.trim();
  if (trimmed) {
    return trimmed.length > 180 ? `${trimmed.slice(0, 177)}...` : trimmed;
  }
  return `Novo post de @${handle}`;
}

function suggestionFromPost(input: {
  row: SocialHandle;
  post: InstagramProfilePost;
  matchThemes: string[];
}): MockSentinelSuggestion | null {
  const handle = normalizeInstagramHandle(input.row.handle);
  if (!handle || !isInstagramFeedPost(input.post)) {
    return null;
  }

  const haystack = input.post.caption.trim() || captionHeadline("", handle);
  const matchedThemes = matchThemesWithSynonyms(haystack, input.matchThemes);
  const themeLabel =
    pickBestMatchedTheme(haystack, matchedThemes) ||
    matchedThemes[0] ||
    "Ação da Oposição";

  const actor = buildActor(input.row, input.post);
  const relevanceScore = scoreOppositionPost({
    matchedThemes,
    likes: input.post.likes,
    comments: input.post.comments,
    shares: input.post.shares,
    publishedAt: input.post.publishedAt,
  });

  const headline = captionHeadline(input.post.caption, handle);

  return {
    id: buildOppositionSuggestionId(handle, input.post.url),
    themeLabel,
    matchedThemes: matchedThemes.length > 0 ? matchedThemes : [themeLabel],
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
          likes: input.post.likes,
          comments: input.post.comments,
          shares: input.post.shares,
        },
      ],
      actors: [actor],
      articles: [],
    },
    engagement: {
      relevanceScore,
      scoreTrendPercent: 0,
      likes: input.post.likes,
      comments: input.post.comments,
      shares: input.post.shares,
      postsAnalyzed: 1,
      sources: ["instagram"],
      byNetwork: [
        {
          network: "instagram",
          likes: input.post.likes,
          comments: input.post.comments,
          shares: input.post.shares,
        },
      ],
    },
  };
}

function isInstagramOppositionProfile(row: SocialHandle) {
  const network = row.network.trim().toLowerCase();
  return network.includes("instagram") || network === "ig";
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
  const profiles = profile.oppositionProfiles.filter(
    (row) => row.handle.trim() && isInstagramOppositionProfile(row),
  );

  if (!profiles.length) {
    return [];
  }

  if (!isApifyConfigured()) {
    return [];
  }

  const matchThemes = oppositionThemesToMatch(profile);
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

      const suggestion = suggestionFromPost({ row, post, matchThemes });
      if (!suggestion) {
        continue;
      }

      seen.add(key);
      suggestions.push(suggestion);
    }
  }

  return suggestions
    .sort((left, right) => right.relevanceScore - left.relevanceScore)
    .slice(0, MAX_OPPOSITION_SUGGESTIONS);
}
