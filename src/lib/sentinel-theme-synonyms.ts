import { normalizeSentinelText } from "@/lib/sentinel-text";

/**
 * Expansao estatica de temas do radar — sem LLM, sem API key.
 * Chaves devem corresponder aos labels em sentinelThemeGroups.
 */
export const sentinelThemeSynonyms: Record<string, string[]> = {
  "Carga Tributária": ["imposto", "tributacao", "carga fiscal", "taxa", "aliquota"],
  "Reforma Fiscal": [
    "reforma tributaria",
    "iva",
    "cbs",
    "ibs",
    "pec 45",
    "imposto seletivo",
    "simplificacao tributaria",
  ],
  Desemprego: [
    "desempregados",
    "taxa de desemprego",
    "seguro-desemprego",
    "seguro desemprego",
    "mercado de trabalho",
    "geracao de emprego",
    "criacao de emprego",
    "geracao de empregos",
  ],
  "Inflação e Preços": ["inflacao", "precos altos", "ipca", "custo de vida", "supermercado"],
  Empreendedorismo: ["pequeno empresario", "negocio proprio", "startup", "mei"],
  "Direito Trabalhista": ["clt", "trabalhador", "demissao", "salario", "sindicato"],
  Privatizações: ["privatizar", "estatal", "desestatizacao"],
  "MEI e Simples Nacional": ["mei", "simples nacional", "microempreendedor"],
  "Contratos Públicos": ["licitacao", "pregao", "contrato publico", "corrupcao em obra"],

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
  "Endurecimento de Penas": ["pena maior", "prisao perpetua", "regime fechado"],
  "Maioridade Penal": ["adolescente infrator", "menor infrator", "reducao da maioridade"],
  "Porte de Armas (CACs)": ["armas", "cac", "porte de arma", "desarmamento"],
  "Combate ao Tráfico": ["trafico de drogas", "narcotrafico", "crack", "facção"],
  "Sistema Prisional": ["presidio", "carceragem", "sistema carcerario", "superlotacao"],
  "Valorização Policial": ["policial militar", "pm", "policia civil", "salario policial"],
  "Câmeras Corporais": ["camera corporal", "body cam", "filmagem policial"],

  "Apoio ao Agronegócio": ["agronegocio", "produtor rural", "exportacao agricola", "soja", "boi"],
  "Transição Energética": ["energia solar", "energia eolica", "energia renovavel", "carbono"],
  "Proteção de Biomas": ["amazonia", "cerrado", "desmatamento", "queimada", "meio ambiente"],
  "Agricultura Familiar": ["agricultor familiar", "assentamento", "reforma agraria"],
  "Saneamento Básico": ["esgoto", "agua potavel", "saneamento", "falta de agua"],
  "Mobilidade Urbana": ["transporte publico", "metro", "onibus", "mobilidade", "transito"],

  "Saúde Pública (SUS)": ["sus", "fila do sus", "hospital publico", "upa", "posto de saude"],
  "Educação Básica": ["escola publica", "ensino fundamental", "creche", "professor"],
  "Educação Superior": ["universidade publica", "ensino superior", "vestibular", "enem"],
  "Combate à Fome / Pobreza": ["fome", "pobreza", "bolsa familia", "miséria", "inseguranca alimentar"],
  "Fila de Cirurgias": ["fila cirurgica", "espera cirurgia", "cirurgia eletiva"],
  Vacinação: ["vacina", "imunizacao", "campanha de vacinacao", "bcg", "gripe"],

  "Regulamentação de Redes": ["regulacao internet", "pl das fake news", "redes sociais"],
  "Liberdade de Expressão": ["censura", "liberdade de imprensa", "expressao"],
  "Combate a Fake News": ["fake news", "desinformacao", "noticia falsa"],
  "Ativismo Judicial (STF)": ["stf", "supremo", "judicializacao", "decisao do supremo"],
  "Fundão Eleitoral": ["fundao", "financiamento de campanha", "eleicoes"],
  "Transparência Gov.": ["transparencia", "portal da transparencia", "gasto publico"],
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

export function scoreThemeTermMatch(text: string, term: string): number {
  const normalized = normalizeSentinelText(text);
  const termNorm = normalizeSentinelText(term);

  if (termNorm.length < 3) {
    return 0;
  }

  if (normalized.includes(termNorm)) {
    return termNorm.length * 10;
  }

  const words = termNorm.split(" ").filter(Boolean);
  if (words.length <= 1) {
    const word = words[0];
    if (word && word.length >= 3 && normalized.includes(word)) {
      return word.length * 5;
    }
    return 0;
  }

  const significant = words.filter((word) => word.length >= 4);
  const matchedCount = significant.filter((word) => normalized.includes(word)).length;

  if (significant.length >= 2 && matchedCount >= 2) {
    return matchedCount * 8;
  }

  if (significant.length === 1 && matchedCount === 1) {
    return significant[0].length * 5;
  }

  return 0;
}

export function textMatchesThemeTerm(text: string, term: string) {
  return scoreThemeTermMatch(text, term) > 0;
}

export function scoreThemeMatch(text: string, theme: string): number {
  const terms = getThemeSearchTerms(theme);
  let best = 0;

  for (const term of terms) {
    best = Math.max(best, scoreThemeTermMatch(text, term));
  }

  return best;
}

export function pickBestMatchedTheme(text: string, themes: string[]): string {
  let bestTheme = "";
  let bestScore = 0;

  for (const theme of themes) {
    const score = scoreThemeMatch(text, theme);
    if (score > bestScore) {
      bestScore = score;
      bestTheme = theme;
    }
  }

  return bestTheme;
}

export function matchThemesWithSynonyms(text: string, themes: string[]) {
  const matched: string[] = [];

  for (const theme of themes) {
    const terms = getThemeSearchTerms(theme);
    const hit = terms.some((term) => textMatchesThemeTerm(text, term));
    if (hit) {
      matched.push(theme);
    }
  }

  return matched;
}

/** Termo concreto (sinônimo ou expansão) que melhor explica o match da matéria com o tema. */
export function resolveArticleMatchingSearchTerm(
  haystack: string,
  themeLabel: string,
  extraTerms: string[] = [],
): string | null {
  const normalizedTheme = normalizeSentinelText(themeLabel);
  if (!normalizedTheme) {
    return null;
  }

  const seen = new Set<string>();
  const candidateTerms = [...getThemeSearchTerms(themeLabel), ...extraTerms];

  let bestTerm = "";
  let bestScore = 0;

  for (const rawTerm of candidateTerms) {
    const term = rawTerm.trim();
    if (!term) {
      continue;
    }
    const normalizedTerm = normalizeSentinelText(term);
    if (!normalizedTerm || seen.has(normalizedTerm)) {
      continue;
    }
    seen.add(normalizedTerm);

    const score = scoreThemeTermMatch(haystack, term);
    if (score > bestScore) {
      bestScore = score;
      bestTerm = term;
    }
  }

  if (!bestTerm || bestScore === 0) {
    return null;
  }

  if (normalizeSentinelText(bestTerm) === normalizedTheme) {
    return null;
  }

  return bestTerm;
}
