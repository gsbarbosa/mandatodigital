import {
  getInstagramAppId,
  getInstagramAppSecret,
  getInstagramGraphVersion,
  getInstagramRedirectUri,
} from "@/lib/distribution/instagram-env";

const GRAPH_HOST = "https://graph.instagram.com";
const SHORT_LIVED_TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const AUTHORIZE_URL = "https://www.instagram.com/oauth/authorize";

const PUBLISH_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
] as const;

type GraphErrorBody = {
  error?: { message?: string; type?: string; code?: number };
  message?: string;
};

function graphBase() {
  return `${GRAPH_HOST}/${getInstagramGraphVersion()}`;
}

function graphErrorMessage(payload: GraphErrorBody, status: number) {
  const fromError = payload.error?.message?.trim();
  if (fromError) {
    return fromError;
  }
  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message.trim();
  }
  return `Instagram Graph HTTP ${status}`;
}

async function graphFetch<T>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, init);
  const payload = (await response.json().catch(() => ({}))) as T & GraphErrorBody;
  if (!response.ok || payload.error) {
    throw new Error(graphErrorMessage(payload, response.status));
  }
  return payload;
}

export function buildInstagramAuthorizeUrl(state: string, redirectUri = getInstagramRedirectUri()) {
  const params = new URLSearchParams({
    client_id: getInstagramAppId(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: PUBLISH_SCOPES.join(","),
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export type InstagramShortLivedToken = {
  access_token?: string;
  user_id?: number | string;
  data?: Array<{
    access_token?: string;
    user_id?: number | string;
    permissions?: string;
  }>;
};

export async function exchangeInstagramCode(
  code: string,
  redirectUri = getInstagramRedirectUri(),
): Promise<{
  accessToken: string;
  userId: string;
}> {
  const body = new URLSearchParams({
    client_id: getInstagramAppId(),
    client_secret: getInstagramAppSecret(),
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code,
  });
  const payload = await graphFetch<InstagramShortLivedToken>(SHORT_LIVED_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const nested = payload.data?.[0];
  const accessToken = payload.access_token || nested?.access_token || "";
  const userId = payload.user_id ?? nested?.user_id;
  if (!accessToken) {
    throw new Error("Instagram nao retornou access_token.");
  }
  return {
    accessToken,
    userId: userId == null ? "" : String(userId),
  };
}

export async function exchangeInstagramLongLivedToken(shortLivedToken: string) {
  const params = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: getInstagramAppSecret(),
    access_token: shortLivedToken,
  });
  const payload = await graphFetch<{ access_token?: string; expires_in?: number }>(
    `${GRAPH_HOST}/access_token?${params.toString()}`,
  );
  if (!payload.access_token) {
    throw new Error("Instagram nao retornou token de longa duracao.");
  }
  return {
    accessToken: payload.access_token,
    expiresIn: payload.expires_in ?? 60 * 60 * 24 * 60,
  };
}

export type InstagramMeProfile = {
  user_id: string;
  username: string;
  account_type?: string;
};

export async function fetchInstagramMe(accessToken: string): Promise<InstagramMeProfile> {
  const params = new URLSearchParams({
    fields: "user_id,username,account_type",
    access_token: accessToken,
  });
  const payload = await graphFetch<{
    user_id?: string | number;
    id?: string | number;
    username?: string;
    account_type?: string;
  }>(`${graphBase()}/me?${params.toString()}`);
  const userId = payload.user_id ?? payload.id;
  if (userId == null || !payload.username) {
    throw new Error("Instagram nao retornou user_id/username.");
  }
  return {
    user_id: String(userId),
    username: payload.username,
    account_type: payload.account_type,
  };
}

type SleepFn = (ms: number) => Promise<void>;

const defaultSleep: SleepFn = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export type PublishReelInput = {
  igUserId: string;
  accessToken: string;
  videoUrl: string;
  caption: string;
  shareToFeed?: boolean;
  sleep?: SleepFn;
  maxAttempts?: number;
  intervalMs?: number;
};

export type PublishReelResult = {
  containerId: string;
  mediaId: string;
  permalink: string | null;
};

async function waitForContainerReady(input: {
  containerId: string;
  accessToken: string;
  sleep: SleepFn;
  maxAttempts: number;
  intervalMs: number;
}) {
  for (let attempt = 0; attempt < input.maxAttempts; attempt += 1) {
    const params = new URLSearchParams({
      fields: "status_code,status",
      access_token: input.accessToken,
    });
    const payload = await graphFetch<{ status_code?: string; status?: string }>(
      `${graphBase()}/${input.containerId}?${params.toString()}`,
    );
    const statusCode = (payload.status_code || "").toUpperCase();
    const statusText = (payload.status || "").trim();
    const status = statusCode || statusText.toUpperCase();
    if (status === "FINISHED" || status === "PUBLISHED") {
      return;
    }
    if (status === "ERROR" || status === "EXPIRED") {
      const detail = statusText && statusText.toUpperCase() !== status ? `: ${statusText}` : "";
      throw new Error(`Container Instagram em estado ${status}${detail}.`);
    }
    await input.sleep(input.intervalMs);
  }
  throw new Error("Timeout aguardando o container de Reel no Instagram.");
}

export async function publishInstagramReel(
  input: PublishReelInput,
): Promise<PublishReelResult> {
  const token = input.accessToken.trim();
  const igUserId = input.igUserId.trim();
  if (!token || !igUserId) {
    throw new Error("Token ou IG user id ausente.");
  }
  if (!input.videoUrl.trim()) {
    throw new Error("videoUrl ausente para o Reel.");
  }

  const createParams = new URLSearchParams({
    media_type: "REELS",
    video_url: input.videoUrl.trim(),
    caption: input.caption,
    access_token: token,
  });
  if (input.shareToFeed !== false) {
    createParams.set("share_to_feed", "true");
  }

  const created = await graphFetch<{ id?: string }>(
    `${graphBase()}/${igUserId}/media?${createParams.toString()}`,
    { method: "POST" },
  );
  const containerId = created.id?.trim();
  if (!containerId) {
    throw new Error("Instagram nao retornou id do container.");
  }

  await waitForContainerReady({
    containerId,
    accessToken: token,
    sleep: input.sleep ?? defaultSleep,
    maxAttempts: input.maxAttempts ?? 36,
    intervalMs: input.intervalMs ?? 5000,
  });

  const publishParams = new URLSearchParams({
    creation_id: containerId,
    access_token: token,
  });
  const published = await graphFetch<{ id?: string }>(
    `${graphBase()}/${igUserId}/media_publish?${publishParams.toString()}`,
    { method: "POST" },
  );
  const mediaId = published.id?.trim();
  if (!mediaId) {
    throw new Error("Instagram nao retornou id da midia publicada.");
  }

  let permalink: string | null = null;
  try {
    const mediaParams = new URLSearchParams({
      fields: "permalink",
      access_token: token,
    });
    const media = await graphFetch<{ permalink?: string }>(
      `${graphBase()}/${mediaId}?${mediaParams.toString()}`,
    );
    permalink = media.permalink?.trim() || null;
  } catch {
    permalink = null;
  }

  return { containerId, mediaId, permalink };
}
