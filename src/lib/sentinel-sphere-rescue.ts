import { z } from "zod";

import { isSentinelLlmSphereRescueEnabled } from "@/lib/feature-flags";
import { parseJsonResponse, requestStructuredJson } from "@/lib/llm";
import {
  buildSphereRescueCandidateGroups,
  type SphereRescueCandidateGroup,
} from "@/lib/sentinel-diversify";
import type { MockSentinelSuggestion } from "@/lib/sentinel-mock-suggestions";
import { articleOutletLabel, type MonitorSphere } from "@/lib/sphere-classifier";
import type { PoliticianProfile } from "@/lib/types";

const DEFAULT_SHORTLIST_SIZE = 5;

const SPHERE_LABEL: Record<MonitorSphere, string> = {
  federal: "Nacional",
  estadual: "Estadual",
  municipal: "Municipal",
  interesse: "Interesse",
  adversarios: "Adversários",
};

const sphereRescueResponseSchema = z.object({
  pick: z.boolean(),
  index: z.number().int().min(0).nullable().optional().default(null),
  reason: z.string().trim().max(200).optional().default(""),
});

export type SentinelSphereRescueStats = {
  /** Esferas zeradas com pelo menos 1 candidato disponível (acionaram a IA). */
  spheresNeeded: number;
  spheresPromotedByAi: number;
  spheresRejectedByAi: number;
  /** Esferas que a IA de resgate deveria ter respondido mas falhou tecnicamente. */
  failedSpheres: MonitorSphere[];
  llmCalls: number;
};

export type SphereRescueOptions = {
  minPerSphere?: number;
  shortlistSize?: number;
  profileLabel?: string;
  /** false = pula a IA, cai direto no fallback cego por score. Default: enabled !== false && flag. */
  enabled?: boolean;
};

function articleAgeDaysLabel(suggestion: MockSentinelSuggestion): string {
  const publishedAt = suggestion.evidence.articles?.[0]?.publishedAt;
  if (!publishedAt) {
    return "data desconhecida";
  }
  const ms = Date.parse(publishedAt);
  if (!Number.isFinite(ms)) {
    return "data desconhecida";
  }
  const days = Math.max(0, Math.round((Date.now() - ms) / (24 * 60 * 60 * 1000)));
  return days === 0 ? "hoje" : `${days} dia(s) atrás`;
}

function buildRescuePrompt(
  sphere: MonitorSphere,
  shortlist: MockSentinelSuggestion[],
  profileLabel: string,
) {
  const options = shortlist
    .map((suggestion, index) => {
      const article = suggestion.evidence.articles?.[0];
      const title = article?.title ?? suggestion.topic;
      const outlet = article ? articleOutletLabel(article) : "";
      const outletCount = suggestion.evidence.outletCount ?? 1;
      return [
        `[${index}] "${title}"`,
        outlet ? `Fonte: ${outlet}` : "",
        `Veículos cobrindo: ${outletCount}`,
        `Tema do radar: ${suggestion.themeLabel}`,
        `Publicado: ${articleAgeDaysLabel(suggestion)}`,
      ]
        .filter(Boolean)
        .join(" · ");
    })
    .join("\n");

  return {
    system:
      "Voce e editor de pautas politicas no Brasil. " +
      `A esfera "${SPHERE_LABEL[sphere]}" do radar de monitoramento ficou sem nenhuma pauta aprovada. ` +
      "Escolha, entre as opcoes abaixo, a UNICA que realmente serve para um mandato produzir um " +
      "criativo util nas proximas 24-48h (fato concreto, angulo local/nacional claro, nao clickbait vazio). " +
      "Se NENHUMA opcao servir, responda pick=false — nao force uma escolha ruim so para preencher a esfera. " +
      'Responda apenas JSON valido: { "pick": true|false, "index": numero da opcao escolhida ou null, "reason": "..." }.',
    user: [profileLabel ? `Mandato/contexto: ${profileLabel}` : "", "Opções:", options]
      .filter(Boolean)
      .join("\n"),
  };
}

async function rescueOneSphere(
  group: SphereRescueCandidateGroup,
  profileLabel: string,
  shortlistSize: number,
  stats: SentinelSphereRescueStats,
): Promise<MockSentinelSuggestion[]> {
  const shortlist = group.candidates.slice(0, shortlistSize);
  stats.llmCalls += 1;

  const prompt = buildRescuePrompt(group.sphere, shortlist, profileLabel);
  const execution = await requestStructuredJson(prompt.system, prompt.user, {
    temperature: 0.1,
    maxTokens: 150,
  });

  if (!execution.rawText) {
    stats.failedSpheres.push(group.sphere);
    return [];
  }

  const parsed = parseJsonResponse<unknown>(execution.rawText);
  const validated = sphereRescueResponseSchema.safeParse(parsed);
  if (!validated.success) {
    stats.failedSpheres.push(group.sphere);
    return [];
  }

  const { pick, index } = validated.data;
  if (!pick) {
    stats.spheresRejectedByAi += 1;
    return [];
  }

  if (index === null || index < 0 || index >= shortlist.length) {
    // Resposta inconsistente (pick=true sem índice válido) — trata como falha técnica,
    // não como rejeição deliberada: a IA não completou o julgamento pedido.
    stats.failedSpheres.push(group.sphere);
    return [];
  }

  stats.spheresPromotedByAi += 1;
  return [shortlist[index] as MockSentinelSuggestion];
}

/**
 * Substitui a escolha cega por score do resgate de esfera zerada por uma decisão de IA,
 * que pode escolher a melhor pauta disponível para a esfera ou rejeitar todas ("nenhuma
 * presta") — nesse caso a esfera fica vazia em vez de reintroduzir conteúdo fraco.
 *
 * Falha técnica (sem provider configurado, resposta malformada, índice inválido) NÃO cai
 * no fallback cego — a esfera fica vazia e a falha é reportada em `stats.failedSpheres`,
 * para o front-end mostrar um aviso de "tente novamente" em vez da mensagem padrão de
 * "sem pauta" (que sugeriria ajustar o radar, o que não é o problema aqui).
 *
 * Com a flag desligada (ou `enabled: false`), o comportamento é idêntico ao
 * `ensureMinimumSphereRepresentation` de hoje — zero chamadas de IA, escolha cega por score.
 */
export async function rescueZeroedSpheres(input: {
  selected: MockSentinelSuggestion[];
  allCandidates: MockSentinelSuggestion[];
  profile: PoliticianProfile;
  options?: SphereRescueOptions;
}): Promise<{ suggestions: MockSentinelSuggestion[]; stats: SentinelSphereRescueStats }> {
  const stats: SentinelSphereRescueStats = {
    spheresNeeded: 0,
    spheresPromotedByAi: 0,
    spheresRejectedByAi: 0,
    failedSpheres: [],
    llmCalls: 0,
  };

  const groups = buildSphereRescueCandidateGroups({
    selected: input.selected,
    allCandidates: input.allCandidates,
    profile: input.profile,
    minPerSphere: input.options?.minPerSphere,
  }).filter((group) => group.candidates.length > 0);

  stats.spheresNeeded = groups.length;

  const aiOn = input.options?.enabled !== false && isSentinelLlmSphereRescueEnabled();

  if (!aiOn || groups.length === 0) {
    const promoted = groups.flatMap((group) => group.candidates.slice(0, group.needed));
    return { suggestions: [...input.selected, ...promoted], stats };
  }

  const profileLabel = input.options?.profileLabel?.trim() || "mandato local";
  const shortlistSize = input.options?.shortlistSize ?? DEFAULT_SHORTLIST_SIZE;

  const promotedPerGroup = await Promise.all(
    groups.map((group) => rescueOneSphere(group, profileLabel, shortlistSize, stats)),
  );

  return {
    suggestions: [...input.selected, ...promotedPerGroup.flat()],
    stats,
  };
}
