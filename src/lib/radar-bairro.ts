/**
 * Orquestrador do Radar de Bairro.
 *
 * Duas operações bem diferentes, de propósito:
 *
 * 1. `bootstrapRegistry` — CURADORIA. Cara e lenta (busca externa + amostragem
 *    paga por candidato). Roda quando o mandato entra ou troca de cidade, com
 *    tela de carregamento própria. É aqui que a decisão cidade × bairro acontece,
 *    sem o usuário digitar nada.
 *
 * 2. `collectRadarBairro` — COLETA. Lê o registry já pronto e busca os posts.
 *    É o que o botão "atualizar" chama, e precisa caber no tempo do Sentinela.
 *
 * Ver docs/radar-de-bairro.md.
 */

import { curateLocality } from "@/lib/radar-bairro-discovery";
import { fetchFacebookGroupPosts } from "@/lib/radar-bairro-facebook";
import { fetchOsmNeighborhoods, rankNeighborhoodCandidates, resolveCityMode } from "@/lib/radar-bairro-geo";
import { filterRadarBairroPosts } from "@/lib/radar-bairro-relevance";
import { activeLocalities, emptyRegistry, type RadarBairroRegistry } from "@/lib/radar-bairro-storage";
import {
  emptyRadarBairroResult,
  type RadarBairroLocality,
  type RadarBairroPost,
  type RadarBairroResult,
} from "@/lib/radar-bairro-types";

/**
 * Quantas localidades a busca AUTOMÁTICA mantém por cidade grande. Não é a cota
 * do plano (essa é do candidato, em account-tier) — é o teto do que o sistema
 * cadastra sozinho, sem ninguém pedir.
 */
export const AUTO_LOCALITIES_TARGET = 5;

/**
 * Teto de bairros TENTADOS na curadoria automática. Maior que o alvo porque nem
 * todo candidato passa na verificação — dá chance real de fechar 5 bons sem
 * deixar a busca (que é paga) correr solta.
 */
const AUTO_LOCALITIES_MAX_ATTEMPTS = 8;

/** Posts buscados por localidade em cada coleta. */
const POSTS_PER_LOCALITY = 30;

/**
 * Monta (ou refaz) o registry da cidade do mandato.
 *
 * Cidade abaixo do corte populacional vira uma única localidade "cidade" — nas
 * cidades pequenas o grupo de bairro em geral nem existe, só o da cidade inteira.
 * Acima do corte, tenta bairros priorizados até fechar o alvo.
 */
export async function bootstrapRegistry(input: {
  city: string;
  uf: string;
  knownNeighborhoods?: string[];
}): Promise<RadarBairroRegistry> {
  const city = input.city.trim();
  const uf = input.uf.trim().toUpperCase();
  if (!city) {
    return emptyRegistry(city, uf);
  }

  const cityMode = await resolveCityMode(city, uf);
  const registry: RadarBairroRegistry = {
    city,
    uf,
    mode: cityMode.mode,
    population: cityMode.population,
    localities: [],
    updatedAt: new Date().toISOString(),
  };

  if (cityMode.mode === "cidade") {
    const locality = await curateLocality({
      name: city,
      city,
      uf,
      kind: "cidade",
      source: "automatico",
    });
    registry.localities = [locality];
    return registry;
  }

  const neighborhoods = await fetchOsmNeighborhoods(city, uf);
  const ranked = rankNeighborhoodCandidates(neighborhoods, input.knownNeighborhoods ?? []);

  const localities: RadarBairroLocality[] = [];
  let approved = 0;

  for (const name of ranked.slice(0, AUTO_LOCALITIES_MAX_ATTEMPTS)) {
    if (approved >= AUTO_LOCALITIES_TARGET) {
      break;
    }
    const locality = await curateLocality({
      name,
      city,
      uf,
      kind: "bairro",
      source: "automatico",
    });
    // Só guarda o que deu certo — bairro sem grupo vira ruído no cadastro e
    // seria retentado à toa em toda coleta.
    if (locality.status === "ativo") {
      localities.push(locality);
      approved += 1;
    }
  }

  // Cidade grande sem nenhum bairro aprovado ainda precisa de alguma fonte:
  // tenta o município como rede de segurança, igual à cidade pequena.
  if (!localities.length) {
    const fallback = await curateLocality({
      name: city,
      city,
      uf,
      kind: "cidade",
      source: "automatico",
    });
    if (fallback.status === "ativo") {
      localities.push(fallback);
    }
  }

  registry.localities = localities;
  return registry;
}

/**
 * Coleta e filtra os posts das localidades já cadastradas.
 *
 * Cada grupo é buscado em paralelo e falha isolada: um grupo que saiu do ar
 * (aconteceu de verdade nos testes — 2 de 3 grupos falharam num reteste) não
 * pode derrubar a coleta dos outros.
 */
export async function collectRadarBairro(
  registry: RadarBairroRegistry,
): Promise<RadarBairroResult> {
  const localities = activeLocalities(registry);
  if (!localities.length) {
    return emptyRadarBairroResult(registry.city, registry.uf);
  }

  const perLocality = await Promise.all(
    localities.map(async (locality) => ({
      locality,
      posts: await fetchFacebookGroupPosts({
        groupUrl: locality.groupUrl!,
        localityName: locality.name,
        limit: POSTS_PER_LOCALITY,
      }),
    })),
  );

  const allPosts: RadarBairroPost[] = perLocality.flatMap((entry) => entry.posts);
  const cityLabel = `${registry.city}${registry.uf ? `/${registry.uf}` : ""}`;
  const { signals } = await filterRadarBairroPosts(allPosts, { cityLabel });

  const withSignal = new Set(signals.map((signal) => signal.localityName));

  return {
    signals: signals.sort((left, right) => {
      const leftTime = left.publishedAt ? new Date(left.publishedAt).getTime() : 0;
      const rightTime = right.publishedAt ? new Date(right.publishedAt).getTime() : 0;
      return rightTime - leftTime;
    }),
    meta: {
      generatedAt: new Date().toISOString(),
      city: registry.city,
      uf: registry.uf,
      localities: localities.map((item) => item.name),
      emptyLocalities: localities
        .map((item) => item.name)
        .filter((name) => !withSignal.has(name)),
      postsCollected: allPosts.length,
      postsKept: signals.length,
    },
  };
}
