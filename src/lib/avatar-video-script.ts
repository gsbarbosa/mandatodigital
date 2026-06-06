import {
  AVATAR_VIDEO_TARGET_WORDS,
  buildAvatarVideoPrompt,
  pickCuradorVideoContext,
  type CuradorVideoContext,
} from "@/lib/avatar-video-prompt";
import { buildPoliticalContext } from "@/lib/political-context-prompt";
import { requestPlainText } from "@/lib/llm";
import type { PoliticianProfile } from "@/lib/types";

export {
  AVATAR_VIDEO_TARGET_WORDS,
  buildAvatarVideoPrompt,
  pickCuradorVideoContext,
  hasNonCuradorProfileData,
} from "@/lib/avatar-video-prompt";
export type {
  AvatarVideoPromptBundle,
  AvatarVideoPromptInput,
  CuradorVideoContext,
} from "@/lib/avatar-video-prompt";
export { buildPoliticalContextPrompt } from "@/lib/political-context-prompt";

/** ~1 min de fala em PT-BR (alinhado ao prompt de redacao). */
export const MAX_TRANSCRIPT_WORDS = AVATAR_VIDEO_TARGET_WORDS;
const MAX_TRANSCRIPT_CHARS = 1200;

function clampTranscriptByWords(transcript: string, maxWords = MAX_TRANSCRIPT_WORDS) {
  const words = transcript.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) {
    return transcript.trim();
  }
  return words.slice(0, maxWords).join(" ");
}

function normalizeSpokenTranscript(raw: string) {
  return raw
    .replace(/^```[\w]*\n?/i, "")
    .replace(/\n?```$/i, "")
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Fallback deterministico quando nao ha LLM configurada. */
export function buildAvatarVideoTranscriptFallback(input: {
  topic: string;
  profile?: PoliticianProfile | null;
}) {
  const context = pickCuradorVideoContext(input.topic, input.profile);
  const lines: string[] = [`Hoje quero falar sobre ${context.topic}.`];

  if (context.spectrum) {
    lines.push(`Meu posicionamento sobre este tema e ${context.spectrum.toLowerCase()}.`);
  }

  if (context.glossaryTerms?.length) {
    lines.push(
      `Costumo falar de forma natural, usando expressoes como ${context.glossaryTerms.slice(0, 3).join(", ")}.`,
    );
  }

  lines.push("Vou ser direto, claro e trazer uma mensagem objetiva para voce compartilhar.");

  const transcript = lines.join(" ").replace(/\s+/g, " ").trim();
  return clampTranscriptByWords(transcript);
}

function clampTranscript(transcript: string) {
  const byWords = clampTranscriptByWords(transcript);
  if (byWords.length <= MAX_TRANSCRIPT_CHARS) {
    return byWords;
  }
  return `${byWords.slice(0, MAX_TRANSCRIPT_CHARS - 3).trim()}...`;
}

async function resolvePoliticalContext(
  topic: string,
  curadorContext?: Partial<CuradorVideoContext>,
) {
  const precomputed = curadorContext?.politicalContext?.trim();
  if (precomputed) {
    return precomputed;
  }

  return buildPoliticalContext({
    topic,
    fieldIntelligence: curadorContext?.sentinelBriefing,
  });
}

/**
 * Gera roteiro em duas etapas:
 * 1) Analista imparcial — raio-x do cenario (contexto_politico)
 * 2) Redator partidario — roteiro falado para o avatar
 */
export async function buildAvatarVideoTranscript(input: {
  topic: string;
  profile?: PoliticianProfile | null;
  curadorContext?: Partial<CuradorVideoContext>;
}) {
  const topic = input.topic.trim();
  const politicalContext = await resolvePoliticalContext(topic, input.curadorContext);

  const prompt = buildAvatarVideoPrompt({
    topic,
    profile: input.profile,
    curadorContext: {
      ...input.curadorContext,
      politicalContext,
      sentinelBriefing: undefined,
    },
  });

  const execution = await requestPlainText(prompt.system, prompt.user, {
    temperature: 0.8,
    maxTokens: 1100,
  });

  const spoken = normalizeSpokenTranscript(execution.rawText ?? "");
  if (spoken) {
    return clampTranscript(spoken);
  }

  return buildAvatarVideoTranscriptFallback(input);
}
