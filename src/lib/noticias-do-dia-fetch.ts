/**
 * Busca de manchetes cruas por portal para a tela "Notícias do Dia".
 *
 * Mecanismo isolado de propósito: não importa nada de sentinel-rss.ts nem de
 * sentinel-suggestions.ts. Aqui não existe tema, cluster ou LLM — só "pega as
 * N matérias mais recentes do feed RSS/Atom deste host", uma função por vez.
 */

export type NoticiaDoDiaArticle = {
  title: string;
  url: string;
  sourceName: string;
  publishedAt?: string;
  /** Subtítulo/lide do feed (<description>/<summary>), quando o portal fornece um distinto do título. */
  summary?: string;
};

const REQUEST_TIMEOUT_MS = 4000;
const USER_AGENT =
  "Mozilla/5.0 (compatible; MandatoDigitalNoticiasDoDia/1.0; +https://mandatodigital.com.br)";

/**
 * Caminhos de feed mais comuns entre portais de notícia brasileiros.
 * `/dynamo/rss2.xml` é a convenção real do G1 (CMS "Dynamo" da Globo) — G1 não
 * expõe `<link alternate>` na home nem responde em nenhum caminho genérico,
 * então sem essa entrada específica ele nunca é descoberto (confirmado testando
 * manualmente contra o site real).
 */
const COMMON_FEED_PATHS = [
  "/feed",
  "/rss",
  "/feed.xml",
  "/rss.xml",
  "/rss/index.xml",
  "/dynamo/rss2.xml",
];

async function fetchText(url: string, timeoutMs = REQUEST_TIMEOUT_MS): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      cache: "no-store",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.8, */*;q=0.5",
      },
    });
    if (!response.ok) {
      return null;
    }
    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function looksLikeFeed(body: string): boolean {
  const head = body.slice(0, 400).toLowerCase();
  return head.includes("<rss") || head.includes("<feed") || head.includes("<?xml");
}

/** Descoberta simples de feed: tenta caminhos conhecidos e, por último, o <link rel="alternate"> da home. */
async function discoverFeedBody(host: string): Promise<string | null> {
  for (const path of COMMON_FEED_PATHS) {
    const body = await fetchText(`https://${host}${path}`);
    if (body && looksLikeFeed(body)) {
      return body;
    }
  }

  const homepage = await fetchText(`https://${host}/`);
  if (!homepage) {
    console.log(`[noticias-do-dia] ${host}: nenhum feed encontrado (caminhos comuns e home falharam)`);
    return null;
  }
  const linkMatch =
    /<link[^>]+rel=["']alternate["'][^>]+type=["']application\/(?:rss|atom)\+xml["'][^>]+href=["']([^"']+)["']/i.exec(
      homepage,
    ) ??
    /<link[^>]+type=["']application\/(?:rss|atom)\+xml["'][^>]+href=["']([^"']+)["']/i.exec(homepage);
  const feedHref = linkMatch?.[1];
  if (!feedHref) {
    console.log(`[noticias-do-dia] ${host}: nenhum feed encontrado (sem <link alternate rss/atom> na home)`);
    return null;
  }
  const feedUrl = feedHref.startsWith("http") ? feedHref : new URL(feedHref, `https://${host}/`).toString();
  const body = await fetchText(feedUrl);
  return body && looksLikeFeed(body) ? body : null;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/<[^>]+>/g, "")
    .trim();
}

function extractTag(block: string, tag: string): string | null {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i").exec(block);
  return match ? decodeXmlEntities(match[1]) : null;
}

function extractLink(block: string): string | null {
  const cdataOrText = extractTag(block, "link");
  if (cdataOrText && cdataOrText.startsWith("http")) {
    return cdataOrText;
  }
  // Atom: <link href="..."/>
  const hrefMatch = /<link[^>]+href=["']([^"']+)["']/i.exec(block);
  return hrefMatch?.[1] ?? cdataOrText;
}

function extractPublishedAt(block: string): string | undefined {
  const raw =
    extractTag(block, "pubDate") ??
    extractTag(block, "published") ??
    extractTag(block, "updated") ??
    extractTag(block, "dc:date");
  if (!raw) {
    return undefined;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

const MAX_SUMMARY_LENGTH = 220;

/** Subtítulo do card — <description> (RSS) ou <summary> (Atom), cortado e sem repetir o título. */
function extractSummary(block: string, title: string): string | undefined {
  const raw = extractTag(block, "description") ?? extractTag(block, "summary");
  if (!raw) {
    return undefined;
  }
  const normalized = raw.replace(/\s+/g, " ").trim();
  if (!normalized || normalized.toLowerCase() === title.trim().toLowerCase()) {
    return undefined;
  }
  return normalized.length > MAX_SUMMARY_LENGTH
    ? `${normalized.slice(0, MAX_SUMMARY_LENGTH - 1).trimEnd()}…`
    : normalized;
}

type ParsedFeedEntry = {
  title: string;
  url: string;
  publishedAt?: string;
  summary?: string;
};

function parseFeedEntries(xml: string): ParsedFeedEntry[] {
  const blocks = [
    ...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi),
    ...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi),
  ];

  const entries: ParsedFeedEntry[] = [];
  for (const match of blocks) {
    const block = match[1];
    const title = extractTag(block, "title");
    const url = extractLink(block);
    if (!title || !url) {
      continue;
    }
    entries.push({
      title,
      url,
      publishedAt: extractPublishedAt(block),
      summary: extractSummary(block, title),
    });
  }
  return entries;
}

/** Busca as `limit` manchetes mais recentes do feed de `host`. Retorna [] em qualquer falha — sem lançar. */
export async function fetchLatestArticlesForHost(
  host: string,
  sourceName: string,
  limit: number,
): Promise<NoticiaDoDiaArticle[]> {
  try {
    const feedBody = await discoverFeedBody(host);
    if (!feedBody) {
      return [];
    }
    const parsed = parseFeedEntries(feedBody);
    if (parsed.length === 0) {
      // Feed foi encontrado e validado como XML/RSS, mas veio sem <item>/<entry> —
      // acontece com alguns portais que servem um "casco" de feed vazio pra tráfego
      // automatizado (ex.: oglobo.globo.com/rss). Não é bug de parsing.
      console.log(`[noticias-do-dia] ${host}: feed encontrado mas sem itens (${feedBody.length} chars)`);
    }
    return parsed
      .slice(0, limit)
      .map((entry) => ({
        title: entry.title,
        url: entry.url,
        sourceName,
        publishedAt: entry.publishedAt,
        summary: entry.summary,
      }));
  } catch {
    return [];
  }
}
