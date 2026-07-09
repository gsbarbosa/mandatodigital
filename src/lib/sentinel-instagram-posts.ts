import { isSentinelSocialEnabled } from "@/lib/feature-flags";

export type InstagramProfilePost = {
  id: string;
  url: string;
  caption: string;
  publishedAt: string | null;
  likes: number;
  comments: number;
  shares: number;
  postType: string;
  ownerUsername: string;
};

export function normalizeInstagramHandle(handle: string) {
  return handle.trim().replace(/^@+/, "").toLowerCase();
}

export function isInstagramFeedPost(post: Pick<InstagramProfilePost, "url" | "postType">) {
  const url = post.url.toLowerCase();
  const type = post.postType.toLowerCase();

  if (url.includes("/reel/") || url.includes("/reels/")) {
    return false;
  }
  if (type.includes("reel") || type === "clips") {
    return false;
  }

  return true;
}

function readNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readTimestamp(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const millis = value > 1_000_000_000_000 ? value : value * 1000;
    return new Date(millis).toISOString();
  }
  return null;
}

export function normalizeApifyInstagramItems(
  items: unknown[],
  expectedHandle: string,
): InstagramProfilePost[] {
  const handle = normalizeInstagramHandle(expectedHandle);
  const posts: InstagramProfilePost[] = [];

  for (const raw of items) {
    if (!raw || typeof raw !== "object") {
      continue;
    }

    const row = raw as Record<string, unknown>;
    const ownerUsername = normalizeInstagramHandle(
      readString(row.ownerUsername) ||
        readString(row.username) ||
        readString((row.owner as Record<string, unknown> | undefined)?.username),
    );

    if (ownerUsername && ownerUsername !== handle) {
      continue;
    }

    const shortCode = readString(row.shortCode);
    const url =
      readString(row.url) ||
      readString(row.postUrl) ||
      (shortCode ? `https://www.instagram.com/p/${shortCode}/` : "");

    if (!url) {
      continue;
    }

    const post: InstagramProfilePost = {
      id: readString(row.id) || url,
      url,
      caption:
        readString(row.caption) ||
        readString(row.text) ||
        readString(row.description) ||
        "",
      publishedAt:
        readTimestamp(row.timestamp) ||
        readTimestamp(row.takenAt) ||
        readTimestamp(row.createdAt) ||
        readTimestamp(row.pubDate),
      likes: readNumber(row.likesCount ?? row.likes ?? row.likeCount),
      comments: readNumber(row.commentsCount ?? row.comments ?? row.commentCount),
      shares: readNumber(row.sharesCount ?? row.shares ?? row.repostsCount),
      postType: readString(row.type) || readString(row.productType) || "post",
      ownerUsername: ownerUsername || handle,
    };

    if (!isInstagramFeedPost(post)) {
      continue;
    }

    posts.push(post);
  }

  return posts
    .sort((left, right) => {
      const leftTime = left.publishedAt ? new Date(left.publishedAt).getTime() : 0;
      const rightTime = right.publishedAt ? new Date(right.publishedAt).getTime() : 0;
      return rightTime - leftTime;
    })
    .slice(0, 10);
}

export function getApifyToken() {
  return process.env.APIFY_TOKEN?.trim() || process.env.APIFY_API_TOKEN?.trim() || "";
}

export function isApifyConfigured() {
  return isSentinelSocialEnabled() && Boolean(getApifyToken());
}

export async function fetchInstagramProfilePosts(
  handle: string,
  limit = 10,
): Promise<InstagramProfilePost[]> {
  const token = getApifyToken();
  if (!token || !isSentinelSocialEnabled()) {
    return [];
  }

  const username = normalizeInstagramHandle(handle);
  if (!username) {
    return [];
  }

  const actor = (process.env.APIFY_INSTAGRAM_ACTOR_ID?.trim() || "apify/instagram-scraper").replace(
    "/",
    "~",
  );

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);

  try {
    const response = await fetch(
      `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directUrls: [`https://www.instagram.com/${username}/`],
          resultsType: "posts",
          resultsLimit: Math.max(limit, 10),
          searchType: "user",
          addParentData: false,
        }),
        signal: controller.signal,
        next: { revalidate: 0 },
      },
    );

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.warn(
        `[sentinel-instagram] Apify ${response.status} para @${username}: ${errorBody.slice(0, 200)}`,
      );
      return [];
    }

    const items = (await response.json()) as unknown[];
    if (!Array.isArray(items)) {
      return [];
    }

    return normalizeApifyInstagramItems(items, username).slice(0, limit);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}
