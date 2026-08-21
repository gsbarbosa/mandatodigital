/**
 * Filtro de relevância do Radar de Bairro, em 2 estágios.
 *
 * Por que 2 e não 1: palavra-chave sozinha falhou em teste real duas vezes —
 * "buraco"/"esgoto" apareceram como gíria, xingamento político e anúncio
 * imobiliário (7 de 8 falso-positivo), e "Vila Maria" trouxe escola de samba.
 * Então o estágio 1 é só uma peneira BARATA (corta o ruído óbvio antes de gastar
 * LLM) e o estágio 2 é quem de fato decide, entendendo o sentido da frase.
 *
 * Regra que contraria a intuição, mas veio de dado real: NÃO filtramos por
 * engajamento. O melhor achado de toda a validação — comunicado de fechamento de
 * equipamento público após temporal — tinha zero curtida e zero comentário.
 * Reclamação de serviço público não viraliza como foto bonita.
 *
 * Ver docs/radar-de-bairro.md.
 */

import { z } from "zod";

import { isRadarBairroLlmEnabled } from "@/lib/feature-flags";
import { parseJsonResponse, requestStructuredJson } from "@/lib/llm";
import {
  isRadarBairroTheme,
  RADAR_BAIRRO_THEME_LABELS,
  type RadarBairroPost,
  type RadarBairroSignal,
} from "@/lib/radar-bairro-types";

/** Post curto demais não tem o que classificar (emoji solto, "@todos", "bom dia"). */
const MIN_TEXT_LENGTH = 40;

const DEFAULT_CONCURRENCY = 4;
/** Teto de chamadas de LLM por coleta — controle de custo, igual ao topN do Sentinela. */
const DEFAULT_MAX_LLM_CALLS = 40;

/**
 * Estágio 1 — ruído óbvio, medido na amostra real que coletamos. Frases (não
 * palavra solta) porque "vendo" isolado pega "vendo a situação"; e ancoradas em
 * padrão de classificado, que foi 100% do conteúdo de um dos grupos testados.
 */
const NOISE_PHRASES = [
  // classificado / comércio
  "vendo ",
  "vende-se",
  "à venda",
  "a venda",
  "alugo ",
  "aluga-se",
  "para alugar",
  "pra alugar",
  "valor r$",
  "aceito cartão",
  "entrega grátis",
  "faça seu pedido",
  "chama no zap",
  "chama no direct",
  "informações zap",
  "orçamento sem compromisso",
  "peça já",
  "delivery",
  "cardápio",
  "promoção",
  "desconto especial",
  // vaga avulsa (sem ângulo político — fechamento de empresa é outro caso e passa)
  "vaga de emprego",
  "estamos contratando",
  "precisa-se de",
  "envie seu currículo",
  "curriculo para o email",
  // religioso / motivacional genérico
  "abençoada semana",
  "deus abençoe",
  "boa noite a todos",
  "bom dia a todos",
  "culto de domingo",
  "grupo de oração",
  "palavra de deus",
  // vida pessoal
  "feliz aniversário",
  "parabéns pelo seu dia",
  "obrigado a todos que",
];

/** true = passou na peneira barata e merece o estágio 2. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * `\b` só no início de cada frase — pega "vendo" em "Vendo relógio", mas não
 * em "envolvendo" (achado testando post real do X: notícia sobre acidente com
 * "20 vítimas" foi cortada porque "vendo " batia dentro de "envolvendo um
 * ônibus"). Fim da frase mantém o casamento livre — várias frases já terminam
 * sem espaço de propósito (ex. "delivery" dentro de "delivery grátis").
 */
const NOISE_PHRASE_MATCHERS = NOISE_PHRASES.map(
  (phrase) => new RegExp(`\\b${escapeRegExp(phrase.trim())}`, "i"),
);

export function passesCheapNoiseFilter(text: string): boolean {
  const normalized = text.trim();
  if (normalized.length < MIN_TEXT_LENGTH) {
    return false;
  }
  return !NOISE_PHRASE_MATCHERS.some((matcher) => matcher.test(normalized));
}

const llmVerdictSchema = z.object({
  relevante: z.boolean(),
  tema: z.string().optional(),
  motivo: z.string().optional(),
});

const THEME_LIST = Object.entries(RADAR_BAIRRO_THEME_LABELS)
  .map(([key, label]) => `"${key}" (${label})`)
  .join(", ");

function buildPrompt(post: RadarBairroPost, cityLabel: string) {
  return {
    system:
      "Voce triagem pautas para o mandato de um politico brasileiro, a partir de posts " +
      "de grupos de bairro no Facebook. Responda APENAS JSON valido: " +
      '{ "relevante": true|false, "tema": string, "motivo": string }. ' +
      `tema deve ser um de: ${THEME_LIST}. ` +
      "relevante=true so se o post relata um FATO CONCRETO da vida da comunidade que um " +
      "mandato poderia endereçar, cobrar ou divulgar: problema de servico publico, " +
      "seguranca, transito, clima/desastre, saude/educacao publica, mobilizacao de " +
      "moradores, ou acao institucional sobre questao local. " +
      "relevante=false para: anuncio/comercio/classificado, vaga avulsa, vida pessoal, " +
      "religiao, corrente, e para texto que apenas MENCIONA o nome do bairro sem tratar " +
      "dele (nome de time, escola de samba, evento cultural homonimo). " +
      "motivo: uma frase curta, em portugues, dizendo por que interessa ao mandato.",
    user: [
      `Cidade/regiao: ${cityLabel}`,
      `Grupo: ${post.groupTitle || "—"}`,
      post.authorName ? `Autor: ${post.authorName}` : "",
      `Post: ${post.text.slice(0, 1200)}`,
    ]
      .filter(Boolean)
      .join("\n"),
  };
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
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

export type RadarBairroFilterStats = {
  received: number;
  passedCheapFilter: number;
  llmCalls: number;
  kept: number;
};

export type RadarBairroFilterOptions = {
  cityLabel?: string;
  concurrency?: number;
  maxLlmCalls?: number;
  /** false = pula o estágio 2 (custo/guest). Default: respeita a feature flag. */
  llmEnabled?: boolean;
};

/**
 * Aplica os 2 estágios e devolve só os posts aprovados, já com tema e motivo.
 *
 * Com o estágio 2 desligado, devolve vazio de propósito: sem julgamento semântico
 * o que sobra da peneira barata ainda é majoritariamente ruído (foi o que os
 * testes mostraram), e encher a tela de lixo é pior do que mostrar nada.
 */
export async function filterRadarBairroPosts(
  posts: RadarBairroPost[],
  options: RadarBairroFilterOptions = {},
): Promise<{ signals: RadarBairroSignal[]; stats: RadarBairroFilterStats }> {
  const stats: RadarBairroFilterStats = {
    received: posts.length,
    passedCheapFilter: 0,
    llmCalls: 0,
    kept: 0,
  };

  const candidates = posts.filter((post) => passesCheapNoiseFilter(post.text));
  stats.passedCheapFilter = candidates.length;

  const llmEnabled = options.llmEnabled ?? isRadarBairroLlmEnabled();
  if (!llmEnabled || !candidates.length) {
    return { signals: [], stats };
  }

  const maxCalls = options.maxLlmCalls ?? DEFAULT_MAX_LLM_CALLS;
  const head = candidates.slice(0, maxCalls);
  const cityLabel = options.cityLabel?.trim() || "cidade do mandato";

  const verdicts = await mapWithConcurrency(
    head,
    options.concurrency ?? DEFAULT_CONCURRENCY,
    async (post): Promise<RadarBairroSignal | null> => {
      stats.llmCalls += 1;
      const prompt = buildPrompt(post, cityLabel);

      const execution = await requestStructuredJson(prompt.system, prompt.user, {
        temperature: 0.1,
        maxTokens: 220,
      }).catch(() => null);

      if (!execution?.rawText) {
        // LLM indisponível: descarta em vez de aprovar no escuro. Falso-negativo
        // custa uma pauta perdida; falso-positivo custa credibilidade da tela.
        return null;
      }

      const parsed = llmVerdictSchema.safeParse(parseJsonResponse<unknown>(execution.rawText));
      if (!parsed.success || !parsed.data.relevante) {
        return null;
      }

      const theme = parsed.data.tema?.trim() ?? "";
      return {
        ...post,
        theme: isRadarBairroTheme(theme) ? theme : "infraestrutura",
        reason: parsed.data.motivo?.trim().slice(0, 240) || "",
      };
    },
  );

  const signals = verdicts.filter((item): item is RadarBairroSignal => Boolean(item));
  stats.kept = signals.length;

  return { signals, stats };
}
