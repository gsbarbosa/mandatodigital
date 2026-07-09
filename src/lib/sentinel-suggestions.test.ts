import { describe, expect, it } from "vitest";

import {
  buildSentinelRssQueries,
  buildStoryClusterKey,
  clusterScoredArticles,
  countUniqueOutlets,
  matchLiteralThemes,
  matchSentinelThemes,
  normalizeSentinelText,
  parseGoogleNewsRss,
  scoreSentinelArticle,
} from "@/lib/sentinel-rss";
import { matchThemesWithSynonyms, pickBestMatchedTheme } from "@/lib/sentinel-theme-synonyms";
import { buildSuggestionsFromArticles } from "@/lib/sentinel-suggestions";
import type { PoliticianProfile } from "@/lib/types";

const sampleProfile: PoliticianProfile = {
  id: "profile-1",
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
  sentinelThemes: ["Seguranca Publica", "Vacinacao", "Reforma Fiscal"],
  sentinelThemesFederal: ["Vacinacao", "Reforma Fiscal"],
  sentinelThemesEstadual: ["Seguranca Publica"],
  oppositionThemes: ["Endurecimento de Penas"],
  customRadarThemes: ["fila do SUS"],
  interestProfiles: [],
  interestSites: ["g1.com.br"],
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
};

describe("sentinel-theme-synonyms", () => {
  it("associa sinonimo de reforma tributaria ao tema Reforma Fiscal", () => {
    const matches = matchThemesWithSynonyms(
      "Congresso discute IVA e CBS na reforma do consumo",
      ["Reforma Fiscal"],
    );
    expect(matches).toContain("Reforma Fiscal");
  });

  it("nao associa Saneamento Basico a noticia de policiamento por causa de 'falta'", () => {
    const haystack =
      "Falta de policiamento e o principal problema de seguranca em Sao Paulo, mostra Datafolha - CBN";

    expect(
      matchThemesWithSynonyms(haystack, ["Saneamento Basico", "Seguranca Publica"]),
    ).toEqual(["Seguranca Publica"]);

    expect(pickBestMatchedTheme(haystack, ["Saneamento Basico", "Seguranca Publica"])).toBe(
      "Seguranca Publica",
    );
  });

  it("mantem match de saneamento quando a materia fala de agua", () => {
    const haystack = "Moradores reclamam da falta de agua potavel no bairro";

    expect(matchThemesWithSynonyms(haystack, ["Saneamento Basico"])).toContain("Saneamento Basico");
  });
});

describe("sentinel-rss", () => {
  it("normaliza texto para comparacao sem acentos", () => {
    expect(normalizeSentinelText("Reforma Tributária")).toBe("reforma tributaria");
  });

  it("faz parse basico de RSS do Google News", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <rss><channel>
        <item>
          <title><![CDATA[Campinas amplia vacinação contra gripe]]></title>
          <link>https://news.google.com/articles/example-1</link>
          <pubDate>Mon, 23 Jun 2026 10:00:00 GMT</pubDate>
          <source>G1</source>
        </item>
      </rss>`;

    const items = parseGoogleNewsRss(xml);
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toContain("Campinas");
    expect(items[0]?.sourceName).toBe("G1");
  });

  it("monta queries por esfera sem temas de oposicao", () => {
    const queries = buildSentinelRssQueries(sampleProfile);
    expect(queries.some((query) => query.includes("Campinas"))).toBe(true);
    expect(queries.some((query) => query.includes("Seguranca Publica") && query.includes("SP"))).toBe(
      true,
    );
    expect(queries.some((query) => query.includes("Vacinacao") && query.includes("Brasil"))).toBe(
      true,
    );
    expect(queries.some((query) => query.includes("fila do SUS"))).toBe(true);
    expect(queries.some((query) => query.includes("Endurecimento de Penas"))).toBe(false);
    expect(queries.length).toBeGreaterThanOrEqual(3);
  });

  it("associa temas do radar ao titulo da materia", () => {
    const matches = matchSentinelThemes(
      "Operação reforça segurança pública em Campinas",
      sampleProfile.sentinelThemes,
    );
    expect(matches).toContain("Seguranca Publica");
  });

  it("faz match literal apenas para temas personalizados", () => {
    const matches = matchLiteralThemes(
      "Campinas discute fila do SUS em audiencia publica",
      sampleProfile.customRadarThemes,
    );
    expect(matches).toContain("fila do SUS");

    const synonymOnly = matchLiteralThemes(
      "Sistema Unico de Saude sob pressao",
      sampleProfile.customRadarThemes,
    );
    expect(synonymOnly).toHaveLength(0);
  });

  it("prioriza materia recente, local e cluster multi-veiculo no score", () => {
    const score = scoreSentinelArticle(
      {
        title: "Campinas anuncia campanha de vacinacao infantil",
        link: "https://example.com/2",
        pubDate: new Date().toISOString(),
        publishedAt: new Date(),
        sourceName: "Portal",
      },
      sampleProfile,
      ["Vacinacao"],
      [],
      { articleCount: 3, outletCount: 3 },
    );

    expect(score).toBeGreaterThanOrEqual(55);
  });

  it("agrupa materias parecidas em clusters", () => {
    const clusters = clusterScoredArticles([
      {
        article: {
          title: "Campinas reforça segurança pública após operação",
          link: "https://example.com/a",
          pubDate: null,
          publishedAt: null,
          sourceName: "G1",
        },
        themeLabel: "Seguranca Publica",
        matchedThemes: ["Seguranca Publica"],
        sourceList: "interest",
        relevanceScore: 0,
      },
      {
        article: {
          title: "Segurança pública é reforçada em Campinas após operação",
          link: "https://example.com/b",
          pubDate: null,
          publishedAt: null,
          sourceName: "Tribuna",
        },
        themeLabel: "Seguranca Publica",
        matchedThemes: ["Seguranca Publica"],
        sourceList: "interest",
        relevanceScore: 0,
      },
    ]);

    expect(clusters).toHaveLength(1);
    expect(clusters[0]).toHaveLength(2);
    expect(buildStoryClusterKey("Campinas reforça segurança pública")).toBeTruthy();
  });

  it("conta veiculos distintos no cluster", () => {
    const outlets = countUniqueOutlets([
      {
        title: "A",
        link: "https://g1.globo.com/a",
        pubDate: null,
        publishedAt: null,
        sourceName: "G1",
      },
      {
        title: "B",
        link: "https://tribuna.com/b",
        pubDate: null,
        publishedAt: null,
        sourceName: "Tribuna",
      },
    ]);

    expect(outlets).toBe(2);
  });
});

describe("sentinel-suggestions", () => {
  it("agrupa materias por tema e gera sugestoes com multiplas fontes", async () => {
    const { suggestions } = await buildSuggestionsFromArticles(
      [
        {
          title: "Campinas reforça segurança pública após operação",
          link: "https://example.com/seguranca-1",
          pubDate: "Mon, 23 Jun 2026 10:00:00 GMT",
          publishedAt: new Date("2026-06-23T10:00:00.000Z"),
          sourceName: "G1",
        },
        {
          title: "Segurança pública é reforçada em Campinas após operação policial",
          link: "https://example.com/seguranca-2",
          pubDate: "Mon, 23 Jun 2026 11:00:00 GMT",
          publishedAt: new Date("2026-06-23T11:00:00.000Z"),
          sourceName: "Tribuna",
        },
        {
          title: "Vacinação contra gripe avança em Campinas",
          link: "https://example.com/vacina",
          pubDate: "Mon, 23 Jun 2026 11:00:00 GMT",
          publishedAt: new Date("2026-06-23T11:00:00.000Z"),
          sourceName: "Tribuna",
        },
      ],
      sampleProfile,
    );

    expect(suggestions.length).toBeGreaterThanOrEqual(2);

    const seguranca = suggestions.find((item) => item.themeLabel === "Seguranca Publica");
    expect(seguranca?.evidence.outletCount).toBeGreaterThanOrEqual(2);
    expect(seguranca?.evidence.articles?.length).toBeGreaterThanOrEqual(2);
    expect(seguranca?.topic).toContain("·");
  });
});
