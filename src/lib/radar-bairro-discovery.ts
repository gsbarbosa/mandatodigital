/**
 * Curadoria do Radar de Bairro: descobre o grupo de Facebook de uma localidade e
 * decide se ele presta.
 *
 * A descoberta acontece POR FORA do Facebook, num buscador — grupo público é
 * indexado, e assim não dependemos de nenhuma conta logada. Testado em 2 cidades:
 * a busca combina "bairro + cidade", o que desambigua sozinho até nome que colide
 * feio (buscar "Cruzeiro" em Arcos/MG não trouxe nada do time de futebol,
 * enquanto a mesma palavra no Instagram trouxe 100% futebol).
 *
 * Isso é caro e lento — roda no cadastro da localidade, nunca no refresh diário.
 *
 * Ver docs/radar-de-bairro.md.
 */

import { fetchFacebookGroupPosts } from "@/lib/radar-bairro-facebook";
import { passesCheapNoiseFilter } from "@/lib/radar-bairro-relevance";
import type {
  RadarBairroLocality,
  RadarBairroLocalityKind,
  RadarBairroLocalitySource,
} from "@/lib/radar-bairro-types";

/** Amostra usada só pra qualificar o grupo — pequena de propósito (é custo). */
const VERIFICATION_SAMPLE_SIZE = 25;

/**
 * Mínimos pra um grupo entrar no cadastro. Os dois vieram de caso real:
 * - um grupo com nome perfeito ("Vila Amélia") tinha ~30 posts NO ANO — vivo no
 *   papel, morto na prática;
 * - outro tinha volume alto e recente, mas 100% classificado ("Montese") — ativo
 *   e inútil.
 * Por isso não basta ter post: precisa ter post que sobreviva à peneira.
 */
const MIN_POSTS_WITH_TEXT = 3;
const MIN_RELEVANT_POSTS = 1;

const SERPAPI_ENDPOINT = "https://serpapi.com/search.json";

function getSerpApiKey(): string {
  return process.env.SENTINEL_SERPAPI_KEY?.trim() || "";
}

export function isRadarBairroDiscoveryConfigured(): boolean {
  return Boolean(getSerpApiKey());
}

/** Só grupo — página e post avulso não servem como fonte contínua. */
function extractGroupUrl(link: string): string | null {
  const match = /https?:\/\/(?:[a-z-]+\.)?facebook\.com\/groups\/([A-Za-z0-9._-]+)/i.exec(link);
  if (!match) {
    return null;
  }
  const slug = match[1];
  if (!slug || slug === "feed" || slug === "discover") {
    return null;
  }
  return `https://www.facebook.com/groups/${slug}/`;
}

type SerpResult = { link?: unknown; title?: unknown };

/**
 * Consultas em ordem de precisão. "Associação de moradores" e "sociedade amigos"
 * entram porque são a forma organizada clássica no Brasil — numa das buscas de
 * teste foi justamente o que apareceu (SAVIMA, em SP).
 */
function buildQueries(localityName: string, city: string, uf: string): string[] {
  const place = `"${localityName}"`;
  const where = `${city} ${uf}`.trim();
  return [
    `site:facebook.com/groups ${place} ${where} moradores`,
    `site:facebook.com/groups ${place} ${where} (associação de moradores OR sociedade amigos)`,
    `site:facebook.com/groups ${place} ${where}`,
  ];
}

async function searchGroupCandidates(
  localityName: string,
  city: string,
  uf: string,
): Promise<{ url: string; title: string }[]> {
  const apiKey = getSerpApiKey();
  if (!apiKey) {
    return [];
  }

  const found = new Map<string, string>();

  for (const query of buildQueries(localityName, city, uf)) {
    const params = new URLSearchParams({
      q: query,
      engine: "google",
      google_domain: "google.com.br",
      gl: "br",
      hl: "pt-br",
      num: "10",
      api_key: apiKey,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch(`${SERPAPI_ENDPOINT}?${params.toString()}`, {
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) {
        continue;
      }
      const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
      const organic = payload?.organic_results;
      if (!Array.isArray(organic)) {
        continue;
      }
      for (const item of organic as SerpResult[]) {
        const url = extractGroupUrl(String(item?.link ?? ""));
        if (url && !found.has(url)) {
          found.set(url, String(item?.title ?? "").trim());
        }
      }
    } catch {
      // Busca é melhor esforço — falhou, tenta a próxima consulta.
    } finally {
      clearTimeout(timeout);
    }

    // Já tem candidato suficiente pra verificar: não gasta as outras consultas.
    if (found.size >= 3) {
      break;
    }
  }

  return [...found.entries()].map(([url, title]) => ({ url, title }));
}

export type LocalityVerification = {
  postsWithText: number;
  relevantPosts: number;
  approved: boolean;
};

/**
 * Qualifica um grupo por amostragem: tem post com texto de verdade E parte desse
 * texto sobrevive à peneira de ruído? Só o segundo separa comunidade de mural de
 * classificados.
 */
export async function verifyGroupQuality(
  groupUrl: string,
  localityName: string,
): Promise<LocalityVerification> {
  const posts = await fetchFacebookGroupPosts({
    groupUrl,
    localityName,
    limit: VERIFICATION_SAMPLE_SIZE,
  });

  const postsWithText = posts.length;
  const relevantPosts = posts.filter((post) => passesCheapNoiseFilter(post.text)).length;

  return {
    postsWithText,
    relevantPosts,
    approved: postsWithText >= MIN_POSTS_WITH_TEXT && relevantPosts >= MIN_RELEVANT_POSTS,
  };
}

/**
 * Descobre + verifica em um passo. Devolve sempre uma localidade (com status),
 * nunca lança — "não achei" e "achei e é ruim" são resultados normais, tratados
 * na tela e sem consumir cota do plano.
 */
export async function curateLocality(input: {
  name: string;
  city: string;
  uf: string;
  kind: RadarBairroLocalityKind;
  source: RadarBairroLocalitySource;
}): Promise<RadarBairroLocality> {
  const base: RadarBairroLocality = {
    kind: input.kind,
    source: input.source,
    name: input.name.trim(),
    city: input.city.trim(),
    uf: input.uf.trim().toUpperCase(),
    status: "sem-grupo",
    groupUrl: null,
    groupTitle: null,
    sampledPosts: 0,
    sampledRelevant: 0,
    verifiedAt: new Date().toISOString(),
  };

  if (!base.name) {
    return base;
  }

  const candidates = await searchGroupCandidates(base.name, base.city, base.uf);
  if (!candidates.length) {
    return base;
  }

  let bestRejected: RadarBairroLocality | null = null;

  for (const candidate of candidates) {
    const verification = await verifyGroupQuality(candidate.url, base.name);

    if (verification.approved) {
      return {
        ...base,
        status: "ativo",
        groupUrl: candidate.url,
        groupTitle: candidate.title || null,
        sampledPosts: verification.postsWithText,
        sampledRelevant: verification.relevantPosts,
      };
    }

    // Guarda o menos ruim só pra explicar na tela por que reprovou.
    if (!bestRejected || verification.postsWithText > bestRejected.sampledPosts) {
      bestRejected = {
        ...base,
        status: "reprovado",
        groupUrl: candidate.url,
        groupTitle: candidate.title || null,
        sampledPosts: verification.postsWithText,
        sampledRelevant: verification.relevantPosts,
      };
    }
  }

  return bestRejected ?? base;
}
