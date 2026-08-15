/**
 * Orquestrador da tela "Notícias do Dia": monta as 3 listas (nacional/estadual/
 * municipal) a partir do catálogo de portais já existente + busca isolada por
 * portal (noticias-do-dia-fetch.ts). Não depende de tema, radar ou do pipeline
 * do Sentinela.
 *
 * Volume igual ao original (até 3 manchetes relevantes por portal, teto de 15
 * por esfera) — a diversidade de fontes vira responsabilidade da ORDEM, não da
 * contagem: os itens saem em "rodadas" (1ª manchete de cada portal primeiro,
 * depois a 2ª de quem tiver, depois a 3ª), então o prefixo da lista nunca repete
 * fonte. A tela usa isso pra mostrar só a 1ª rodada de cara e o resto atrás do
 * "Ver mais" (ver noticias-do-dia-page.tsx).
 */

import {
  getNationalPortalHosts,
  getPortalHostLabel,
  getStatePortalHosts,
} from "@/lib/sentinel-portal-catalog";
import type { MockSentinelSuggestion } from "@/lib/sentinel-mock-suggestions";
import type { PoliticianProfile } from "@/lib/types";
import { fetchLatestArticlesForHost, type NoticiaDoDiaArticle } from "@/lib/noticias-do-dia-fetch";
import { isPoliticallyRelevantHeadline } from "@/lib/noticias-do-dia-relevance";

export type NoticiaDoDiaSphere = "nacional" | "estadual" | "municipal";

/** Prefixo dos ids gerados aqui — usado pelo fallback de compat do botão "Pautar". */
export const NOTICIAS_DO_DIA_ID_PREFIX = "ndd-";

/** Pool candidato por portal — maior que ARTICLES_PER_PORTAL pra sobrar opção depois do filtro de relevância. */
const CANDIDATE_POOL_PER_PORTAL = 8;
/** Volume por portal e teto por esfera — mesmos números de antes do filtro de diversidade. */
const ARTICLES_PER_PORTAL = 3;
const MAX_ITEMS_PER_SPHERE = 15;

const SPHERE_TITLES: Record<NoticiaDoDiaSphere, string> = {
  nacional: "Nacional",
  estadual: "Estadual",
  municipal: "Municipal",
};

type HostEntry = { host: string; label: string };

function normalizeHostInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const host = new URL(withProtocol).hostname.toLowerCase().replace(/^www\./, "");
    return host || null;
  } catch {
    return null;
  }
}

/** Hash simples e determinístico — só precisa ser estável dentro de uma mesma coleta, não entre dias. */
function stableArticleId(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i += 1) {
    hash = (Math.imul(hash, 31) + url.charCodeAt(i)) >>> 0;
  }
  return `${NOTICIAS_DO_DIA_ID_PREFIX}${hash.toString(36)}`;
}

/** Até ARTICLES_PER_PORTAL manchetes relevantes por portal (descarta o resto do pool). */
function relevantPerHost(perHost: NoticiaDoDiaArticle[][]): NoticiaDoDiaArticle[][] {
  return perHost.map((articles) =>
    articles
      .filter((article) => isPoliticallyRelevantHeadline(article.title, article.summary))
      .slice(0, ARTICLES_PER_PORTAL),
  );
}

function articlePublishedAtMs(article: NoticiaDoDiaArticle): number {
  if (!article.publishedAt) {
    return 0;
  }
  const time = new Date(article.publishedAt).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function sortByRecency(articles: NoticiaDoDiaArticle[]): NoticiaDoDiaArticle[] {
  return [...articles].sort((a, b) => articlePublishedAtMs(b) - articlePublishedAtMs(a));
}

/**
 * Portais configurados que não renderam nenhuma manchete relevante nesta coleta
 * — usado só pro municipal (nacional/estadual vêm de catálogo fixo, o usuário
 * não escolhe, então não há o que "trocar"). Vira aviso na tela pedindo pra
 * trocar o portal (ver noticias-do-dia-page.tsx).
 */
function failedHostLabels(hosts: HostEntry[], perHostRelevant: NoticiaDoDiaArticle[][]): string[] {
  return hosts
    .filter((_host, index) => (perHostRelevant[index]?.length ?? 0) === 0)
    .map((host) => host.label);
}

/**
 * Monta a lista em rodadas: a 1ª manchete de CADA portal primeiro (nunca repete
 * fonte nessa rodada), depois a 2ª de quem ainda tiver, depois a 3ª — até bater
 * o teto. Cada rodada é ordenada por data entre si antes de entrar na lista.
 */
function roundRobin(perHostRelevant: NoticiaDoDiaArticle[][], cap: number): NoticiaDoDiaArticle[] {
  const rounds: NoticiaDoDiaArticle[][] = [];
  for (let round = 0; round < ARTICLES_PER_PORTAL; round += 1) {
    const roundItems = perHostRelevant
      .map((articles) => articles[round])
      .filter((article): article is NoticiaDoDiaArticle => Boolean(article));
    if (roundItems.length) {
      rounds.push(sortByRecency(roundItems));
    }
  }
  return rounds.flat().slice(0, cap);
}

function toSuggestion(article: NoticiaDoDiaArticle, sphere: NoticiaDoDiaSphere): MockSentinelSuggestion {
  // Sem data real do portal, o card mostra "hoje" sem horário (prop
  // noDateFallbackToToday) — não inventa um horário aqui, senão o card não
  // teria como distinguir "hora real" de "hora do momento da coleta".
  const publishedAt = article.publishedAt;
  return {
    id: stableArticleId(article.url),
    themeLabel: article.sourceName,
    matchedThemes: [],
    relevanceScore: 0,
    topic: `${SPHERE_TITLES[sphere]} · ${article.sourceName}`,
    // Subtítulo do feed (quando o portal fornece um) — o card já sabe renderizar
    // isso embaixo do título, é o mesmo slot usado pelo briefing editorial do Sentinela.
    briefing: article.summary,
    evidence: {
      byNetwork: [],
      actors: [],
      articles: [
        {
          title: article.title,
          url: article.url,
          sourceName: article.sourceName,
          publishedAt,
        },
      ],
      postsAnalyzed: 0,
      engagementTrendPercent: 0,
    },
    engagement: {
      relevanceScore: 0,
      scoreTrendPercent: 0,
      likes: 0,
      comments: 0,
      postsAnalyzed: 0,
      sources: [],
      byNetwork: [],
    },
  };
}

async function fetchPerHost(hosts: HostEntry[]): Promise<NoticiaDoDiaArticle[][]> {
  return Promise.all(
    hosts.map(({ host, label }) => fetchLatestArticlesForHost(host, label, CANDIDATE_POOL_PER_PORTAL)),
  );
}

export type NoticiasDoDiaResult = {
  nacional: MockSentinelSuggestion[];
  estadual: MockSentinelSuggestion[];
  municipal: MockSentinelSuggestion[];
  meta: {
    generatedAt: string;
    stateUf: string | null;
    nationalPortalCount: number;
    statePortalCount: number;
    municipalPortalCount: number;
    /** Rótulos dos portais municipais cadastrados que não renderam nada nesta coleta. */
    municipalFailedPortals: string[];
  };
};

export async function fetchNoticiasDoDia(profile: PoliticianProfile): Promise<NoticiasDoDiaResult> {
  const nationalHosts: HostEntry[] = getNationalPortalHosts().map((host) => ({
    host,
    label: getPortalHostLabel(host),
  }));
  const stateHosts: HostEntry[] = getStatePortalHosts(profile.state).map((host) => ({
    host,
    label: getPortalHostLabel(host),
  }));
  const municipalHosts: HostEntry[] = Array.from(
    new Set(profile.interestSites.map(normalizeHostInput).filter((host): host is string => Boolean(host))),
  ).map((host) => ({ host, label: getPortalHostLabel(host) }));

  const [nationalPerHost, statePerHost, municipalPerHost] = await Promise.all([
    fetchPerHost(nationalHosts),
    fetchPerHost(stateHosts),
    fetchPerHost(municipalHosts),
  ]);

  const municipalRelevant = relevantPerHost(municipalPerHost);

  const nacional = roundRobin(relevantPerHost(nationalPerHost), MAX_ITEMS_PER_SPHERE).map((article) =>
    toSuggestion(article, "nacional"),
  );
  const estadual = roundRobin(relevantPerHost(statePerHost), MAX_ITEMS_PER_SPHERE).map((article) =>
    toSuggestion(article, "estadual"),
  );
  const municipal = roundRobin(municipalRelevant, MAX_ITEMS_PER_SPHERE).map((article) =>
    toSuggestion(article, "municipal"),
  );

  return {
    nacional,
    estadual,
    municipal,
    meta: {
      generatedAt: new Date().toISOString(),
      stateUf: profile.state || null,
      municipalFailedPortals: failedHostLabels(municipalHosts, municipalRelevant),
      nationalPortalCount: nationalHosts.length,
      statePortalCount: stateHosts.length,
      municipalPortalCount: municipalHosts.length,
    },
  };
}

export function findNoticiaDoDiaById(
  result: Pick<NoticiasDoDiaResult, "nacional" | "estadual" | "municipal">,
  id: string,
): MockSentinelSuggestion | null {
  return (
    result.nacional.find((item) => item.id === id) ??
    result.estadual.find((item) => item.id === id) ??
    result.municipal.find((item) => item.id === id) ??
    null
  );
}
