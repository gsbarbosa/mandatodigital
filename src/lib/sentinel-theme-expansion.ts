import { z } from "zod";

import { isSentinelLlmExpansionEnabled } from "@/lib/feature-flags";
import { parseJsonResponse, requestStructuredJson } from "@/lib/llm";
import { sentinelStorage, type SentinelThemeExpansionRecord } from "@/lib/sentinel-storage";
import type { PoliticianProfile } from "@/lib/types";

const MAX_THEMES_PER_RUN = 12;
const MAX_TERMS_PER_THEME = 15;
const MAX_TOTAL_SEARCH_TERMS = 20;

const expansionResponseSchema = z.object({
  terms: z.array(z.string()).max(MAX_TERMS_PER_THEME),
});

export type SentinelThemeExpansion = SentinelThemeExpansionRecord;

function normalizeTheme(theme: string) {
  return theme.trim();
}

function normalizeTerm(term: string) {
  return term.trim().replace(/\s+/g, " ");
}

function dedupeTerms(terms: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const term of terms) {
    const normalized = normalizeTerm(term);
    const key = normalized.toLowerCase();
    if (normalized.length < 3 || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(normalized);
  }

  return result.slice(0, MAX_TERMS_PER_THEME);
}

function buildExpansionPrompt(theme: string, profile: PoliticianProfile) {
  const geo = [profile.city.trim(), profile.state.trim()].filter(Boolean).join(", ");

  return {
    system:
      "Voce e um analista de monitoramento politico no Brasil. " +
      "Responda apenas JSON valido no formato {\"terms\": [\"...\"]}. " +
      "Gere entre 8 e 15 termos correlatos para busca de noticias. " +
      "Use portugues do Brasil, termos concretos, sem hashtags, sem URLs.",
    user:
      `Tema: "${theme}"` +
      (geo ? `\nContexto geografico: ${geo}` : "") +
      "\nInclua sinonimos, siglas, politicas publicas, programas e expressoes usadas na imprensa.",
  };
}

export async function generateThemeExpansionTerms(
  theme: string,
  profile: PoliticianProfile,
): Promise<string[]> {
  const prompt = buildExpansionPrompt(theme, profile);
  const execution = await requestStructuredJson(prompt.system, prompt.user, {
    temperature: 0.3,
    maxTokens: 500,
  });

  if (!execution.rawText) {
    return [];
  }

  const parsed = parseJsonResponse<{ terms?: string[] }>(execution.rawText);
  const validated = expansionResponseSchema.safeParse(parsed);

  if (!validated.success) {
    return [];
  }

  return dedupeTerms(validated.data.terms);
}

export function collectExpansionSourceThemes(profile: PoliticianProfile) {
  return [...new Set([...profile.sentinelThemes, ...profile.oppositionThemes].map(normalizeTheme))]
    .filter(Boolean)
    .slice(0, MAX_THEMES_PER_RUN);
}

export async function syncSentinelThemeExpansions(profile: PoliticianProfile) {
  if (!isSentinelLlmExpansionEnabled()) {
    return { updated: 0, skipped: true as const };
  }

  const profileId = profile.id?.trim();
  if (!profileId || profileId === "default") {
    return { updated: 0, skipped: true as const };
  }

  const themes = collectExpansionSourceThemes(profile);
  if (themes.length === 0) {
    return { updated: 0, skipped: false as const };
  }

  const existing = await sentinelStorage.readThemeExpansions(profileId);
  const existingByTheme = new Map(existing.map((row) => [row.sourceTheme.toLowerCase(), row]));
  const records: SentinelThemeExpansion[] = [];

  for (const theme of themes) {
    const cached = existingByTheme.get(theme.toLowerCase());
    if (cached && cached.expandedTerms.length >= 6) {
      records.push(cached);
      continue;
    }

    try {
      const terms = await generateThemeExpansionTerms(theme, profile);
      if (terms.length === 0) {
        if (cached) {
          records.push(cached);
        }
        continue;
      }

      records.push({
        sourceTheme: theme,
        expandedTerms: terms,
        generatedAt: new Date().toISOString(),
      });
    } catch {
      if (cached) {
        records.push(cached);
      }
    }
  }

  await sentinelStorage.writeThemeExpansions(profileId, records);
  return { updated: records.length, skipped: false as const };
}

export async function loadSentinelThemeExpansions(profileId: string) {
  if (!profileId.trim() || profileId === "default") {
    return [];
  }

  return sentinelStorage.readThemeExpansions(profileId);
}

export function flattenExpansionSearchTerms(expansions: SentinelThemeExpansion[]) {
  const terms: string[] = [];

  for (const expansion of expansions) {
    for (const term of expansion.expandedTerms) {
      terms.push(normalizeTerm(term));
    }
  }

  return [...new Set(terms.filter(Boolean))].slice(0, MAX_TOTAL_SEARCH_TERMS);
}
