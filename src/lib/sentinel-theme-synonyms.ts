import { stripHashtagsForThemeMatching } from "@/lib/sentinel-caption";
import { normalizeSentinelText } from "@/lib/sentinel-text";

/**
 * Expansão estática de temas do radar — sem LLM, sem API key.
 * Chaves canônicas com acentuação; perfis antigos sem acento ainda resolvem via normalizeSentinelText.
 */
export const sentinelThemeSynonyms: Record<string, string[]> = {
  "Reforma Fiscal": [
    "reforma tributaria",
    "iva",
    "cbs",
    "ibs",
    "pec 45",
    "imposto seletivo",
    "simplificacao tributaria",
  ],
  "Inflação e Preços": ["inflacao", "precos altos", "ipca", "custo de vida", "supermercado"],
  Empreendedorismo: ["pequeno empresario", "negocio proprio", "startup", "mei"],
  "MEI e Simples Nacional": ["mei", "simples nacional", "microempreendedor"],
  "Contratos Públicos": ["licitacao", "pregao", "contrato publico", "corrupcao em obra"],
  "Piso Salarial": ["piso salarial", "salario minimo", "reajuste salarial", "convenção coletiva"],

  "Segurança Pública": [
    "operacao policial",
    "violencia urbana",
    "crime",
    "policia",
    "criminalidade",
    "tiroteio",
    "homicidio",
  ],
  "Combate à Corrupção": ["corrupcao", "desvio", "propina", "lavagem de dinheiro", "investigacao"],

  "Apoio ao Agronegócio": ["agronegocio", "produtor rural", "exportacao agricola", "soja", "boi"],
  "Saneamento Básico": ["esgoto", "agua potavel", "saneamento", "falta d agua"],
  "Mobilidade Urbana": ["transporte publico", "metro", "onibus", "mobilidade", "transito"],

  "Saúde Pública (SUS)": ["sus", "fila do sus", "hospital publico", "upa", "posto de saude"],
  "Educação Básica": ["escola publica", "ensino fundamental", "creche", "professor"],
  "Combate a Fome / Pobreza": ["fome", "pobreza", "bolsa familia", "miséria", "inseguranca alimentar"],
  Vacinação: ["vacina", "imunizacao", "campanha de vacinacao", "bcg", "gripe"],
  "Programas Assistenciais": ["bolsa familia", "auxilio", "cadastro unico", "assistencia social"],
};

export function getThemeSearchTerms(theme: string) {
  const trimmed = theme.trim();
  if (!trimmed) {
    return [];
  }

  const direct = sentinelThemeSynonyms[trimmed];
  if (direct) {
    return [trimmed, ...direct];
  }

  const normalizedTheme = normalizeSentinelText(trimmed);
  const matchedKey = Object.keys(sentinelThemeSynonyms).find(
    (key) => normalizeSentinelText(key) === normalizedTheme,
  );

  if (matchedKey) {
    return [trimmed, ...sentinelThemeSynonyms[matchedKey]];
  }

  return [trimmed];
}

export function textMatchesThemeTerm(text: string, term: string) {
  const normalized = normalizeSentinelText(text);
  const termNorm = normalizeSentinelText(term);

  if (termNorm.length < 3) {
    return false;
  }

  const textWords = normalized.split(" ").filter(Boolean);

  if (termNorm.includes(" ")) {
    if (normalized.includes(termNorm)) {
      return true;
    }

    const phraseWords = termNorm.split(" ").filter((word) => word.length >= 4);
    return phraseWords.length > 0 && phraseWords.every((word) => textWords.includes(word));
  }

  if (textWords.includes(termNorm)) {
    return true;
  }

  if (termNorm.length >= 8 && normalized.includes(termNorm)) {
    return true;
  }

  const themeWords = termNorm.split(" ").filter((word) => word.length >= 4);
  return themeWords.length > 1 && themeWords.every((word) => textWords.includes(word));
}

export function findThemeTermMatches(text: string, themes: string[]) {
  const haystack = stripHashtagsForThemeMatching(text);
  const matches: Array<{ theme: string; term: string }> = [];

  for (const theme of themes) {
    const terms = getThemeSearchTerms(theme);
    const matchedTerm = terms.find((term) => textMatchesThemeTerm(haystack, term));
    if (matchedTerm) {
      matches.push({ theme, term: matchedTerm });
    }
  }

  return matches;
}

export function pickPrimaryThemeMatch(matches: Array<{ theme: string; term: string }>) {
  if (matches.length === 0) {
    return null;
  }

  return [...matches].sort((left, right) => right.term.length - left.term.length)[0] ?? null;
}

export function matchThemesWithSynonyms(text: string, themes: string[]) {
  const haystack = stripHashtagsForThemeMatching(text);
  const matched: string[] = [];

  for (const theme of themes) {
    const terms = getThemeSearchTerms(theme);
    const hit = terms.some((term) => textMatchesThemeTerm(haystack, term));
    if (hit) {
      matched.push(theme);
    }
  }

  return matched;
}
