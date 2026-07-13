import { describe, expect, it } from "vitest";

import type { MockSentinelSuggestion } from "./sentinel-mock-suggestions";
import {
  classifySuggestionSphere,
  groupSuggestionsBySphere,
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
    themeLabel: themeLabel ?? "Saude Publica (SUS)",
    matchedThemes: matchedThemes ?? ["Saude Publica (SUS)"],
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
      shares: 0,
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
  it("applies likes + 2x comments + 3x shares", () => {
    expect(weightedEngagement(10, 5, 2)).toBe(26);
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

  it("classifies interest actors as municipal", () => {
    const suggestion = buildSuggestion({
      actors: [
        { handle: "local", network: "tiktok", postUrl: "https://x", sourceList: "interest" },
      ],
    });
    expect(classifySuggestionSphere(suggestion, [])).toBe("municipal");
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

  it("falls back to estadual", () => {
    const suggestion = buildSuggestion({
      articles: [
        {
          title: "Estado anuncia obras - Diário Regional",
          url: "https://news.google.com/rss/articles/jkl012",
          sourceName: "Diário Regional",
        },
      ],
    });
    expect(classifySuggestionSphere(suggestion, [])).toBe("estadual");
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

  it("mantem tema estadual exclusivo na esfera estadual", () => {
    const suggestion = buildSuggestion({
      themeLabel: "Combate ao Trafico",
      matchedThemes: ["Combate ao Trafico"],
      articles: [
        {
          title: "Operacao apreende drogas - Tribuna do Norte",
          url: "https://news.google.com/rss/articles/trafico",
          sourceName: "Tribuna do Norte",
        },
      ],
    });
    expect(classifySuggestionSphere(suggestion, [])).toBe("estadual");
  });

  it("respeita o radar do perfil quando o tema existe nos dois catalogos", () => {
    const suggestion = buildSuggestion({
      themeLabel: "Cameras Corporais",
      matchedThemes: ["Cameras Corporais"],
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
        estadual: ["Cameras Corporais"],
      }),
    ).toBe("estadual");

    expect(
      classifySuggestionSphere(suggestion, [], "SP", [], {
        federal: ["Cameras Corporais"],
        estadual: [],
      }),
    ).toBe("federal");
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
  it("splits suggestions into the four spheres", () => {
    const federal = buildSuggestion({
      articles: [{ title: "t", url: "https://www.estadao.com.br/x" }],
    });
    const estadual = buildSuggestion({
      articles: [{ title: "t", url: "https://www.otempo.com.br/x" }],
    });
    const groups = groupSuggestionsBySphere([federal, estadual], []);
    expect(groups.federal).toHaveLength(1);
    expect(groups.estadual).toHaveLength(1);
    expect(groups.municipal).toHaveLength(0);
    expect(groups.adversarios).toHaveLength(0);
  });
});
