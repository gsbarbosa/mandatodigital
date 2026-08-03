import { describe, expect, it } from "vitest";

import type { MockSentinelSuggestion } from "./sentinel-mock-suggestions";
import {
  classifySuggestionSphere,
  groupSuggestionsBySphere,
  isOlderThanSphereWindow,
  normalizeDomain,
  weightedEngagement,
} from "./sphere-classifier";

function buildSuggestion(
  overrides: Partial<MockSentinelSuggestion["evidence"]> & {
    themeLabel?: string;
    matchedThemes?: string[];
  } = {},
): MockSentinelSuggestion {
  const { themeLabel, matchedThemes, ...evidenceOverrides } = overrides;
  return {
    id: "sig-test",
    themeLabel: themeLabel ?? "Saúde Pública (SUS)",
    matchedThemes: matchedThemes ?? ["Saúde Pública (SUS)"],
    relevanceScore: 80,
    topic: "Tema de teste",
    evidence: {
      byNetwork: [],
      actors: [],
      articles: [],
      postsAnalyzed: 0,
      engagementTrendPercent: 0,
      ...evidenceOverrides,
    },
    engagement: {
      relevanceScore: 80,
      scoreTrendPercent: 0,
      likes: 0,
      comments: 0,
      postsAnalyzed: 0,
      sources: [],
      byNetwork: [],
    },
  };
}

describe("normalizeDomain", () => {
  it("strips protocol, www and path", () => {
    expect(normalizeDomain("https://www.estadao.com.br/politica/x")).toBe("estadao.com.br");
    expect(normalizeDomain("www.portalregional.com")).toBe("portalregional.com");
    expect(normalizeDomain("")).toBe("");
  });
});

describe("weightedEngagement", () => {
  it("applies likes + 2x comments", () => {
    expect(weightedEngagement(10, 5)).toBe(20);
  });
});

describe("classifySuggestionSphere", () => {
  it("classifies opposition actors as adversarios", () => {
    const suggestion = buildSuggestion({
      actors: [
        { handle: "rival", network: "instagram", postUrl: "https://x", sourceList: "opposition" },
      ],
    });
    expect(classifySuggestionSphere(suggestion, [])).toBe("adversarios");
  });

  it("classifies interest actors as interesse", () => {
    const suggestion = buildSuggestion({
      actors: [
        { handle: "local", network: "tiktok", postUrl: "https://x", sourceList: "interest" },
      ],
    });
    expect(classifySuggestionSphere(suggestion, [])).toBe("interesse");
  });

  it("classifies articles from interest sites as municipal", () => {
    const suggestion = buildSuggestion({
      articles: [{ title: "t", url: "https://www.portalregional.com/noticia" }],
    });
    expect(classifySuggestionSphere(suggestion, ["www.portalregional.com"])).toBe("municipal");
  });

  it("classifies aggregator articles by sourceName against interest sites", () => {
    const suggestion = buildSuggestion({
      articles: [
        {
          title: "Prefeitura anuncia mutirão - Hora Campinas",
          url: "https://news.google.com/rss/articles/abc123",
          sourceName: "Hora Campinas",
        },
      ],
    });
    expect(classifySuggestionSphere(suggestion, ["www.horacampinas.com.br"])).toBe("municipal");
  });

  it("classifies national portals as federal", () => {
    const suggestion = buildSuggestion({
      articles: [{ title: "t", url: "https://g1.globo.com/politica/noticia.html" }],
    });
    expect(classifySuggestionSphere(suggestion, [])).toBe("federal");
  });

  it("classifies aggregator articles by national sourceName as federal", () => {
    const suggestion = buildSuggestion({
      articles: [
        {
          title: "Reforma avança no Congresso",
          url: "https://news.google.com/rss/articles/def456",
          sourceName: "CNN Brasil",
        },
      ],
    });
    expect(classifySuggestionSphere(suggestion, [])).toBe("federal");
  });

  it("classifies aggregator articles by title suffix when sourceName is missing", () => {
    const suggestion = buildSuggestion({
      articles: [
        {
          title: "Carga tributária em debate - Estadão",
          url: "https://news.google.com/rss/articles/ghi789",
          sourceName: "news.google.com",
        },
      ],
    });
    expect(classifySuggestionSphere(suggestion, [])).toBe("federal");
  });

  it("falls back to federal for dual-catalog themes without portal signal", () => {
    const suggestion = buildSuggestion({
      articles: [
        {
          title: "Estado anuncia obras - Diário Regional",
          url: "https://news.google.com/rss/articles/jkl012",
          sourceName: "Diário Regional",
        },
      ],
    });
    expect(classifySuggestionSphere(suggestion, [])).toBe("federal");
  });

  it("classifies municipal when city name appears in the title", () => {
    const suggestion = buildSuggestion({
      themeLabel: "Reforma Fiscal",
      matchedThemes: ["Reforma Fiscal"],
      articles: [
        {
          title: "Belo Horizonte discute reforma fiscal local",
          url: "https://news.google.com/rss/articles/bh",
          sourceName: "Portal BH",
        },
      ],
    });
    expect(
      classifySuggestionSphere(suggestion, [], "MG", [], {}, ["Belo Horizonte", "Contagem"]),
    ).toBe("municipal");
  });

  it("classifica por catalogo federal mesmo com portal regional", () => {
    const suggestion = buildSuggestion({
      themeLabel: "Piso Salarial",
      matchedThemes: ["Piso Salarial"],
      articles: [
        {
          title: "Comissao do Senado aprova novo piso salarial - Pleno.News",
          url: "https://news.google.com/rss/articles/piso",
          sourceName: "Pleno.News",
        },
      ],
    });
    expect(classifySuggestionSphere(suggestion, [])).toBe("federal");
  });

  it("classifica Ativismo Judicial (STF) como federal", () => {
    const suggestion = buildSuggestion({
      themeLabel: "Ativismo Judicial (STF)",
      matchedThemes: ["Ativismo Judicial (STF)"],
      articles: [
        {
          title: "Gilmar Mendes promete mais ativismo judicial - Gazeta do Povo",
          url: "https://news.google.com/rss/articles/stf",
          sourceName: "Gazeta do Povo",
        },
      ],
    });
    expect(classifySuggestionSphere(suggestion, [])).toBe("federal");
  });

  it("com radar unificado, tema dual-catalog sem sinal de portal vai para nacional", () => {
    const suggestion = buildSuggestion({
      themeLabel: "Combate ao Tráfico",
      matchedThemes: ["Combate ao Tráfico"],
      articles: [
        {
          title: "Operacao apreende drogas - Tribuna do Norte",
          url: "https://news.google.com/rss/articles/trafico",
          sourceName: "Tribuna do Norte",
        },
      ],
    });
    expect(classifySuggestionSphere(suggestion, [])).toBe("federal");
  });

  it("mantem tema estadual quando o radar do perfil marca só estadual", () => {
    const suggestion = buildSuggestion({
      themeLabel: "Combate ao Tráfico",
      matchedThemes: ["Combate ao Tráfico"],
      articles: [
        {
          title: "Operacao apreende drogas - Tribuna do Norte",
          url: "https://news.google.com/rss/articles/trafico",
          sourceName: "Tribuna do Norte",
        },
      ],
    });
    expect(
      classifySuggestionSphere(suggestion, [], "MG", [], {
        federal: [],
        estadual: ["Combate ao Tráfico"],
      }),
    ).toBe("estadual");
  });

  it("respeita o radar do perfil quando o tema existe nos dois catalogos", () => {
    const suggestion = buildSuggestion({
      themeLabel: "Câmeras Corporais",
      matchedThemes: ["Câmeras Corporais"],
      articles: [
        {
          title: "Video de cameras corporais mostra PM – Terra",
          url: "https://news.google.com/rss/articles/cameras",
          sourceName: "Terra",
        },
      ],
    });

    expect(
      classifySuggestionSphere(suggestion, [], "SP", [], {
        federal: ["Reforma Fiscal"],
        estadual: ["Câmeras Corporais"],
      }),
    ).toBe("estadual");

    expect(
      classifySuggestionSphere(suggestion, [], "SP", [], {
        federal: ["Câmeras Corporais"],
        estadual: [],
      }),
    ).toBe("federal");
  });

  it("reclassifica para estadual noticia de veiculo nacional que cita o estado do perfil", () => {
    const suggestion = buildSuggestion({
      themeLabel: "Desemprego",
      matchedThemes: ["Desemprego"],
      articles: [
        {
          title: "Desemprego cai em Minas Gerais no trimestre - Jovem Pan",
          url: "https://news.google.com/rss/articles/mg-desemprego",
          sourceName: "Jovem Pan",
        },
      ],
    });
    expect(classifySuggestionSphere(suggestion, [], "MG")).toBe("estadual");
  });

  it("nao reclassifica quando o titulo nao cita o estado do perfil", () => {
    const suggestion = buildSuggestion({
      themeLabel: "Desemprego",
      matchedThemes: ["Desemprego"],
      articles: [
        {
          title: "Taxa de desemprego recua no pais - Jovem Pan",
          url: "https://news.google.com/rss/articles/nacional-desemprego",
          sourceName: "Jovem Pan",
        },
      ],
    });
    expect(classifySuggestionSphere(suggestion, [], "MG")).toBe("federal");
  });

  it("nao reclassifica por nome do estado quando o tema e exclusivamente federal", () => {
    const suggestion = buildSuggestion({
      themeLabel: "Autonomia do Banco Central",
      matchedThemes: ["Autonomia do Banco Central"],
      articles: [
        {
          title: "Efeito da decisao do BC chega a Minas Gerais - Jovem Pan",
          url: "https://news.google.com/rss/articles/bc-mg",
          sourceName: "Jovem Pan",
        },
      ],
    });
    expect(classifySuggestionSphere(suggestion, [], "MG")).toBe("federal");
  });

  it("nao reclassifica para DF so por citar Distrito Federal", () => {
    const suggestion = buildSuggestion({
      themeLabel: "Desemprego",
      matchedThemes: ["Desemprego"],
      articles: [
        {
          title: "Congresso, no Distrito Federal, discute reforma - Jovem Pan",
          url: "https://news.google.com/rss/articles/df-congresso",
          sourceName: "Jovem Pan",
        },
      ],
    });
    expect(classifySuggestionSphere(suggestion, [], "DF")).toBe("federal");
  });

  it("nao confunde Para com Parana/Paraiba (correspondencia por token inteiro)", () => {
    const suggestion = buildSuggestion({
      themeLabel: "Desemprego",
      matchedThemes: ["Desemprego"],
      articles: [
        {
          title: "Desemprego cai no Parana e na Paraiba - Jovem Pan",
          url: "https://news.google.com/rss/articles/pr-pb",
          sourceName: "Jovem Pan",
        },
      ],
    });
    expect(classifySuggestionSphere(suggestion, [], "PA")).toBe("federal");
  });

  it("prioritizes opposition over article domains", () => {
    const suggestion = buildSuggestion({
      actors: [
        { handle: "rival", network: "x", postUrl: "https://x", sourceList: "opposition" },
      ],
      articles: [{ title: "t", url: "https://g1.globo.com/x" }],
    });
    expect(classifySuggestionSphere(suggestion, [])).toBe("adversarios");
  });
});

describe("groupSuggestionsBySphere", () => {
  it("splits suggestions into the five spheres", () => {
    const federal = buildSuggestion({
      articles: [{ title: "t", url: "https://www.estadao.com.br/x" }],
    });
    const estadual = buildSuggestion({
      articles: [{ title: "t", url: "https://www.otempo.com.br/x" }],
    });
    const groups = groupSuggestionsBySphere([federal, estadual], [], "MG");
    expect(groups.federal).toHaveLength(1);
    expect(groups.estadual).toHaveLength(1);
    expect(groups.municipal).toHaveLength(0);
    expect(groups.interesse).toHaveLength(0);
    expect(groups.adversarios).toHaveLength(0);
  });

  it("drops federal suggestions older than 90 dias, keeps municipal", () => {
    const oldIso = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString();
    const oldFederal = buildSuggestion({
      articles: [{ title: "t", url: "https://www.estadao.com.br/x", publishedAt: oldIso }],
    });
    const oldMunicipal = buildSuggestion({
      themeLabel: "Radar local",
      matchedThemes: ["Radar local"],
      articles: [{ title: "t", url: "https://portal.local/x", publishedAt: oldIso }],
    });

    const groups = groupSuggestionsBySphere([oldFederal, oldMunicipal], [], "MG");
    expect(groups.federal).toHaveLength(0);
    expect(groups.municipal).toHaveLength(1);
  });

  it("estadual tolera matéria mais velha que federal, mas ainda descarta além de 240 dias", () => {
    const withinEstadualWindowIso = new Date(
      Date.now() - 200 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const beyondEstadualWindowIso = new Date(
      Date.now() - 260 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const recentEnoughEstadual = buildSuggestion({
      articles: [
        { title: "t", url: "https://www.otempo.com.br/x", publishedAt: withinEstadualWindowIso },
      ],
    });
    const tooOldEstadual = buildSuggestion({
      articles: [
        { title: "t", url: "https://www.otempo.com.br/y", publishedAt: beyondEstadualWindowIso },
      ],
    });

    expect(groupSuggestionsBySphere([recentEnoughEstadual], [], "MG").estadual).toHaveLength(1);
    expect(groupSuggestionsBySphere([tooOldEstadual], [], "MG").estadual).toHaveLength(0);
  });

  it("does not drop federal/estadual suggestions without a known publish date", () => {
    const federal = buildSuggestion({
      articles: [{ title: "t", url: "https://www.estadao.com.br/x" }],
    });
    const groups = groupSuggestionsBySphere([federal], [], "MG");
    expect(groups.federal).toHaveLength(1);
  });
});

describe("isOlderThanSphereWindow", () => {
  it("treats a suggestion with no dated articles as not stale", () => {
    expect(isOlderThanSphereWindow(buildSuggestion(), 90)).toBe(false);
  });

  it("flags a cluster as stale only when its most recent article is past the window", () => {
    const now = Date.now();
    const stale = buildSuggestion({
      articles: [
        { title: "a", url: "https://a", publishedAt: new Date(now - 200 * 86_400_000).toISOString() },
      ],
    });
    const fresh = buildSuggestion({
      articles: [
        { title: "a", url: "https://a", publishedAt: new Date(now - 200 * 86_400_000).toISOString() },
        { title: "b", url: "https://b", publishedAt: new Date(now - 5 * 86_400_000).toISOString() },
      ],
    });
    expect(isOlderThanSphereWindow(stale, 90, now)).toBe(true);
    expect(isOlderThanSphereWindow(fresh, 90, now)).toBe(false);
  });
});
