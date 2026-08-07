import { describe, expect, it } from "vitest";

import {
  buildSentinelRssQueries,
  buildSphereGeoScope,
  buildStoryClusterKey,
  clusterScoredArticles,
  countUniqueOutlets,
  decodeXmlEntities,
  matchLiteralThemes,
  matchSentinelThemes,
  normalizeSentinelText,
  parseGoogleNewsRss,
  scoreSentinelArticle,
} from "@/lib/sentinel-rss";
import { matchThemesWithSynonyms, pickBestMatchedTheme, resolveArticleMatchingSearchTerm } from "@/lib/sentinel-theme-synonyms";
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
  sentinelThemes: ["Segurança Pública", "Vacinação", "Reforma Fiscal"],
  sentinelThemesFederal: ["Vacinação", "Reforma Fiscal"],
  sentinelThemesEstadual: ["Segurança Pública"],
  oppositionThemes: ["Endurecimento de Penas"],
  customRadarThemes: ["fila do SUS"],
  municipalCities: ["Campinas"],
  interestProfiles: [],
  interestSites: ["g1.com.br"],
  oppositionProfiles: [],
  oppositionSites: [],
  glossaryTerms: [],
  trainingReferenceLinks: [],
  youtubeVideoUrl: "",
  avatarType: "",
  avatarVideoTopic: "",
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

  it("nao associa Saneamento Básico a noticia de policiamento por causa de 'falta'", () => {
    const haystack =
      "Falta de policiamento e o principal problema de seguranca em Sao Paulo, mostra Datafolha - CBN";

    expect(
      matchThemesWithSynonyms(haystack, ["Saneamento Básico", "Segurança Pública"]),
    ).toEqual(["Segurança Pública"]);

    expect(pickBestMatchedTheme(haystack, ["Saneamento Básico", "Segurança Pública"])).toBe(
      "Segurança Pública",
    );
  });

  it("mantem match de saneamento quando a materia fala de agua", () => {
    const haystack = "Moradores reclamam da falta de agua potavel no bairro";

    expect(matchThemesWithSynonyms(haystack, ["Saneamento Básico"])).toContain("Saneamento Básico");
  });

  it("retorna o sinonimo que casou quando distinto do tema principal", () => {
    const haystack = "Startup de Campinas capta investimento para expandir operacao";

    expect(resolveArticleMatchingSearchTerm(haystack, "Empreendedorismo")).toBe("startup");
  });

  it("nao exibe termo quando o match veio do proprio tema principal", () => {
    const haystack =
      "Qualifica SP encerra inscricoes para curso gratuito de empreendedorismo - G1";

    expect(resolveArticleMatchingSearchTerm(haystack, "Empreendedorismo")).toBeNull();
  });

  it("prioriza termo de expansao semantica quando ele explica o match", () => {
    const haystack = "Belo Horizonte avanca plano de venda de estatais locais";

    expect(
      resolveArticleMatchingSearchTerm(haystack, "Privatizações", [
        "Belo Horizonte",
        "venda de estatais",
      ]),
    ).toBe("venda de estatais");
  });
});

describe("sentinel-rss", () => {
  it("normaliza texto para comparacao sem acentos", () => {
    expect(normalizeSentinelText("Reforma Tributária")).toBe("reforma tributaria");
  });

  it("decodifica entidades HTML numericas em titulos do RSS", () => {
    expect(
      decodeXmlEntities(
        "A Reforma Tribut&#225;ria &#233; digital: transforma&#231;&#227;o fiscal",
      ),
    ).toBe("A Reforma Tributária é digital: transformação fiscal");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <rss><channel>
        <item>
          <title>A Reforma Tribut&#225;ria &#233; digital</title>
          <link>https://bing.com/news/example</link>
          <pubDate>Mon, 23 Jun 2026 10:00:00 GMT</pubDate>
          <source>bing.com</source>
        </item>
      </channel></rss>`;

    const items = parseGoogleNewsRss(xml);
    expect(items[0]?.title).toBe("A Reforma Tributária é digital");
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
    // Recorte estadual usa o nome por extenso, não a sigla — "SP" quase não aparece
    // no corpo das matérias e derrubava a recall da busca.
    expect(queries).toContain("Segurança Pública São Paulo");
    expect(queries.some((query) => /\bSP\b/.test(query))).toBe(false);
    expect(queries.some((query) => query.includes("Vacinação") && query.includes("Brasil"))).toBe(
      true,
    );
    expect(queries.some((query) => query.includes("Vacinação") && query.includes("Campinas"))).toBe(
      true,
    );
    expect(queries.some((query) => query.includes("fila do SUS"))).toBe(true);
    expect(queries.some((query) => query.includes("Endurecimento de Penas"))).toBe(false);
    expect(queries.length).toBeGreaterThanOrEqual(3);
  });

  it("não pontua UF por substring dentro de outra palavra", () => {
    const profile = { ...sampleProfile, city: "", state: "SP" };
    const article = { title: "Esporte movimenta o fim de semana", link: "x", pubDate: null, publishedAt: null };
    // matchedInterest tira a nota do piso (Math.max(10, …)), senão os dois empatam em 10.
    const matched = ["Vacinação"];
    const falsePositive = scoreSentinelArticle(article, profile, matched, []);
    const real = scoreSentinelArticle(
      { ...article, title: "São Paulo anuncia novo pacote" },
      profile,
      matched,
      [],
    );
    expect(real - falsePositive).toBe(10);
  });

  it("isola o recorte geográfico por esfera", () => {
    const scope = buildSphereGeoScope({
      ...sampleProfile,
      city: "Campinas",
      state: "SP",
      municipalCities: ["Campinas", "Sorocaba"],
    });

    // Federal não tem recorte: agenda nacional não pode ser filtrada por município.
    expect(scope.federal).toBe("");
    // Estadual nunca carrega o município.
    expect(scope.estadual).toBe("São Paulo");
    expect(scope.estadual).not.toContain("Campinas");
    // Municipal amarra o município ao estado (desambigua homônimos entre UFs).
    expect(scope.municipal("Sorocaba")).toBe("Sorocaba São Paulo");
    expect(scope.primaryMunicipal).toBe("Campinas São Paulo");
  });

  it("cai para o município da lista quando o perfil não tem cidade", () => {
    const scope = buildSphereGeoScope({
      ...sampleProfile,
      city: "",
      state: "MG",
      municipalCities: ["Uberlândia"],
    });
    expect(scope.estadual).toBe("Minas Gerais");
    expect(scope.primaryMunicipal).toBe("Uberlândia Minas Gerais");
  });

  it("não inventa recorte quando a UF é inválida", () => {
    const scope = buildSphereGeoScope({ ...sampleProfile, state: "XX", city: "Campinas" });
    expect(scope.estadual).toBe("");
    expect(scope.primaryMunicipal).toBe("Campinas");
  });

  it("inclui ate o teto de temas de interesse nas queries", () => {
    const profile = {
      ...sampleProfile,
      sentinelThemesFederal: [
        "Vacinação",
        "Desemprego",
        "Carga Tributária",
        "Inflação e Preços",
        "Empreendedorismo",
        "Privatizações",
      ],
      sentinelThemesEstadual: [
        "Segurança Pública",
        "Saúde Pública (SUS)",
        "Educação Básica",
        "Mobilidade Urbana",
        "Saneamento Básico",
        "Agricultura Familiar",
      ],
      sentinelThemes: [],
      customRadarThemes: [
        "fila do SUS",
        "obra da orla",
        "IPTU",
        "feira livre",
        "ciclofaixa",
        "extra",
        "horta comunitária",
        "creche noturna",
        "fora do teto",
      ],
    };
    const queries = buildSentinelRssQueries(profile);
    expect(queries.filter((q) => q.endsWith(" Brasil"))).toHaveLength(8);
    expect(queries.some((q) => q.includes("Agricultura Familiar"))).toBe(false);
    expect(queries.some((q) => q.includes("ciclofaixa"))).toBe(true);
    expect(queries.some((q) => q.includes("creche noturna"))).toBe(true);
    expect(queries.some((q) => q.includes("fora do teto"))).toBe(false);
    expect(queries.some((q) => q.includes("Vacinação") && q.includes("Campinas"))).toBe(true);
  });

  it("associa temas do radar ao titulo da materia", () => {
    const matches = matchSentinelThemes(
      "Operação reforça segurança pública em Campinas",
      sampleProfile.sentinelThemes,
    );
    expect(matches).toContain("Segurança Pública");
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
      ["Vacinação"],
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
        themeLabel: "Segurança Pública",
        matchedThemes: ["Segurança Pública"],
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
        themeLabel: "Segurança Pública",
        matchedThemes: ["Segurança Pública"],
        sourceList: "interest",
        relevanceScore: 0,
      },
    ]);

    expect(clusters).toHaveLength(1);
    expect(clusters[0]).toHaveLength(2);
    expect(buildStoryClusterKey("Campinas reforça segurança pública")).toBeTruthy();
  });

  it("nao agrupa materias diferentes so por repetirem o nome do tema", () => {
    const clusters = clusterScoredArticles([
      {
        article: {
          title: "Autora compara sistema prisional do Brasil com Noruega",
          link: "https://example.com/a",
          pubDate: null,
          publishedAt: null,
          sourceName: "VEJA",
        },
        themeLabel: "Sistema Prisional",
        matchedThemes: ["Sistema Prisional"],
        sourceList: "interest",
        relevanceScore: 0,
      },
      {
        article: {
          title: "Flávio engana ao propor criar 500 mil vagas no sistema prisional",
          link: "https://example.com/b",
          pubDate: null,
          publishedAt: null,
          sourceName: "Brasil 247",
        },
        themeLabel: "Sistema Prisional",
        matchedThemes: ["Sistema Prisional"],
        sourceList: "interest",
        relevanceScore: 0,
      },
    ]);

    expect(clusters).toHaveLength(2);
  });

  it("agrupa a mesma materia mesmo com o veiculo colado no titulo bruto", () => {
    const clusters = clusterScoredArticles([
      {
        article: {
          title:
            "Polícia Civil prende mulher na Rodoviária de Crato com 4 Kg de drogas que trazia de Sobral - Portal Miséria",
          link: "https://example.com/a",
          pubDate: null,
          publishedAt: null,
          sourceName: "Portal Miséria",
        },
        themeLabel: "Valorização Policial",
        matchedThemes: ["Valorização Policial"],
        sourceList: "interest",
        relevanceScore: 0,
      },
      {
        article: {
          title: "Polícia Civil faz operação contra o Comando Vermelho na Bahia e no Ceará - CNN Brasil",
          link: "https://example.com/b",
          pubDate: null,
          publishedAt: null,
          sourceName: "CNN Brasil",
        },
        themeLabel: "Valorização Policial",
        matchedThemes: ["Valorização Policial"],
        sourceList: "interest",
        relevanceScore: 0,
      },
    ]);

    expect(clusters).toHaveLength(1);
    expect(clusters[0]).toHaveLength(2);
  });

  it("nao agrupa fatos diferentes so por citarem a mesma instituicao recorrente", () => {
    function article(title: string, source: string) {
      return {
        article: {
          title,
          link: `https://example.com/${title.slice(0, 10)}`,
          pubDate: null,
          publishedAt: null,
          sourceName: source,
        },
        themeLabel: "Valorização Policial",
        matchedThemes: ["Valorização Policial"],
        sourceList: "interest" as const,
        relevanceScore: 0,
      };
    }

    // O corte automático só ativa com lote de 15+ (ver BATCH_COMMON_WORDS_MIN_TITLES)
    // — por isso 15 fatos diferentes aqui, não só os 7 originais.
    const clusters = clusterScoredArticles([
      article(
        "Polícia Civil prende mulher na Rodoviária de Crato com 4 Kg de drogas que trazia de Sobral",
        "Portal Miséria",
      ),
      article("Minas Gerais tem o menor salário da Polícia Civil do Brasil", "Diário do Comércio"),
      article(
        "Polícia Civil prende suspeito de tráfico internacional e lavagem de dinheiro no Recife",
        "CBN Recife",
      ),
      article(
        "Polícia Civil desarticula laboratório cladestino em Fortaleza; quatro são presos",
        "Portal Miséria",
      ),
      article("Polícia Civil captura integrantes de facção paulista no Ceará", "CN7"),
      article(
        "Mais de 20 membros do Comando Vermelho são presos em operação da Polícia Civil",
        "G1",
      ),
      article("Concursos Polícia Civil 2026: veja ranking do salário de delegado", "Qconcursos"),
      article("Polícia Civil recupera veículo roubado em Juazeiro do Norte", "Diário do Nordeste"),
      article("Polícia Civil resgata vítima de sequestro em Quixadá", "O POVO"),
      article("Polícia Civil apreende arma de fogo em Iguatu", "G1"),
      article("Polícia Civil investiga homicídio em Canindé", "Ceará Agora"),
      article("Polícia Civil prende foragido da justiça em Itapipoca", "Diário do Nordeste"),
      article("Polícia Civil desmantela quadrilha de estelionato em Maracanaú", "O POVO"),
      article("Polícia Civil localiza pessoa desaparecida em Aquiraz", "G1"),
      article("Polícia Civil autua motorista embriagado em Caucaia", "Ceará Agora"),
    ]);

    // 15 fatos diferentes, mesma instituição em quase todo título → 15 clusters, não 1.
    expect(clusters).toHaveLength(15);

    // Mas uma paráfrase real da mesma prisão (mesmo local, mesma quantidade) continua colapsando.
    const dupClusters = clusterScoredArticles([
      article(
        "Polícia Civil prende mulher na Rodoviária de Crato com 4 Kg de drogas que trazia de Sobral",
        "Portal Miséria",
      ),
      article(
        "Mulher é presa na Rodoviária de Crato com 4 kg de drogas, diz Polícia Civil",
        "G1",
      ),
    ]);
    expect(dupClusters).toHaveLength(1);
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

    const seguranca = suggestions.find((item) => item.themeLabel === "Segurança Pública");
    expect(seguranca?.evidence.outletCount).toBeGreaterThanOrEqual(2);
    expect(seguranca?.evidence.articles?.length).toBeGreaterThanOrEqual(2);
    expect(seguranca?.topic).toContain("·");
  });
});
