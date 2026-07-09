import { describe, expect, it } from "vitest";

import { buildV2SuggestionsFromArticles } from "./sentinel-suggestions-v2";
import type { PoliticianProfile } from "./types";

const profile: PoliticianProfile = {
  id: "profile-v2-test",
  fullName: "Teste",
  role: "Dep",
  city: "Belo Horizonte",
  state: "MG",
  audience: "Geral",
  spectrum: "",
  archetype: "O Conciliador (Uniao/Pontes)",
  voiceTones: [],
  keyIssues: ["Saude"],
  slogans: [],
  redLines: [],
  referenceExamples: [],
  bio: "Bio de teste com mais de vinte caracteres para validacao.",
  personaArchetypes: [],
  sentinelThemes: ["Carga Tributaria", "Privatizacoes"],
  sentinelThemesFederal: ["Carga Tributaria"],
  sentinelThemesEstadual: ["Privatizacoes"],
  oppositionThemes: [],
  customRadarThemes: [],
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
};

describe("buildV2SuggestionsFromArticles", () => {
  it("nao usa cidade nem termo expandido cru como tema principal", async () => {
    const { suggestions } = await buildV2SuggestionsFromArticles(
      [
        {
          title:
            "Mae e filha morrem apos queda do 10º andar de hotel em Belo Horizonte – Estadao",
          link: "https://news.google.com/articles/bh-hotel",
          pubDate: "Mon, 02 Dec 2025 08:00:00 GMT",
          publishedAt: new Date("2025-12-02T08:00:00Z"),
          sourceName: "Estadao",
          origin: "portal-rss",
          siteList: "federal",
          siteHost: "estadao.com.br",
        },
        {
          title: "Carga tributaria do Brasil sobe a nivel recorde em 2025 – Exame",
          link: "https://news.google.com/articles/carga-tributaria",
          pubDate: "Fri, 11 Apr 2026 07:00:00 GMT",
          publishedAt: new Date("2026-04-11T07:00:00Z"),
          sourceName: "Exame",
          origin: "google-news",
        },
      ],
      profile,
      {
        profileId: profile.id,
        geoLabel: "Belo Horizonte, MG",
        expansions: [
          {
            sourceTheme: "Privatizacoes",
            expandedTerms: ["Belo Horizonte", "venda de estatais"],
            generatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
        expandedTerms: ["Belo Horizonte", "venda de estatais"],
      },
    );

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]?.themeLabel).toBe("Carga Tributaria");
    expect(suggestions[0]?.matchedThemes).not.toContain("Belo Horizonte");
  });

  it("prioriza Seguranca Publica sobre Saneamento em noticia de policiamento", async () => {
    const { suggestions } = await buildV2SuggestionsFromArticles(
      [
        {
          title:
            "Falta de policiamento e o principal problema de seguranca em Sao Paulo, mostra Datafolha - CBN",
          link: "https://news.google.com/articles/policiamento-sp",
          pubDate: "Wed, 09 Jul 2026 10:44:00 GMT",
          publishedAt: new Date("2026-07-09T10:44:00Z"),
          sourceName: "CBN",
          origin: "portal-rss",
          siteList: "federal",
          siteHost: "cbn.globo.com",
        },
      ],
      {
        ...profile,
        sentinelThemesFederal: ["Saneamento Basico", "Seguranca Publica"],
        sentinelThemes: ["Saneamento Basico", "Seguranca Publica"],
      },
      {
        profileId: profile.id,
        geoLabel: "Sao Paulo, SP",
        expansions: [],
        expandedTerms: [],
      },
    );

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]?.themeLabel).toBe("Seguranca Publica");
  });
});
