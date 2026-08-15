import { describe, expect, it } from "vitest";

import {
  collapseNearDuplicateSuggestions,
  diversifySuggestionsByTheme,
  ensureMinimumSphereRepresentation,
} from "./sentinel-diversify";
import type { MockSentinelSuggestion } from "./sentinel-mock-suggestions";
import type { PoliticianProfile } from "./types";

const profile: PoliticianProfile = {
  id: "profile-1",
  fullName: "Teste",
  role: "Vereador",
  city: "",
  state: "CE",
  audience: "",
  spectrum: "",
  archetype: "",
  voiceTones: [],
  keyIssues: [],
  slogans: [],
  redLines: [],
  referenceExamples: [],
  bio: "",
  personaArchetypes: [],
  sentinelThemes: [],
  sentinelThemesFederal: [],
  sentinelThemesEstadual: [],
  oppositionThemes: [],
  customRadarThemes: [],
  municipalCities: ["Crato"],
  interestProfiles: [],
  interestSites: [],
  oppositionProfiles: [],
  oppositionSites: [],
  glossaryTerms: [],
  trainingReferenceLinks: [],
  youtubeVideoUrl: "",
  avatarType: "",
  avatarVideoTopic: "",
  notificationEmail: "",
  avatarEmotions: [],
  voicePace: "",
  editingStyles: [],
  factCheckingSources: [],
  hardDataSources: [],
  distributionChannels: [],
  distributionWindows: [],
  autoPublish: false,
  updatedAt: "",
};

function suggestion(
  id: string,
  title: string,
  score: number,
  publishedAt?: string,
  options: { theme?: string; sourceName?: string } = {},
): MockSentinelSuggestion {
  const theme = options.theme ?? "Valorização Policial";
  return {
    id,
    themeLabel: theme,
    matchedThemes: [theme],
    relevanceScore: score,
    topic: `${theme} · ${title}`,
    evidence: {
      postsAnalyzed: 1,
      outletCount: 1,
      engagementTrendPercent: 0,
      byNetwork: [],
      actors: [],
      articles: [
        {
          title,
          url: `https://x.com/${id}`,
          sourceName: options.sourceName ?? "X",
          publishedAt,
        },
      ],
    },
    engagement: {
      relevanceScore: score,
      scoreTrendPercent: 0,
      likes: 0,
      comments: 0,
      postsAnalyzed: 1,
      sources: [],
      byNetwork: [],
    },
  };
}

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

describe("ensureMinimumSphereRepresentation", () => {
  it("promove o melhor candidato federal quando o corte por tema deixou a esfera sem nada", () => {
    // Mesmo tema, mas um cita a cidade monitorada (municipal) e o outro não (cai em federal).
    const local = suggestion("local", "Polícia Civil prende suspeito em Crato", 90);
    const national = suggestion("national", "Congresso debate valorização da carreira policial", 40);

    // maxPerTheme=1 deixa só o local sobreviver — igual acontecia com Nacional zerado.
    const selected = diversifySuggestionsByTheme([local, national], { maxPerTheme: 1 });
    expect(selected.map((item) => item.id)).toEqual(["local"]);

    const result = ensureMinimumSphereRepresentation({
      selected,
      allCandidates: [local, national],
      profile,
    });

    expect(result.map((item) => item.id)).toEqual(["local", "national"]);
  });

  it("nao duplica nem mexe quando a esfera ja tem representante", () => {
    const local = suggestion("local", "Polícia Civil prende suspeito em Crato", 90);
    const selected = [local];

    const result = ensureMinimumSphereRepresentation({
      selected,
      allCandidates: [local],
      profile,
    });

    expect(result).toEqual(selected);
  });

  it("prefere o candidato recente ao mais pontuado quando o mais pontuado nao sobrevive ao filtro de idade", () => {
    // Nenhum dos dois cita cidade monitorada → os dois caem em federal.
    const oldHighScore = suggestion(
      "old",
      "Congresso debate valorização da carreira policial",
      90,
      daysAgo(300), // > NATIONAL_MAX_AGE_DAYS (240) — some da tela mesmo se promovido
    );
    const recentLowScore = suggestion(
      "recent",
      "Ministério da Justiça anuncia plano de valorização policial",
      40,
      daysAgo(5),
    );

    const result = ensureMinimumSphereRepresentation({
      selected: [],
      allCandidates: [oldHighScore, recentLowScore],
      profile,
    });

    expect(result.map((item) => item.id)).toEqual(["recent"]);
  });

  it("nao quebra quando nao existe nenhum candidato pra esfera que falta", () => {
    const local = suggestion("local", "Polícia Civil prende suspeito em Crato", 90);

    const result = ensureMinimumSphereRepresentation({
      selected: [local],
      allCandidates: [local],
      profile,
    });

    // Só municipal disponível — não há o que promover pra federal/estadual, e a
    // função não deve travar nem inventar candidato.
    expect(result).toHaveLength(1);
  });

  it("re-promove do pool pré-rank quando o rank esvaziou a esfera (fallback cego — usado com a IA de resgate desligada ou em falha técnica)", () => {
    // ensureMinimumSphereRepresentation não é mais o caminho principal do pipeline
    // (isso agora é rescueZeroedSpheres, em sentinel-sphere-rescue.ts) — ela virou o
    // fallback cego por score, usado só quando a IA de resgate está desligada ou falha.
    // Simula: quality rank dropou o único federal; selected = só municipal.
    // allCandidates = pool pré-rank ainda tem o federal — precisa voltar.
    const local = suggestion("local", "Polícia Civil prende suspeito em Crato", 90);
    const national = suggestion("national", "Congresso debate valorização da carreira policial", 40);

    const result = ensureMinimumSphereRepresentation({
      selected: [local],
      allCandidates: [local, national],
      profile,
    });

    expect(result.map((item) => item.id)).toEqual(["local", "national"]);
  });
});

describe("collapseNearDuplicateSuggestions — data e veículo", () => {
  it("nao colapsa parafrase quase-igual publicada com mais de 72h de diferenca", () => {
    const recent = suggestion(
      "recent",
      "Prefeitura de Crato anuncia reforma da rodoviária municipal",
      90,
      daysAgo(1),
    );
    const old = suggestion(
      "old",
      "Reforma da rodoviária municipal é anunciada pela Prefeitura de Crato",
      80,
      daysAgo(10),
    );

    const out = collapseNearDuplicateSuggestions([recent, old]);

    expect(out.map((item) => item.id)).toEqual(["recent", "old"]);
  });

  it("colapsa a mesma parafrase quando publicada no mesmo dia", () => {
    const first = suggestion(
      "first",
      "Prefeitura de Crato anuncia reforma da rodoviária municipal",
      90,
      daysAgo(1),
    );
    const second = suggestion(
      "second",
      "Reforma da rodoviária municipal é anunciada pela Prefeitura de Crato",
      80,
      daysAgo(1),
    );

    const out = collapseNearDuplicateSuggestions([first, second]);

    expect(out.map((item) => item.id)).toEqual(["first"]);
  });

  it("veiculo so entra no desempate fraco de 1 palavra em comum — nunca no caminho de 2+ palavras", () => {
    // "É sobre Crato" -> só sobra "crato" (1 token); "Crato tem festa" -> "crato|festa"
    // (2 tokens). overlap=1, união=2 -> passa só pelo desempate fraco (jaccard>=0.5).
    const base = suggestion("base", "É sobre Crato", 90, daysAgo(1), { sourceName: "G1" });
    const sameOutletWeak = suggestion("same-outlet-weak", "Crato tem festa", 80, daysAgo(1), {
      sourceName: "G1",
    });
    const otherOutletWeak = suggestion("other-outlet-weak", "Crato tem festa", 70, daysAgo(1), {
      sourceName: "Diário do Cariri",
    });

    // Mesmo veículo: o desempate fraco de 1 palavra não vale — não colapsa.
    const sameOutletResult = collapseNearDuplicateSuggestions([base, sameOutletWeak]);
    expect(sameOutletResult.map((item) => item.id)).toEqual(["base", "same-outlet-weak"]);

    // Veículo diferente: a régua de texto original decide sozinha — colapsa.
    const otherOutletResult = collapseNearDuplicateSuggestions([base, otherOutletWeak]);
    expect(otherOutletResult.map((item) => item.id)).toEqual(["base"]);
  });

  it("veiculo nao interfere quando o texto ja bate 2+ palavras (caminho original intacto)", () => {
    const base = suggestion(
      "base",
      "Prefeitura de Crato anuncia 12 novas obras para a cidade",
      90,
      daysAgo(1),
      { sourceName: "G1" },
    );
    // Compartilha "crato" + o número "12" (overlap=2) — a régua original já aceita isso
    // incondicionalmente (branch "overlap >= 2"), então o mesmo veículo não deve mudar
    // o resultado: com ou sem veículo igual, continua colapsando.
    const sameOutlet = suggestion(
      "same-outlet",
      "Câmara de Crato aprova orçamento de 12 milhões para o próximo ano",
      80,
      daysAgo(1),
      { sourceName: "G1" },
    );

    const out = collapseNearDuplicateSuggestions([base, sameOutlet]);
    expect(out.map((item) => item.id)).toEqual(["base"]);
  });
});

describe("collapseNearDuplicateSuggestions — ignoreTheme", () => {
  it("por padrao nao colapsa a mesma noticia quando ela casou com temas diferentes", () => {
    const security = suggestion(
      "security",
      "Prefeitura de Crato anuncia reforma da rodoviária municipal",
      90,
      daysAgo(1),
      { theme: "Segurança Pública" },
    );
    const education = suggestion(
      "education",
      "Reforma da rodoviária municipal é anunciada pela Prefeitura de Crato",
      80,
      daysAgo(1),
      { theme: "Educação" },
    );

    const out = collapseNearDuplicateSuggestions([security, education]);

    expect(out.map((item) => item.id)).toEqual(["security", "education"]);
  });

  it("com ignoreTheme colapsa a mesma noticia entre temas diferentes, mantendo a de maior score", () => {
    const security = suggestion(
      "security",
      "Prefeitura de Crato anuncia reforma da rodoviária municipal",
      90,
      daysAgo(1),
      { theme: "Segurança Pública" },
    );
    const education = suggestion(
      "education",
      "Reforma da rodoviária municipal é anunciada pela Prefeitura de Crato",
      80,
      daysAgo(1),
      { theme: "Educação" },
    );
    const unrelated = suggestion(
      "unrelated",
      "Vacinação contra gripe avança em Campinas",
      70,
      daysAgo(1),
      { theme: "Saúde" },
    );

    const out = collapseNearDuplicateSuggestions([security, education, unrelated], {
      ignoreTheme: true,
    });

    expect(out.map((item) => item.id)).toEqual(["security", "unrelated"]);
  });
});
