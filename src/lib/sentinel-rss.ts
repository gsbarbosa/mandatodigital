import type { PoliticianProfile } from "@/lib/types";
import {
  getNationalPortalHosts,
  getStatePortalHosts,
} from "@/lib/sentinel-portal-catalog";
import {
  hasAdversaryRadar,
  hasEstadualRadar,
  hasFederalRadar,
  hasMunicipalRadar,
  splitProfileThemesBySphere,
} from "@/lib/sentinel-profile-themes";
import { matchThemesWithSynonyms } from "@/lib/sentinel-theme-synonyms";
import { normalizeSentinelText } from "@/lib/sentinel-text";

export { normalizeSentinelText } from "@/lib/sentinel-text";

export type SentinelSiteList = "federal" | "estadual" | "interest" | "opposition";

export type RssNewsOrigin = "google-news" | "bing-news" | "portal-rss" | "google-news-site";

export type RssNewsItem = {
  title: string;
  link: string;
  pubDate: string | null;
  publishedAt: Date | null;
  sourceName?: string;
  origin?: RssNewsOrigin;
  siteList?: SentinelSiteList;
  siteHost?: string;
};

const MAX_THEME_QUERIES = 4;
const MAX_PORTAL_SITES_PER_LIST = 10;
const MAX_COLLECTED_NEWS_ITEMS = 350;
const RSS_FETCH_TIMEOUT_MS = 12_000;
const RSS_FETCH_MAX_ATTEMPTS = 2;
const RSS_FETCH_CONCURRENCY = 3;
const RSS_RETRY_BASE_DELAY_MS = 600;
const GOOGLE_CIRCUIT_FAILURE_THRESHOLD = 3;
/** Teto de bytes lidos da home ao procurar <link rel="alternate"> — evita baixar a pagina inteira. */
const HTML_DISCOVERY_MAX_BYTES = 150_000;
const PORTAL_RSS_PATHS = [
  "/rss/g1/",
  "/feed",
  "/feed/",
  "/rss",
  "/rss/",
  "/feed.xml",
  "/rss.xml",
];

/**
 * Feeds canônicos de portais de ALCANCE NACIONAL — descoberta genérica (/feed)
 * falha em vários veículos grandes. Ordem: tentar estes antes dos paths genéricos.
 *
 * NÃO adicionar aqui portais de circulação regional/restrita (ex.: jornais
 * estaduais). Este mapa só resolve a URL do feed — quem decide se um host
 * entra na busca nacional é NATIONAL_PORTAL_HOSTS (sentinel-portal-catalog.ts).
 * Portal regional com feed problemático vai em KNOWN_RESTRICTED_PORTAL_FEED_URLS.
 */
const KNOWN_PORTAL_FEED_URLS: Record<string, readonly string[]> = {
  "g1.globo.com": ["https://g1.globo.com/rss/g1/"],
  "cnnbrasil.com.br": ["https://www.cnnbrasil.com.br/feed/", "https://cnnbrasil.com.br/feed/"],
  "folha.uol.com.br": [
    "https://feeds.folha.uol.com.br/poder/rss091.xml",
    "https://feeds.folha.uol.com.br/folha/rss091.xml",
  ],
  "uol.com.br": ["https://rss.uol.com.br/feed/noticias.xml"],
};

/**
 * Feeds canônicos de portais de circulação REGIONAL/RESTRITA (ex.: jornais
 * estaduais). Separado de KNOWN_PORTAL_FEED_URLS de propósito — esses portais
 * só devem aparecer em buscas estaduais/municipais (via STATE_PORTAL_HOSTS ou
 * interestSites do candidato), nunca na busca nacional. Não promover para
 * NATIONAL_PORTAL_HOSTS nem mover uma entrada daqui pra KNOWN_PORTAL_FEED_URLS.
 */
const KNOWN_RESTRICTED_PORTAL_FEED_URLS: Record<string, readonly string[]> = {
  // O Tempo (MG) nao expoe RSS/Atom tradicional — usa Google News Sitemap.
  "otempo.com.br": ["https://www.otempo.com.br/sitemap-api/otempo/sitemap_news.xml"],
};

/** Headers que o Google News costuma aceitar melhor em datacenter (Cloud Run). */
const RSS_FETCH_HEADERS: HeadersInit = {
  Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
  "User-Agent":
    "Mozilla/5.0 (compatible; MandatoDigitalBot/1.1; +https://mandatodigital.web.app) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
};

export type RssFetchAttemptStats = {
  attempted: number;
  succeeded: number;
  failed: number;
  emptyBody: number;
  httpErrors: number;
  aborted: number;
  items: number;
};

function createEmptyFetchStats(): RssFetchAttemptStats {
  return {
    attempted: 0,
    succeeded: 0,
    failed: 0,
    emptyBody: 0,
    httpErrors: 0,
    aborted: 0,
    items: 0,
  };
}

let rssFetchStats = createEmptyFetchStats();
let googleNewsCircuitOpen = false;
let googleNewsConsecutiveFailures = 0;

/** Reseta e devolve o acumulador de diagnóstico do processo atual de coleta. */
export function beginRssFetchStats() {
  rssFetchStats = createEmptyFetchStats();
  googleNewsCircuitOpen = false;
  googleNewsConsecutiveFailures = 0;
  return rssFetchStats;
}

export function getRssFetchStats(): RssFetchAttemptStats {
  return { ...rssFetchStats };
}

export function isGoogleNewsCircuitOpen() {
  return googleNewsCircuitOpen;
}

function noteGoogleNewsSuccess() {
  googleNewsConsecutiveFailures = 0;
  googleNewsCircuitOpen = false;
}

function noteGoogleNewsFailure() {
  googleNewsConsecutiveFailures += 1;
  if (googleNewsConsecutiveFailures >= GOOGLE_CIRCUIT_FAILURE_THRESHOLD && !googleNewsCircuitOpen) {
    googleNewsCircuitOpen = true;
    console.warn(
      "[sentinel-rss] circuit breaker Google News aberto apos",
      googleNewsConsecutiveFailures,
      "falhas — usando Bing/portais",
    );
  }
}

type RssFetchOutcome =
  | "succeeded"
  | "failed"
  | "emptyBody"
  | "httpErrors"
  | "aborted";

function recordFetchStat(outcome: RssFetchOutcome, itemCount = 0) {
  rssFetchStats.attempted += 1;
  rssFetchStats[outcome] += 1;
  rssFetchStats.items += itemCount;
}

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

/**
 * Google News Sitemap (xmlns:news) — formato que muitos portais expõem via
 * robots.txt (Sitemap:) mesmo sem ter RSS/Atom tradicional. Schema diferente
 * do RSS: raiz <urlset>, item <url>, titulo em <news:title>.
 */
export function looksLikeNewsSitemap(body: string) {
  const head = body.slice(0, 4_000).toLowerCase();
  if (!head.trim()) {
    return false;
  }
  return head.includes("<urlset") && (head.includes("news:news") || head.includes("sitemap-news"));
}

export function parseNewsSitemap(xml: string): RssNewsItem[] {
  const items: RssNewsItem[] = [];
  const urlRegex = /<url>([\s\S]*?)<\/url>/gi;
  let match: RegExpExecArray | null = urlRegex.exec(xml);

  while (match) {
    const block = match[1];
    const link = extractXmlTag(block, "loc");
    const title = extractXmlTag(block, "news:title");
    const pubDate = extractXmlTag(block, "news:publication_date") || null;
    const sourceName = extractXmlTag(block, "news:name") || undefined;

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

    match = urlRegex.exec(xml);
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

export function buildBingNewsRssUrl(query: string) {
  const params = new URLSearchParams({
    q: query,
    format: "rss",
    mkt: "pt-BR",
  });
  return `https://www.bing.com/news/search?${params.toString()}`;
}

/** True quando o body parece feed RSS/Atom (não HTML de consent/captcha). */
export function looksLikeRssFeed(body: string) {
  const head = body.slice(0, 4_000).toLowerCase();
  if (!head.trim()) {
    return false;
  }
  if (head.includes("<html") || head.includes("<!doctype html")) {
    return false;
  }
  return (
    head.includes("<rss") ||
    head.includes("<feed") ||
    head.includes("<item>") ||
    head.includes("<entry>")
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const results: R[] = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await mapper(items[current] as T);
    }
  }

  const workers = Array.from(
    { length: Math.min(Math.max(1, concurrency), items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
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
  const { federal, estadual, municipalCustom } = splitProfileThemesBySphere(profile);
  const queries: string[] = [];
  const geo = [profile.city.trim(), profile.state.trim()].filter(Boolean).join(" ");
  const state = profile.state.trim().toUpperCase();

  if (geo && (hasMunicipalRadar(profile) || municipalCustom.length > 0)) {
    queries.push(geo);
  }

  for (const theme of federal.slice(0, MAX_THEME_QUERIES)) {
    queries.push(`${theme} Brasil`);
  }

  for (const theme of estadual.slice(0, MAX_THEME_QUERIES)) {
    queries.push(state ? `${theme} ${state}` : theme);
  }

  for (const theme of municipalCustom.slice(0, 3)) {
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

async function fetchRssUrlOnce(
  url: string,
  metadata?: Partial<RssNewsItem>,
): Promise<{ items: RssNewsItem[]; retryable: boolean; status?: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RSS_FETCH_TIMEOUT_MS);
  const isGoogle = url.includes("news.google.com");

  try {
    const response = await fetch(url, {
      headers: RSS_FETCH_HEADERS,
      signal: controller.signal,
      cache: "no-store",
      redirect: "follow",
    });

    if (!response.ok) {
      recordFetchStat("httpErrors");
      console.warn("[sentinel-rss] HTTP", response.status, url.slice(0, 160));
      if (isGoogle) {
        noteGoogleNewsFailure();
      }
      return {
        items: [],
        retryable: response.status === 429 || response.status >= 500,
        status: response.status,
      };
    }

    const xml = await response.text();
    const isNewsSitemap = looksLikeNewsSitemap(xml);
    if (!looksLikeRssFeed(xml) && !isNewsSitemap) {
      recordFetchStat("emptyBody");
      console.warn(
        "[sentinel-rss] corpo nao-RSS",
        `bytes=${xml.length}`,
        url.slice(0, 160),
      );
      if (isGoogle) {
        noteGoogleNewsFailure();
      }
      return { items: [], retryable: isGoogle, status: response.status };
    }

    const items = (isNewsSitemap ? parseNewsSitemap(xml) : parseRssFeed(xml)).map((item) => ({
      ...item,
      ...metadata,
    }));

    if (items.length === 0) {
      recordFetchStat("emptyBody");
      if (isGoogle) {
        noteGoogleNewsFailure();
      }
      return { items: [], retryable: isGoogle, status: response.status };
    }

    recordFetchStat("succeeded", items.length);
    if (isGoogle) {
      noteGoogleNewsSuccess();
    }
    return { items, retryable: false, status: response.status };
  } catch (error) {
    const aborted =
      (error instanceof Error && error.name === "AbortError") ||
      (typeof error === "object" &&
        error !== null &&
        "name" in error &&
        (error as { name?: string }).name === "AbortError");
    recordFetchStat(aborted ? "aborted" : "failed");
    if (isGoogle) {
      noteGoogleNewsFailure();
    }
    console.warn(
      "[sentinel-rss] fetch falhou",
      aborted ? "timeout/abort" : error instanceof Error ? error.message : "erro",
      url.slice(0, 160),
    );
    return { items: [], retryable: true };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchRssUrl(url: string, metadata?: Partial<RssNewsItem>) {
  let last: RssNewsItem[] = [];

  for (let attempt = 1; attempt <= RSS_FETCH_MAX_ATTEMPTS; attempt += 1) {
    if (url.includes("news.google.com") && googleNewsCircuitOpen) {
      return [];
    }

    const result = await fetchRssUrlOnce(url, metadata);
    last = result.items;
    if (last.length > 0) {
      return last;
    }

    if (!result.retryable || attempt >= RSS_FETCH_MAX_ATTEMPTS || googleNewsCircuitOpen) {
      break;
    }

    await sleep(RSS_RETRY_BASE_DELAY_MS * attempt);
  }

  return last;
}

async function fetchBingNewsQuery(query: string) {
  return fetchRssUrl(buildBingNewsRssUrl(query), { origin: "bing-news" });
}

/**
 * Busca notícias por query de tema.
 * Google News primeiro; se o circuit breaker abrir ou vier vazio, cai no Bing News.
 */
export async function fetchGoogleNewsQuery(query: string) {
  if (!googleNewsCircuitOpen) {
    const googleItems = await fetchRssUrl(buildGoogleNewsRssUrl(query), {
      origin: "google-news",
    });
    if (googleItems.length > 0) {
      return googleItems;
    }
  }

  return fetchBingNewsQuery(query);
}

async function fetchGoogleNewsForSite(host: string, profile: PoliticianProfile) {
  if (googleNewsCircuitOpen) {
    return [];
  }

  const geo = [profile.city.trim(), profile.state.trim()].filter(Boolean).join(" ");
  const query = geo ? `site:${host} ${geo}` : `site:${host}`;
  return fetchRssUrl(buildGoogleNewsRssUrl(query), {
    origin: "google-news-site",
    siteHost: host,
  });
}

/**
 * Baixa so o inicio do HTML da home (ate achar </head> ou atingir o teto de
 * bytes) — o suficiente pra procurar <link rel="alternate">, sem puxar a
 * pagina inteira (imagens/scripts/anuncios ficam de fora, nunca sao lidos).
 */
async function fetchHtmlHeadCapped(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RSS_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        ...RSS_FETCH_HEADERS,
        Accept: "text/html,application/xhtml+xml",
      },
      signal: controller.signal,
      cache: "no-store",
      redirect: "follow",
    });

    if (!response.ok || !response.body) {
      return "";
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let html = "";
    let bytesRead = 0;

    try {
      while (bytesRead < HTML_DISCOVERY_MAX_BYTES) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        bytesRead += value.byteLength;
        html += decoder.decode(value, { stream: true });
        if (/<\/head>/i.test(html)) {
          break;
        }
      }
    } finally {
      await reader.cancel().catch(() => {});
    }

    return html;
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

/** Extrai a URL do feed declarado via <link rel="alternate" type="application/(rss|atom)+xml">. */
export function extractFeedLinkFromHtml(html: string, baseUrl: string): string | null {
  const linkRegex = /<link\b[^>]*>/gi;
  let match: RegExpExecArray | null = linkRegex.exec(html);

  while (match) {
    const tag = match[0];
    const rel = /rel\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase() ?? "";
    const type = /type\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase() ?? "";
    const href = /href\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];

    if (href && rel.includes("alternate") && (type.includes("rss+xml") || type.includes("atom+xml"))) {
      try {
        return new URL(href, baseUrl).toString();
      } catch {
        return null;
      }
    }

    match = linkRegex.exec(html);
  }

  return null;
}

/** Auto-descoberta: le a tag <link rel="alternate"> da home, sem depender de lista curada. */
async function discoverFeedUrlFromHomepage(host: string): Promise<string | null> {
  const base = `https://${host}`;
  const html = await fetchHtmlHeadCapped(`${base}/`);
  if (!html) {
    return null;
  }
  return extractFeedLinkFromHtml(html, base);
}

/** Linhas "Sitemap: ..." do robots.txt que parecem apontar pra um news sitemap. */
export function extractNewsSitemapUrlsFromRobots(robotsTxt: string): string[] {
  const matches = [...robotsTxt.matchAll(/^sitemap:\s*(\S+)/gim)];
  return matches.map((match) => match[1]).filter((url) => /news/i.test(url));
}

/** Auto-descoberta via robots.txt — pega Google News Sitemaps que muitos portais expoem sem RSS. */
async function discoverNewsSitemapUrls(host: string): Promise<string[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RSS_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(`https://${host}/robots.txt`, {
      headers: { ...RSS_FETCH_HEADERS, Accept: "text/plain" },
      signal: controller.signal,
      cache: "no-store",
      redirect: "follow",
    });
    if (!response.ok) {
      return [];
    }
    const text = await response.text();
    return extractNewsSitemapUrlsFromRobots(text);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function discoverPortalFeed(host: string, siteList: SentinelSiteList) {
  if (!host) {
    return [];
  }

  const knownUrls =
    KNOWN_PORTAL_FEED_URLS[host] ?? KNOWN_RESTRICTED_PORTAL_FEED_URLS[host] ?? [];
  for (const url of knownUrls) {
    const items = await fetchRssUrl(url, {
      origin: "portal-rss",
      siteList,
      siteHost: host,
      sourceName: host,
    });
    if (items.length > 0) {
      return items;
    }
  }

  const discoveredUrl = await discoverFeedUrlFromHomepage(host);
  if (discoveredUrl) {
    const items = await fetchRssUrl(discoveredUrl, {
      origin: "portal-rss",
      siteList,
      siteHost: host,
      sourceName: host,
    });
    if (items.length > 0) {
      return items;
    }
  }

  const sitemapUrls = await discoverNewsSitemapUrls(host);
  for (const url of sitemapUrls) {
    const items = await fetchRssUrl(url, {
      origin: "portal-rss",
      siteList,
      siteHost: host,
      sourceName: host,
    });
    if (items.length > 0) {
      return items;
    }
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
  siteList: SentinelSiteList,
  profile: PoliticianProfile,
) {
  const hosts = [...new Set(sites.map(normalizePortalHost).filter(Boolean))].slice(
    0,
    MAX_PORTAL_SITES_PER_LIST,
  );

  const batches = await mapWithConcurrency(hosts, RSS_FETCH_CONCURRENCY, async (host) => {
    // Sempre tenta RSS direto primeiro — Google News costuma retornar 503 no Cloud Run.
    const direct = await discoverPortalFeed(host, siteList);
    if (direct.length > 0) {
      return direct;
    }

    return fetchGoogleNewsForSite(host, profile).then((items) =>
      items.map((item) => ({ ...item, siteList, siteHost: host })),
    );
  });

  return batches.flat();
}

export async function fetchSentinelNewsItems(profile: PoliticianProfile) {
  const queries = buildSentinelRssQueries(profile);
  const catalogHosts = {
    federal: hasFederalRadar(profile) ? getNationalPortalHosts() : [],
    estadual: hasEstadualRadar(profile) ? getStatePortalHosts(profile.state) : [],
  };

  const hasRadar =
    queries.length > 0 ||
    catalogHosts.federal.length > 0 ||
    catalogHosts.estadual.length > 0 ||
    profile.interestSites.some((site) => site.trim()) ||
    profile.interestProfiles.some((row) => row.handle.trim()) ||
    hasAdversaryRadar(profile);

  if (!hasRadar) {
    return [];
  }

  const [googleNewsBatches, federalPortalItems, estadualPortalItems, interestPortalItems] =
    await Promise.all([
      mapWithConcurrency(queries, RSS_FETCH_CONCURRENCY, (query) =>
        fetchGoogleNewsQuery(query),
      ),
      fetchPortalSites(catalogHosts.federal, "federal", profile),
      fetchPortalSites(catalogHosts.estadual, "estadual", profile),
      fetchPortalSites(profile.interestSites, "interest", profile),
    ]);

  return dedupeNewsItems([
    ...googleNewsBatches.flat(),
    ...federalPortalItems,
    ...estadualPortalItems,
    ...interestPortalItems,
  ]).slice(0, MAX_COLLECTED_NEWS_ITEMS);
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
  const batches = await mapWithConcurrency(queries, RSS_FETCH_CONCURRENCY, (query) =>
    fetchGoogleNewsQuery(query),
  );

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

  if (article.siteList === "federal") {
    score += 7;
  } else if (article.siteList === "estadual") {
    score += 7;
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
  sphere?: "federal" | "estadual" | "municipal";
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
