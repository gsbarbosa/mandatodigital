import {
  buildAvatarVideoPrompt,
  pickCuradorVideoContext,
} from "@/lib/avatar-video-prompt";
import { requestPlainText } from "@/lib/llm";
import type { PoliticianProfile } from "@/lib/types";

export {
  buildAvatarVideoPrompt,
  pickCuradorVideoContext,
  hasNonCuradorProfileData,
} from "@/lib/avatar-video-prompt";
export type {
  AvatarVideoPromptBundle,
  AvatarVideoPromptInput,
  CuradorVideoContext,
} from "@/lib/avatar-video-prompt";

/** ~1 min de fala em PT-BR (alinhado ao limite de 160 palavras do Curador). */
export const MAX_TRANSCRIPT_WORDS = 160;
const MAX_TRANSCRIPT_CHARS = 1400;

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

/** Gera roteiro com o prompt pai do video 03 + LLM; fallback se API indisponivel. */
export async function buildAvatarVideoTranscript(input: {
  topic: string;
  profile?: PoliticianProfile | null;
}) {
  const prompt = buildAvatarVideoPrompt(input);

  const execution = await requestPlainText(prompt.system, prompt.user, {
    temperature: 0.8,
    maxTokens: 900,
  });

  const spoken = normalizeSpokenTranscript(execution.rawText ?? "");
  if (spoken) {
    return clampTranscript(spoken);
  }

  return buildAvatarVideoTranscriptFallback(input);
}
