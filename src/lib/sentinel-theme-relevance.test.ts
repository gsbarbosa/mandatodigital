import { describe, expect, it } from "vitest";

import {
  articleMatchesProfileRadar,
  collectProfileRadarThemes,
  filterArticlesMatchingProfileRadar,
  findQueryThemeViolations,
  findSuggestionThemeViolations,
  matchArticleToProfileRadar,
} from "@/lib/sentinel-theme-relevance";
import { buildSentinelRssQueries } from "@/lib/sentinel-rss";
import { buildSuggestionsFromArticles } from "@/lib/sentinel-suggestions";
import type { PoliticianProfile } from "@/lib/types";
import type { RssNewsItem } from "@/lib/sentinel-rss";

function buildProfile(overrides: Partial<PoliticianProfile> = {}): PoliticianProfile {
  return {
    id: "profile-theme-test",
    fullName: "Teste",
    role: "Vereador",
    city: "Campinas",
    state: "SP",
    audience: "Eleitorado local",
    spectrum: "Centro",
    archetype: "O Conciliador (Uniao/Pontes)",
    voiceTones: [],
    keyIssues: ["Saude"],
    slogans: [],
    redLines: [],
    referenceExamples: [],
    bio: "Bio de teste com mais de vinte caracteres para validacao.",
    personaArchetypes: [],
    sentinelThemes: ["Segurança Pública", "Vacinação"],
    oppositionThemes: ["Combate à Corrupção"],
    customRadarThemes: ["obra viaduto"],
    interestProfiles: [],
    interestSites: [],
    oppositionProfiles: [],
    oppositionSites: [],
    glossaryTerms: [],
    trainingReferenceLinks: [],
    youtubeVideoUrl: "",
    avatarType: "",
    avatarVideoTopic: "",
    argilAvatarId: "",
    argilVoiceId: "",
    avatarTrainingStatus: "",
    notificationEmail: "",
    avatarEmotions: [],
    voicePace: "Manter velocidade original",
    editingStyles: [],
    factCheckingSources: [],
    hardDataSources: [],
    distributionChannels: [],
    distributionWindows: [],
    autoPublish: false,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function buildArticle(title: string, link = "https://example.com/item"): RssNewsItem {
  return {
    title,
    link,
    pubDate: "Mon, 23 Jun 2026 10:00:00 GMT",
    publishedAt: new Date("2026-06-23T10:00:00.000Z"),
    sourceName: "G1",
  };
}

describe("sentinel-theme-relevance — radar do perfil", () => {
  it("agrega temas de interesse, personalizados e oposição", () => {
    const profile = buildProfile();
    const radar = collectProfileRadarThemes(profile);

    expect(radar.interest).toEqual(["Segurança Pública", "Vacinação"]);
    expect(radar.custom).toEqual(["obra viaduto"]);
    expect(radar.opposition).toEqual(["Combate à Corrupção"]);
    expect(radar.allSelectable).toHaveLength(4);
  });
});

describe("sentinel-theme-relevance — queries RSS", () => {
  it("monta buscas apenas com temas selecionados e geografia", () => {
    const profile = buildProfile({
      sentinelThemes: ["Vacinação", "Educação Básica"],
      oppositionThemes: ["Ideologia de Gênero"],
      customRadarThemes: ["linha de ônibus"],
    });

    const queries = buildSentinelRssQueries(profile);
    const joined = queries.join(" ").toLowerCase();

    expect(queries.some((query) => query.includes("Campinas"))).toBe(true);
    expect(joined).toContain("vacina");
    expect(joined).toContain("educação básica");
    expect(joined).toContain("ideologia de gênero");
    expect(joined).toContain("linha de ônibus");
    expect(joined).not.toContain("futebol");
    expect(findQueryThemeViolations(profile)).toEqual([]);
  });

  it("limita quantidade de queries quando há muitos temas", () => {
    const profile = buildProfile({
      sentinelThemes: [
        "Vacinação",
        "Educação Básica",
        "Mobilidade Urbana",
        "Saúde Pública (SUS)",
        "Reforma Fiscal",
        "Segurança Pública",
      ],
      oppositionThemes: [
        "Combate à Corrupção",
        "Desemprego",
        "Carga Tributária",
      ],
      customRadarThemes: ["terminal urbano"],
    });

    const queries = buildSentinelRssQueries(profile);

    expect(queries.length).toBeLessThanOrEqual(8);
    expect(queries.some((query) => queryIncludesAny(query, ["Vacinação", "Educação Básica"]))).toBe(
      true,
    );
  });
});

describe("sentinel-theme-relevance — match artigo × radar", () => {
  it("associa sinônimo apenas quando o tema pai está selecionado", () => {
    const withReforma = buildProfile({ sentinelThemes: ["Reforma Fiscal"], oppositionThemes: [] });
    const withoutReforma = buildProfile({ sentinelThemes: ["Vacinação"], oppositionThemes: [] });
    const article = buildArticle("Congresso avança com IVA e CBS na PEC 45");

    expect(articleMatchesProfileRadar(article, withReforma)).toBe(true);
    expect(matchArticleToProfileRadar(article, withReforma).matchedInterest).toContain(
      "Reforma Fiscal",
    );
    expect(articleMatchesProfileRadar(article, withoutReforma)).toBe(false);
  });

  it("faz match literal em tema personalizado, sem expandir sinônimos", () => {
    const profile = buildProfile({
      sentinelThemes: [],
      customRadarThemes: ["obra viaduto"],
    });

    expect(
      articleMatchesProfileRadar(
        buildArticle("Campinas retoma obra viaduto no Cambuí"),
        profile,
      ),
    ).toBe(true);

    expect(
      articleMatchesProfileRadar(
        buildArticle("Infraestrutura urbana avança com novo viaduto"),
        profile,
      ),
    ).toBe(false);
  });

  it("identifica tema de oposição separado do mandato", () => {
    const profile = buildProfile({
      sentinelThemes: ["Segurança Pública"],
      oppositionThemes: ["Combate à Corrupção"],
    });
    const match = matchArticleToProfileRadar(
      buildArticle("Auditoria revela desvio milionário em convênio municipal"),
      profile,
    );

    expect(match.matchedOpposition).toContain("Combate à Corrupção");
    expect(match.matchedInterest).not.toContain("Segurança Pública");
  });

  it("descarta matérias sem relação com o radar", () => {
    const profile = buildProfile({
      sentinelThemes: ["Vacinação"],
      oppositionThemes: [],
      customRadarThemes: [],
    });
    const articles = [
      buildArticle("Campinas amplia campanha de vacinação infantil", "https://example.com/1"),
      buildArticle("Flamengo vence clássico no Maracanã", "https://example.com/2"),
      buildArticle("Bolsa de valores fecha em alta", "https://example.com/3"),
    ];

    const matched = filterArticlesMatchingProfileRadar(articles, profile);

    expect(matched).toHaveLength(1);
    expect(matched[0]?.title).toContain("vacinação");
  });
});

describe("sentinel-theme-relevance — sugestões finais", () => {
  it("só gera sugestões cujos temas existem no radar salvo", () => {
    const profile = buildProfile({
      sentinelThemes: ["Segurança Pública", "Vacinação"],
      oppositionThemes: ["Combate à Corrupção"],
      customRadarThemes: ["obra viaduto"],
    });

    const suggestions = buildSuggestionsFromArticles(
      [
        buildArticle("Campinas reforça segurança pública após operação", "https://example.com/s1"),
        buildArticle("Vacinação contra gripe avança em Campinas", "https://example.com/s2"),
        buildArticle("PF apura desvio milionário em licitação", "https://example.com/s3"),
        buildArticle("Prefeitura retoma obra viaduto no Cambuí", "https://example.com/s4"),
        buildArticle("Time local conquista título estadual", "https://example.com/s5"),
      ],
      profile,
    );

    expect(suggestions.length).toBeGreaterThan(0);
    expect(findSuggestionThemeViolations(suggestions, profile)).toEqual([]);

    for (const suggestion of suggestions) {
      expect(suggestion.matchedThemes.length).toBeGreaterThan(0);
      expect(suggestion.topic).toContain("·");
    }
  });

  it("não devolve sugestão quando nenhuma matéria bate com temas selecionados", () => {
    const profile = buildProfile({
      sentinelThemes: ["Homeschooling"],
      oppositionThemes: [],
      customRadarThemes: [],
    });

    const suggestions = buildSuggestionsFromArticles(
      [
        buildArticle("Flamengo vence clássico"),
        buildArticle("Mercado de cripto sobe após anúncio"),
      ],
      profile,
    );

    expect(suggestions).toEqual([]);
  });

  it("prioriza label de interesse quando mandato e oposição batem juntos", () => {
    const profile = buildProfile({
      sentinelThemes: ["Segurança Pública"],
      oppositionThemes: ["Segurança Pública"],
      customRadarThemes: [],
    });

    const suggestions = buildSuggestionsFromArticles(
      [buildArticle("Campinas anuncia pacote de segurança pública")],
      profile,
    );

    expect(suggestions[0]?.themeLabel).toBe("Segurança Pública");
    expect(findSuggestionThemeViolations(suggestions, profile)).toEqual([]);
  });
});

function queryIncludesAny(query: string, themes: string[]) {
  const normalizedQuery = query.toLowerCase();
  return themes.some((theme) => normalizedQuery.includes(theme.toLowerCase()));
}
