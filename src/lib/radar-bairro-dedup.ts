/**
 * Deduplicação entre fontes diferentes cobrindo o mesmo evento.
 *
 * A deduplicação por autor+texto (dentro de `normalizeFacebookGroupItems`) só
 * pega o mesmo autor repostando texto idêntico. Achado real testando dado do
 * X: duas contas de notícia diferentes (@otempo e @TumultoBR) cobriram o MESMO
 * acidente de ônibus com texto e autor diferentes — isso passa batido por ali.
 *
 * Tentamos resolver só com sobreposição de palavras (Jaccard) e o número
 * calibrado contra dado real derrubou a ideia: o par de duplicata verdadeira
 * (mesmo acidente, fontes diferentes) deu 0,200; o par mais parecido que NÃO é
 * duplicata (2 crimes diferentes no Castelo, mesmo veículo de notícia — o
 * vocabulário compartilhado é só o estilo do repórter, não o fato) deu 0,182.
 * Diferença de 0,018 não é limiar confiável — é ruído. Por isso o desenho é em
 * 2 estágios, igual ao filtro de relevância: a peneira barata só ACHA
 * CANDIDATO (limiar bem baixo, pega os dois pares acima de sobra); quem decide
 * se é o mesmo evento de verdade é a IA.
 *
 * Ver docs/radar-de-bairro.md.
 */

import { requestStructuredJson, parseJsonResponse } from "@/lib/llm";
import { z } from "zod";

import { isRadarBairroLlmEnabled } from "@/lib/feature-flags";
import type { RadarBairroPost } from "@/lib/radar-bairro-types";

const STOPWORDS = new Set([
  "a", "o", "as", "os", "um", "uma", "uns", "umas", "de", "da", "do", "das", "dos", "em", "no", "na",
  "nos", "nas", "para", "pra", "por", "com", "sem", "que", "se", "e", "ou", "mas", "como", "quando",
  "onde", "porque", "foi", "foram", "ser", "está", "estão", "este", "esta", "esses", "essas", "isso",
  "isto", "seu", "sua", "seus", "suas", "ao", "aos", "até", "desde", "entre", "sobre", "também", "não",
  "sim", "muito", "mais", "menos", "já", "ainda", "só", "apenas", "cerca", "tarde", "noite", "manhã",
  "hoje", "ontem", "amanhã", "dia", "dias", "região", "bairro", "belo", "horizonte",
]);

function normalizeToken(word: string): string {
  return word
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function significantWords(text: string): Set<string> {
  const words = text
    .split(/\s+/)
    .map(normalizeToken)
    .filter((word) => word.length > 3 && !STOPWORDS.has(word));
  return new Set(words);
}

export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) {
    return 0;
  }
  let intersection = 0;
  for (const word of a) {
    if (b.has(word)) {
      intersection += 1;
    }
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Limiar de CANDIDATO, não de decisão — deliberadamente baixo. Calibrado pra
 * pegar os dois pares reais testados (0,200 e 0,182) com folga, mesmo sabendo
 * que um dos dois vai ser descartado pela IA depois.
 */
const CANDIDATE_SIMILARITY_THRESHOLD = 0.15;

/** Cobertura do mesmo evento tende a sair perto no tempo; sem data, não descarta por tempo. */
const DUPLICATE_TIME_WINDOW_MS = 72 * 60 * 60 * 1000;

function withinTimeWindow(a: RadarBairroPost, b: RadarBairroPost): boolean {
  if (!a.publishedAt || !b.publishedAt) {
    return true;
  }
  const diff = Math.abs(new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());
  return diff <= DUPLICATE_TIME_WINDOW_MS;
}

function engagementScore(post: RadarBairroPost): number {
  return post.likes + post.comments;
}

/** Pares candidatos, por índice — a peneira barata, isolada pra ficar testável. */
export function findCandidateDuplicatePairs(posts: RadarBairroPost[]): [number, number][] {
  const wordSets = posts.map((post) => significantWords(post.text));
  const pairs: [number, number][] = [];
  for (let i = 0; i < posts.length; i += 1) {
    for (let j = i + 1; j < posts.length; j += 1) {
      if (!withinTimeWindow(posts[i]!, posts[j]!)) {
        continue;
      }
      if (jaccardSimilarity(wordSets[i]!, wordSets[j]!) >= CANDIDATE_SIMILARITY_THRESHOLD) {
        pairs.push([i, j]);
      }
    }
  }
  return pairs;
}

const sameEventSchema = z.object({ mesmo_evento: z.boolean() });

/**
 * Confirma se um par candidato é de fato o mesmo evento. Indisponibilidade da
 * IA cai pro lado seguro: NÃO funde — post duplicado visível é ruim, post real
 * perdido por fusão errada é pior (não tem estágio depois pra recuperar).
 */
async function confirmSameEvent(a: RadarBairroPost, b: RadarBairroPost): Promise<boolean> {
  if (!isRadarBairroLlmEnabled()) {
    return false;
  }

  const execution = await requestStructuredJson(
    "Voce decide se dois posts descrevem o MESMO evento do mundo real (mesmo fato, " +
      "possivelmente contado por fontes diferentes com palavras diferentes) ou eventos " +
      "DIFERENTES que só parecem parecidos por estarem na mesma região ou terem o mesmo " +
      "estilo de escrita (ex.: dois crimes distintos cobertos pelo mesmo veículo de " +
      "noticia). Responda APENAS JSON: { \"mesmo_evento\": true|false }.",
    `Post 1: ${a.text.slice(0, 500)}\n\nPost 2: ${b.text.slice(0, 500)}`,
    { temperature: 0, maxTokens: 40 },
  ).catch(() => null);

  if (!execution?.rawText) {
    return false;
  }
  const parsed = sameEventSchema.safeParse(parseJsonResponse<unknown>(execution.rawText));
  return parsed.success && parsed.data.mesmo_evento;
}

/**
 * Agrupa posts do mesmo evento (qualquer fonte) e mantém 1 por grupo — o de
 * maior engajamento; empate, o texto mais longo (mais informativo); empate, o
 * primeiro. Union-find: cobre o caso transitivo (A~B, B~C confirmados → 1 grupo).
 */
export async function deduplicatePosts<T extends RadarBairroPost>(posts: T[]): Promise<T[]> {
  if (posts.length < 2) {
    return posts;
  }

  const candidates = findCandidateDuplicatePairs(posts);
  if (!candidates.length) {
    return posts;
  }

  const parent = posts.map((_, index) => index);
  function find(index: number): number {
    let current = index;
    while (parent[current] !== current) {
      parent[current] = parent[parent[current]!]!;
      current = parent[current]!;
    }
    return current;
  }
  function union(a: number, b: number) {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) {
      parent[rootA] = rootB;
    }
  }

  const confirmations = await Promise.all(
    candidates.map(([i, j]) => confirmSameEvent(posts[i]!, posts[j]!)),
  );
  candidates.forEach(([i, j], index) => {
    if (confirmations[index]) {
      union(i, j);
    }
  });

  const clusters = new Map<number, number[]>();
  posts.forEach((_, index) => {
    const root = find(index);
    const group = clusters.get(root) ?? [];
    group.push(index);
    clusters.set(root, group);
  });

  const keep = new Set<number>();
  for (const indexes of clusters.values()) {
    let best = indexes[0]!;
    for (const index of indexes.slice(1)) {
      const current = posts[best]!;
      const candidate = posts[index]!;
      const currentScore = engagementScore(current);
      const candidateScore = engagementScore(candidate);
      if (
        candidateScore > currentScore ||
        (candidateScore === currentScore && candidate.text.length > current.text.length)
      ) {
        best = index;
      }
    }
    keep.add(best);
  }

  return posts.filter((_, index) => keep.has(index));
}
