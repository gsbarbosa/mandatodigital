import { normalizeSentinelText } from "@/lib/sentinel-text";

/**
 * Expansao estatica de temas do radar — sem LLM, sem API key.
 * Chaves devem corresponder aos labels em sentinelThemeGroups.
 */
export const sentinelThemeSynonyms: Record<string, string[]> = {
  "Carga Tributaria": ["imposto", "tributacao", "carga fiscal", "taxa", "aliquota"],
  "Reforma Fiscal": [
    "reforma tributaria",
    "iva",
    "cbs",
    "ibs",
    "pec 45",
    "imposto seletivo",
    "simplificacao tributaria",
  ],
  Desemprego: ["emprego", "vagas", "desempregados", "mercado de trabalho"],
  "Inflacao e Precos": ["inflacao", "precos altos", "ipca", "custo de vida", "supermercado"],
  Empreendedorismo: ["pequeno empresario", "negocio proprio", "startup", "mei"],
  "Direito Trabalhista": ["clt", "trabalhador", "demissao", "salario", "sindicato"],
  Privatizacoes: ["privatizar", "estatal", "desestatizacao"],
  "MEI e Simples Nacional": ["mei", "simples nacional", "microempreendedor"],
  "Contratos Publicos": ["licitacao", "pregao", "contrato publico", "corrupcao em obra"],

  "Seguranca Publica": [
    "operacao policial",
    "violencia urbana",
    "crime",
    "policia",
    "criminalidade",
    "tiroteio",
    "homicidio",
  ],
  "Combate a Corrupcao": ["corrupcao", "desvio", "propina", "lavagem de dinheiro", "investigacao"],
  "Endurecimento de Penas": ["pena maior", "prisao perpetua", "regime fechado"],
  "Maioridade Penal": ["adolescente infrator", "menor infrator", "reducao da maioridade"],
  "Porte de Armas (CACs)": ["armas", "cac", "porte de arma", "desarmamento"],
  "Combate ao Trafico": ["trafico de drogas", "narcotrafico", "crack", "facção"],
  "Sistema Prisional": ["presidio", "carceragem", "sistema carcerario", "superlotacao"],
  "Valorizacao Policial": ["policial militar", "pm", "policia civil", "salario policial"],
  "Cameras Corporais": ["camera corporal", "body cam", "filmagem policial"],

  "Apoio ao Agronegocio": ["agronegocio", "produtor rural", "exportacao agricola", "soja", "boi"],
  "Transicao Energetica": ["energia solar", "energia eolica", "energia renovavel", "carbono"],
  "Protecao de Biomas": ["amazonia", "cerrado", "desmatamento", "queimada", "meio ambiente"],
  "Agricultura Familiar": ["agricultor familiar", "assentamento", "reforma agraria"],
  "Saneamento Basico": ["esgoto", "agua potavel", "saneamento", "falta d agua"],
  "Mobilidade Urbana": ["transporte publico", "metro", "onibus", "mobilidade", "transito"],

  "Saude Publica (SUS)": ["sus", "fila do sus", "hospital publico", "upa", "posto de saude"],
  "Educacao Basica": ["escola publica", "ensino fundamental", "creche", "professor"],
  "Educacao Superior": ["universidade publica", "ensino superior", "vestibular", "enem"],
  "Combate a Fome / Pobreza": ["fome", "pobreza", "bolsa familia", "miséria", "inseguranca alimentar"],
  "Fila de Cirurgias": ["fila cirurgica", "espera cirurgia", "cirurgia eletiva"],
  Vacinacao: ["vacina", "imunizacao", "campanha de vacinacao", "bcg", "gripe"],

  "Regulamentacao de Redes": ["regulacao internet", "pl das fake news", "redes sociais"],
  "Liberdade de Expressao": ["censura", "liberdade de imprensa", "expressao"],
  "Combate a Fake News": ["fake news", "desinformacao", "noticia falsa"],
  "Ativismo Judicial (STF)": ["stf", "supremo", "judicializacao", "decisao do supremo"],
  "Fundao Eleitoral": ["fundao", "financiamento de campanha", "eleicoes"],
  "Transparencia Gov.": ["transparencia", "portal da transparencia", "gasto publico"],
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

  if (normalized.includes(termNorm)) {
    return true;
  }

  const words = termNorm.split(" ").filter((word) => word.length >= 4);
  return words.some((word) => normalized.includes(word));
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
