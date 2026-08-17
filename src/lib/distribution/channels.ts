/** As 7 redes do Publicador. Só o Instagram conecta/publica neste recorte. */

export const DISTRIBUTION_CHANNEL_IDS = [
  "instagram",
  "facebook",
  "tiktok",
  "youtube",
  "threads",
  "linkedin",
  "twitter",
] as const;

/** Canais que de fato conectam e publicam. A UI lista todas as 7. */
export const ACTIVE_DISTRIBUTION_CHANNEL_IDS = ["instagram"] as const;

export type ActiveDistributionChannelId = (typeof ACTIVE_DISTRIBUTION_CHANNEL_IDS)[number];

export type DistributionChannelId = (typeof DISTRIBUTION_CHANNEL_IDS)[number];

export type DistributionChannelDef = {
  id: DistributionChannelId;
  label: string;
  /** Nome da plataforma no Ayrshare. */
  ayrshare: string;
  captionLimit: number;
};

export function isActiveDistributionChannelId(
  value: string,
): value is ActiveDistributionChannelId {
  return (ACTIVE_DISTRIBUTION_CHANNEL_IDS as readonly string[]).includes(value);
}

export const DISTRIBUTION_CHANNELS: readonly DistributionChannelDef[] = [
  { id: "instagram", label: "Instagram Reels", ayrshare: "instagram", captionLimit: 2200 },
  { id: "facebook", label: "Facebook", ayrshare: "facebook", captionLimit: 63206 },
  { id: "tiktok", label: "TikTok", ayrshare: "tiktok", captionLimit: 2200 },
  { id: "youtube", label: "YouTube Shorts", ayrshare: "youtube", captionLimit: 5000 },
  { id: "threads", label: "Threads", ayrshare: "threads", captionLimit: 500 },
  { id: "linkedin", label: "LinkedIn", ayrshare: "linkedin", captionLimit: 3000 },
  { id: "twitter", label: "X", ayrshare: "twitter", captionLimit: 280 },
] as const;

/** Labels legados do onboarding → id canônico. */
const LEGACY_LABEL_TO_ID: Record<string, DistributionChannelId> = {
  "Instagram (Feed/Reels)": "instagram",
  "Instagram Reels": "instagram",
  "X / Twitter (Threads)": "twitter",
  "X / Twitter": "twitter",
  X: "twitter",
  Twitter: "twitter",
  TikTok: "tiktok",
  "YouTube (Shorts)": "youtube",
  "YouTube Shorts": "youtube",
  "Facebook (Pagina)": "facebook",
  Facebook: "facebook",
  LinkedIn: "linkedin",
  Threads: "threads",
};

export const ACTIVE_DISTRIBUTION_CHANNELS: readonly DistributionChannelDef[] =
  DISTRIBUTION_CHANNELS.filter((channel) => isActiveDistributionChannelId(channel.id));

export function isDistributionChannelId(value: string): value is DistributionChannelId {
  return (DISTRIBUTION_CHANNEL_IDS as readonly string[]).includes(value);
}

export function getChannelDef(id: DistributionChannelId): DistributionChannelDef {
  const found = DISTRIBUTION_CHANNELS.find((channel) => channel.id === id);
  if (!found) {
    throw new Error(`Canal desconhecido: ${id}`);
  }
  return found;
}

export function resolveChannelId(raw: string): DistributionChannelId | null {
  const trimmed = raw.trim();
  if (isDistributionChannelId(trimmed)) {
    return trimmed;
  }
  return LEGACY_LABEL_TO_ID[trimmed] ?? null;
}

export function channelIdsToAyrsharePlatforms(ids: DistributionChannelId[]): string[] {
  return ids.map((id) => getChannelDef(id).ayrshare);
}

export function ayrsharePlatformToChannelId(platform: string): DistributionChannelId | null {
  const normalized = platform.trim().toLowerCase();
  const found = DISTRIBUTION_CHANNELS.find(
    (channel) => channel.ayrshare === normalized || channel.id === normalized,
  );
  return found?.id ?? null;
}
