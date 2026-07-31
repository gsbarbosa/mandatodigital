import {
  channelIdsToAyrsharePlatforms,
  ayrsharePlatformToChannelId,
  getChannelDef,
  type DistributionChannelId,
} from "@/lib/distribution/channels";

const AYRSHARE_BASE = "https://api.ayrshare.com/api";

function getApiKey() {
  return process.env.AYRSHARE_API_KEY?.trim() || "";
}

export function isAyrshareConfigured() {
  return Boolean(getApiKey());
}

function authHeaders(profileKey?: string): HeadersInit {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("AYRSHARE_API_KEY nao configurada.");
  }
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  if (profileKey?.trim()) {
    headers["Profile-Key"] = profileKey.trim();
  }
  return headers;
}

async function ayrshareFetch<T>(
  path: string,
  init: RequestInit & { profileKey?: string },
): Promise<T> {
  const { profileKey, ...rest } = init;
  const response = await fetch(`${AYRSHARE_BASE}${path}`, {
    ...rest,
    headers: {
      ...authHeaders(profileKey),
      ...(rest.headers ?? {}),
    },
  });
  const payload = (await response.json().catch(() => ({}))) as T & {
    status?: string;
    message?: string;
    code?: number;
  };
  if (!response.ok) {
    const message =
      typeof payload.message === "string" && payload.message.trim()
        ? payload.message
        : `Ayrshare HTTP ${response.status}`;
    throw new Error(message);
  }
  if (payload.status === "error") {
    throw new Error(payload.message?.trim() || "Ayrshare retornou erro.");
  }
  return payload;
}

export type AyrshareCreateProfileResponse = {
  status: string;
  profileKey?: string;
  refId?: string;
  title?: string;
};

export async function ayrshareCreateProfile(input: {
  title: string;
  refId: string;
}): Promise<AyrshareCreateProfileResponse> {
  return ayrshareFetch<AyrshareCreateProfileResponse>("/profiles/profile", {
    method: "POST",
    body: JSON.stringify({
      title: input.title.slice(0, 100),
      refId: input.refId.slice(0, 100),
    }),
  });
}

export type AyrshareGenerateJwtResponse = {
  status: string;
  url?: string;
  token?: string;
  expiresIn?: string;
};

export async function ayrshareGenerateJwt(input: {
  profileKey: string;
  redirectUrl?: string;
  allowedSocial?: string[];
}): Promise<AyrshareGenerateJwtResponse> {
  const domain = process.env.AYRSHARE_DOMAIN?.trim();
  const privateKey = process.env.AYRSHARE_PRIVATE_KEY?.trim();
  if (!domain || !privateKey) {
    throw new Error(
      "Configure AYRSHARE_DOMAIN e AYRSHARE_PRIVATE_KEY para o link de conexao OAuth.",
    );
  }

  const hasPem = privateKey.includes("BEGIN");
  const pemKey = hasPem ? privateKey.replace(/\\n/g, "\n") : privateKey;

  return ayrshareFetch<AyrshareGenerateJwtResponse>("/profiles/generateJWT", {
    method: "POST",
    body: JSON.stringify({
      domain,
      privateKey: pemKey,
      profileKey: input.profileKey,
      ...(input.redirectUrl ? { redirect: input.redirectUrl } : {}),
      ...(input.allowedSocial?.length ? { allowedSocial: input.allowedSocial } : {}),
      ...(!hasPem ? { base64: true } : {}),
    }),
  });
}

export type AyrshareUserDetails = {
  status?: string;
  activeSocialAccounts?: string[];
  displayNames?: Array<{ platform: string; displayName?: string; username?: string }>;
};

export async function ayrshareGetUser(profileKey: string): Promise<AyrshareUserDetails> {
  return ayrshareFetch<AyrshareUserDetails>("/user", {
    method: "GET",
    profileKey,
  });
}

export type AyrsharePostResponse = {
  status?: string;
  id?: string;
  postIds?: Array<{
    status?: string;
    platform?: string;
    id?: string;
    postUrl?: string;
    errors?: Array<{ message?: string }>;
  }>;
  errors?: Array<{ platform?: string; message?: string }>;
};

export async function ayrshareCreatePost(input: {
  profileKey: string;
  post: string;
  platforms: string[];
  mediaUrls: string[];
  scheduleDate?: string | null;
  idempotencyKey?: string;
}): Promise<AyrsharePostResponse> {
  const body: Record<string, unknown> = {
    post: input.post,
    platforms: input.platforms,
    mediaUrls: input.mediaUrls,
    isVideo: true,
  };
  if (input.scheduleDate?.trim()) {
    body.scheduleDate = input.scheduleDate.trim();
  }
  if (input.idempotencyKey?.trim()) {
    body.idempotencyKey = input.idempotencyKey.trim();
  }

  return ayrshareFetch<AyrsharePostResponse>("/post", {
    method: "POST",
    profileKey: input.profileKey,
    body: JSON.stringify(body),
  });
}

/** Quando há captions distintas por canal, posta uma vez por plataforma. */
export async function ayrsharePublishPerChannel(input: {
  profileKey: string;
  videoUrl: string;
  captionsByChannel: Partial<Record<DistributionChannelId, string>>;
  channels: DistributionChannelId[];
  scheduledAt: string | null;
  idempotencyKey: string;
}): Promise<{
  batchId: string | null;
  results: Array<{
    channel: DistributionChannelId;
    status: "published" | "scheduled" | "failed";
    externalPostId: string | null;
    postUrl: string | null;
    error: string | null;
  }>;
}> {
  const results: Array<{
    channel: DistributionChannelId;
    status: "published" | "scheduled" | "failed";
    externalPostId: string | null;
    postUrl: string | null;
    error: string | null;
  }> = [];

  let batchId: string | null = null;

  for (const channel of input.channels) {
    const def = getChannelDef(channel);
    const caption = input.captionsByChannel[channel]?.trim() || "";
    try {
      const response = await ayrshareCreatePost({
        profileKey: input.profileKey,
        post: caption || " ",
        platforms: [def.ayrshare],
        mediaUrls: [input.videoUrl],
        scheduleDate: input.scheduledAt,
        idempotencyKey: `${input.idempotencyKey}:${channel}`,
      });

      if (!batchId && response.id) {
        batchId = String(response.id);
      }

      const postMeta = response.postIds?.[0];
      const failed =
        response.status === "error" ||
        postMeta?.status === "error" ||
        Boolean(postMeta?.errors?.length);

      if (failed) {
        const errMsg =
          postMeta?.errors?.[0]?.message ||
          response.errors?.[0]?.message ||
          "Falha ao publicar neste canal.";
        results.push({
          channel,
          status: "failed",
          externalPostId: postMeta?.id ? String(postMeta.id) : null,
          postUrl: postMeta?.postUrl ?? null,
          error: errMsg,
        });
        continue;
      }

      results.push({
        channel,
        status: input.scheduledAt ? "scheduled" : "published",
        externalPostId: postMeta?.id ? String(postMeta.id) : response.id ? String(response.id) : null,
        postUrl: postMeta?.postUrl ?? null,
        error: null,
      });
    } catch (error) {
      results.push({
        channel,
        status: "failed",
        externalPostId: null,
        postUrl: null,
        error: error instanceof Error ? error.message : "Falha ao publicar.",
      });
    }
  }

  return { batchId, results };
}

export { channelIdsToAyrsharePlatforms, ayrsharePlatformToChannelId };
