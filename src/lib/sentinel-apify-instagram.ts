const DEFAULT_ACTOR_ID = "apify/instagram-scraper";
const APIFY_SYNC_TIMEOUT_MS = 120_000;

export type ApifyInstagramPost = {
  id: string;
  url: string;
  caption: string;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  timestamp: Date | null;
  ownerUsername: string;
};

function getApifyToken() {
  return process.env.APIFY_API_TOKEN?.trim() ?? "";
}

export function getApifyInstagramActorId() {
  return process.env.APIFY_INSTAGRAM_ACTOR_ID?.trim() || DEFAULT_ACTOR_ID;
}

export function isApifyConfigured() {
  return Boolean(getApifyToken());
}

function actorIdToPath(actorId: string) {
  return actorId.includes("~") ? actorId : actorId.replace("/", "~");
}

function readNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeInstagramUsername(handle: string) {
  return handle.trim().replace(/^@+/, "").replace(/\/+$/, "").split("/")[0] ?? "";
}

export function parseApifyInstagramItems(
  items: unknown[],
  fallbackUsername: string,
): ApifyInstagramPost[] {
  const posts: ApifyInstagramPost[] = [];

  for (const item of items) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const row = item as Record<string, unknown>;
    const caption =
      readString(row.caption) ||
      readString(row.text) ||
      readString(row.description) ||
      readString(row.title);
    const url =
      readString(row.url) ||
      readString(row.postUrl) ||
      (readString(row.shortCode)
        ? `https://www.instagram.com/p/${readString(row.shortCode)}/`
        : "");

    if (!caption && !url) {
      continue;
    }

    const ownerUsername =
      readString(row.ownerUsername) ||
      readString(row.username) ||
      fallbackUsername;
    const timestampRaw =
      readString(row.timestamp) ||
      readString(row.takenAt) ||
      readString(row.publishedAt);
    const timestamp = timestampRaw ? new Date(timestampRaw) : null;

    posts.push({
      id:
        readString(row.id) ||
        readString(row.shortCode) ||
        `${ownerUsername}-${timestampRaw || url || caption.slice(0, 24)}`,
      url,
      caption,
      likesCount: readNumber(row.likesCount ?? row.likes),
      commentsCount: readNumber(row.commentsCount ?? row.comments),
      sharesCount: readNumber(row.sharesCount ?? row.reshareCount ?? row.videoViewCount),
      timestamp: timestamp && !Number.isNaN(timestamp.getTime()) ? timestamp : null,
      ownerUsername,
    });
  }

  return posts;
}

export async function fetchInstagramPostsForUsername(
  username: string,
  options?: { resultsLimit?: number },
): Promise<ApifyInstagramPost[]> {
  const token = getApifyToken();
  const normalized = normalizeInstagramUsername(username);

  if (!token || !normalized) {
    return [];
  }

  const actorPath = actorIdToPath(getApifyInstagramActorId());
  const resultsLimit = Math.min(Math.max(options?.resultsLimit ?? 5, 1), 12);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), APIFY_SYNC_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://api.apify.com/v2/acts/${actorPath}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          directUrls: [`https://www.instagram.com/${normalized}/`],
          resultsType: "posts",
          resultsLimit,
        }),
        signal: controller.signal,
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        detail.trim() || `Apify Instagram scraper falhou (${response.status}).`,
      );
    }

    const payload = (await response.json()) as unknown;
    const items = Array.isArray(payload) ? payload : [];
    return parseApifyInstagramItems(items, normalized);
  } finally {
    clearTimeout(timeout);
  }
}
