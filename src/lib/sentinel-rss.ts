import type { PoliticianProfile } from "@/lib/types";
import { matchThemesWithSynonyms } from "@/lib/sentinel-theme-synonyms";
import { normalizeSentinelText } from "@/lib/sentinel-text";

export { normalizeSentinelText } from "@/lib/sentinel-text";

export type RssNewsOrigin = "google-news" | "portal-rss" | "google-news-site";

export type RssNewsItem = {
  title: string;
  link: string;
  pubDate: string | null;
  publishedAt: Date | null;
  sourceName?: string;
  origin?: RssNewsOrigin;
  siteList?: "interest" | "opposition";
  siteHost?: string;
};

const MAX_THEME_QUERIES = 4;
const MAX_OPPOSITION_QUERIES = 2;
const MAX_PORTAL_SITES_PER_LIST = 5;
const RSS_FETCH_TIMEOUT_MS = 12_000;
const PORTAL_RSS_PATHS = ["/feed", "/feed/", "/rss", "/rss/", "/feed.xml", "/rss.xml"];

const TITLE_STOP_WORDS = new Set([
  "para",
  "com",
  "sem",
  "sobre",
  "apos",
  "mais",
  "nova",
  "novo",
  "das",
  "dos",
  "que",
  "uma",
  "por",
  "sao",
  "ser",
  "nao",
  "dia",
  "ano",
  "mes",
]);

export function decodeXmlEntities(text: string) {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .trim();
}

function extractXmlTag(block: string, tag: string) {
  // Google News emite tags com atributos (ex.: <source url="...">G1</source>).
  const openTag = `<${tag}(?:\\s[^>]*)?>`;
  const cdataMatch = new RegExp(
    `${openTag}<!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`,
    "i",
  ).exec(block);
  if (cdataMatch) {
    return decodeXmlEntities(cdataMatch[1]);
  }

  const plainMatch = new RegExp(`${openTag}([\\s\\S]*?)</${tag}>`, "i").exec(block);
  return plainMatch ? decodeXmlEntities(plainMatch[1]) : "";
}

export function parseRssFeed(xml: string): RssNewsItem[] {
  const items: RssNewsItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null = itemRegex.exec(xml);

  while (match) {
    const block = match[1];
    const title = extractXmlTag(block, "title");
    const link = extractXmlTag(block, "link");
    const pubDate = extractXmlTag(block, "pubDate") || extractXmlTag(block, "dc:date") || null;
    const sourceName = extractXmlTag(block, "source") || undefined;

    if (title && link) {
      const publishedAt = pubDate ? new Date(pubDate) : null;
      items.push({
        title,
        link,
        pubDate,
        publishedAt:
          publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : null,
        sourceName: sourceName || undefined,
      });
    }

    match = itemRegex.exec(xml);
  }

  return items;
}

/** @deprecated Use parseRssFeed */
export const parseGoogleNewsRss = parseRssFeed;

export function buildGoogleNewsRssUrl(query: string) {
  const params = new URLSearchParams({
    q: query,
    hl: "pt-BR",
    gl: "BR",
    ceid: "BR:pt-419",
  });
  return `https://news.google.com/rss/search?${params.toString()}`;
}

export function normalizePortalHost(site: string) {
  const trimmed = site.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const url = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return trimmed.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] ?? "";
  }
}

export function buildSentinelRssQueries(profile: PoliticianProfile) {
  const themes = [
    ...profile.sentinelThemes,
    ...profile.customRadarThemes.map((theme) => theme.trim()).filter(Boolean),
  ];

  const queries: string[] = [];
  const geo = [profile.city.trim(), profile.state.trim()].filter(Boolean).join(" ");

  if (geo) {
    queries.push(geo);
  }

  for (const theme of themes.slice(0, MAX_THEME_QUERIES)) {
    queries.push(geo ? `${theme} ${geo}` : theme);
  }

  for (const theme of profile.oppositionThemes.slice(0, MAX_OPPOSITION_QUERIES)) {
    queries.push(geo ? `${theme} ${geo}` : theme);
  }

  return [...new Set(queries)];
}

export function matchSentinelThemes(text: string, themes: string[]) {
  return matchThemesWithSynonyms(text, themes);
}

/** Match literal (sem sinonimos) — usado nos temas personalizados (pipeline manual). */
export function matchLiteralThemes(text: string, themes: string[]) {
  const normalized = normalizeSentinelText(text);

  return themes.filter((theme) => {
    const normalizedTheme = normalizeSentinelText(theme);
    return normalizedTheme.length >= 3 && normalized.includes(normalizedTheme);
  });
}

export function isPortalOriginArticle(article: RssNewsItem) {
  return article.origin === "portal-rss" || article.origin === "google-news-site";
}

export function buildStoryClusterKey(title: string) {
  const words = normalizeSentinelText(title)
    .split(" ")
    .filter((word) => word.length >= 4 && !TITLE_STOP_WORDS.has(word))
    .sort()
    .slice(0, 5);

  return words.join("|");
}

export function countUniqueOutlets(articles: RssNewsItem[]) {
  const outlets = new Set<string>();

  for (const article of articles) {
    if (article.sourceName?.trim()) {
      outlets.add(normalizeSentinelText(article.sourceName));
      continue;
    }

    if (article.siteHost?.trim()) {
      outlets.add(normalizeSentinelText(article.siteHost));
      continue;
    }

    try {
      outlets.add(new URL(article.link).hostname.replace(/^www\./, ""));
    } catch {
      outlets.add(article.link);
    }
  }

  return outlets.size;
}

function dedupeNewsItems(items: RssNewsItem[]) {
  const seen = new Set<string>();
  const deduped: RssNewsItem[] = [];

  for (const item of items) {
    const key = `${normalizeSentinelText(item.title)}|${item.link}`;
    if (!normalizeSentinelText(item.title) || seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(item);
  }

  return deduped;
}

async function fetchRssUrl(url: string, metadata?: Partial<RssNewsItem>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RSS_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
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
    return parseRssFeed(xml).map((item) => ({
      ...item,
      ...metadata,
    }));
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchGoogleNewsQuery(query: string) {
  return fetchRssUrl(buildGoogleNewsRssUrl(query), { origin: "google-news" });
}

async function fetchGoogleNewsForSite(host: string, profile: PoliticianProfile) {
  const geo = [profile.city.trim(), profile.state.trim()].filter(Boolean).join(" ");
  const query = geo ? `site:${host} ${geo}` : `site:${host}`;
  return fetchRssUrl(buildGoogleNewsRssUrl(query), {
    origin: "google-news-site",
    siteHost: host,
  });
}

async function discoverPortalFeed(host: string, siteList: "interest" | "opposition") {
  if (!host) {
    return [];
  }

  const base = `https://${host}`;
  for (const path of PORTAL_RSS_PATHS) {
    const items = await fetchRssUrl(`${base}${path}`, {
      origin: "portal-rss",
      siteList,
      siteHost: host,
      sourceName: host,
    });
    if (items.length > 0) {
      return items;
    }
  }

  return [];
}

async function fetchPortalSites(
  sites: string[],
  siteList: "interest" | "opposition",
  profile: PoliticianProfile,
) {
  const hosts = [...new Set(sites.map(normalizePortalHost).filter(Boolean))].slice(
    0,
    MAX_PORTAL_SITES_PER_LIST,
  );

  const batches = await Promise.all(
    hosts.map(async (host) => {
      const direct = await discoverPortalFeed(host, siteList);
      if (direct.length > 0) {
        return direct;
      }

      return fetchGoogleNewsForSite(host, profile).then((items) =>
        items.map((item) => ({ ...item, siteList, siteHost: host })),
      );
    }),
  );

  return batches.flat();
}

export async function fetchSentinelNewsItems(profile: PoliticianProfile) {
  const queries = buildSentinelRssQueries(profile);
  const hasRadar =
    queries.length > 0 ||
    profile.interestSites.some((site) => site.trim()) ||
    profile.oppositionSites.some((site) => site.trim());

  if (!hasRadar) {
    return [];
  }

  const [googleNewsBatches, interestPortalItems, oppositionPortalItems] = await Promise.all([
    Promise.all(queries.map((query) => fetchGoogleNewsQuery(query))),
    fetchPortalSites(profile.interestSites, "interest", profile),
    fetchPortalSites(profile.oppositionSites, "opposition", profile),
  ]);

  return dedupeNewsItems([
    ...googleNewsBatches.flat(),
    ...interestPortalItems,
    ...oppositionPortalItems,
  ]);
}

const MAX_SEMANTIC_EXPANSION_QUERIES = 10;

export async function fetchSemanticExpansionNewsItems(
  profile: PoliticianProfile,
  expandedTerms: string[],
) {
  const terms = [...new Set(expandedTerms.map((term) => term.trim()).filter(Boolean))].slice(
    0,
    MAX_SEMANTIC_EXPANSION_QUERIES,
  );

  if (terms.length === 0) {
    return [];
  }

  const geo = [profile.city.trim(), profile.state.trim()].filter(Boolean).join(" ");
  const queries = terms.map((term) => (geo ? `${term} ${geo}` : term));
  const batches = await Promise.all(queries.map((query) => fetchGoogleNewsQuery(query)));

  return dedupeNewsItems(batches.flat());
}

export function scoreSentinelArticle(
  article: RssNewsItem,
  profile: PoliticianProfile,
  matchedInterest: string[],
  matchedOpposition: string[],
  cluster?: { articleCount: number; outletCount: number },
) {
  let score = 0;
  score += matchedInterest.length * 15;
  score += matchedOpposition.length * 10;

  if (article.siteList === "opposition") {
    score += 8;
  } else if (article.siteList === "interest") {
    score += 5;
  }

  const normalizedTitle = normalizeSentinelText(article.title);

  if (profile.city.trim()) {
    const city = normalizeSentinelText(profile.city);
    if (city.length >= 3 && normalizedTitle.includes(city)) {
      score += 20;
    }
  }

  if (profile.state.trim()) {
    const state = normalizeSentinelText(profile.state);
    if (state.length >= 2 && normalizedTitle.includes(state)) {
      score += 10;
    }
  }

  if (article.publishedAt) {
    const ageHours = (Date.now() - article.publishedAt.getTime()) / 3_600_000;
    if (ageHours <= 24) {
      score += 15;
    } else if (ageHours <= 72) {
      score += 8;
    }
  }

  if (cluster) {
    score += Math.max(0, cluster.outletCount - 1) * 12;
    score += Math.max(0, cluster.articleCount - 1) * 4;
  }

  return Math.min(99, Math.max(10, score));
}

type ScoredArticle = {
  article: RssNewsItem;
  themeLabel: string;
  matchedThemes: string[];
  sourceList: "interest" | "opposition";
  relevanceScore: number;
  pipeline?: string;
};

function storyClusterKeysSimilar(left: string, right: string) {
  if (left === right) {
    return true;
  }

  const leftWords = new Set(left.split("|").filter(Boolean));
  const rightWords = new Set(right.split("|").filter(Boolean));
  let overlap = 0;

  for (const word of leftWords) {
    if (rightWords.has(word)) {
      overlap += 1;
    }
  }

  return overlap >= 3;
}

export function clusterScoredArticles(scored: ScoredArticle[]) {
  const byTheme = new Map<string, ScoredArticle[]>();

  for (const item of scored) {
    const bucket = byTheme.get(item.themeLabel) ?? [];
    bucket.push(item);
    byTheme.set(item.themeLabel, bucket);
  }

  const clusters: ScoredArticle[][] = [];

  for (const themeItems of byTheme.values()) {
    const used = new Set<number>();

    for (let index = 0; index < themeItems.length; index += 1) {
      if (used.has(index)) {
        continue;
      }

      const seed = themeItems[index];
      if (!seed) {
        continue;
      }

      const cluster = [seed];
      used.add(index);
      const seedKey = buildStoryClusterKey(seed.article.title);

      for (let candidateIndex = index + 1; candidateIndex < themeItems.length; candidateIndex += 1) {
        if (used.has(candidateIndex)) {
          continue;
        }

        const candidate = themeItems[candidateIndex];
        if (!candidate) {
          continue;
        }

        const candidateKey = buildStoryClusterKey(candidate.article.title);
        if (storyClusterKeysSimilar(seedKey, candidateKey)) {
          cluster.push(candidate);
          used.add(candidateIndex);
        }
      }

      clusters.push(cluster);
    }
  }

  return clusters;
}

export type { ScoredArticle };
