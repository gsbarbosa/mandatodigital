export type SentinelSocialNetwork = "instagram" | "tiktok" | "x";

export type SentinelNetworkEngagement = {
  network: SentinelSocialNetwork;
  likes: number;
  comments: number;
  shares: number;
};

/** Perfil com link verificável — origem cadastrada no Sentinela. */
export type SentinelVerifiedActor = {
  handle: string;
  network: SentinelSocialNetwork;
  postUrl: string;
  profileLabel?: string;
  sourceList: "interest" | "opposition";
};

export type SentinelNewsArticle = {
  title: string;
  url: string;
  sourceName?: string;
  publishedAt?: string;
};

/** Tendência de busca via Google Trends API (quando disponível). */
export type SentinelSearchTrend = {
  keyword: string;
  geoLabel: string;
  changePercent: number;
  periodDays: number;
};

export type SentinelVerifiedEvidence = {
  byNetwork: SentinelNetworkEngagement[];
  actors: SentinelVerifiedActor[];
  articles?: SentinelNewsArticle[];
  postsAnalyzed: number;
  outletCount?: number;
  engagementTrendPercent: number;
  searchTrend?: SentinelSearchTrend;
};

export type SentinelEngagementMetrics = {
  relevanceScore: number;
  scoreTrendPercent: number;
  likes: number;
  comments: number;
  shares: number;
  postsAnalyzed: number;
  sources: SentinelSocialNetwork[];
  byNetwork: SentinelNetworkEngagement[];
};

export type SentinelPipeline = "manual" | "portal" | "semantic" | "social" | "legacy";

/** Sinal do Sentinela com dados de alta confiabilidade (scraping + config + Trends). */
export type MockSentinelSuggestion = {
  id: string;
  themeLabel: string;
  matchedThemes: string[];
  relevanceScore: number;
  /** Pipeline de origem (Fase 1). Ausente em sinais legados. */
  pipeline?: SentinelPipeline;
  /** Tema curto para pré-preencher o Criativo — derivado do radar, não de LLM. */
  topic: string;
  evidence: SentinelVerifiedEvidence;
  engagement: SentinelEngagementMetrics;
};

export function sentinelPipelineBadgeLabel(pipeline: SentinelPipeline | undefined) {
  switch (pipeline) {
    case "manual":
      return "Manual";
    case "portal":
      return "Portal";
    case "semantic":
      return "Semântico";
    case "social":
      return "Social";
    default:
      return "Radar";
  }
}

function sumNetworkMetric(
  rows: SentinelNetworkEngagement[],
  key: keyof Pick<SentinelNetworkEngagement, "likes" | "comments" | "shares">,
) {
  return rows.reduce((total, row) => total + row[key], 0);
}

function buildEngagement(
  evidence: SentinelVerifiedEvidence,
  relevanceScore: number,
): SentinelEngagementMetrics {
  return {
    relevanceScore,
    scoreTrendPercent: evidence.engagementTrendPercent,
    likes: sumNetworkMetric(evidence.byNetwork, "likes"),
    comments: sumNetworkMetric(evidence.byNetwork, "comments"),
    shares: sumNetworkMetric(evidence.byNetwork, "shares"),
    postsAnalyzed: evidence.postsAnalyzed,
    sources: evidence.byNetwork.map((row) => row.network),
    byNetwork: evidence.byNetwork,
  };
}

function defineSuggestion(input: {
  id: string;
  themeLabel: string;
  matchedThemes: string[];
  relevanceScore: number;
  topic: string;
  evidence: SentinelVerifiedEvidence;
}): MockSentinelSuggestion {
  return {
    id: input.id,
    themeLabel: input.themeLabel,
    matchedThemes: input.matchedThemes,
    relevanceScore: input.relevanceScore,
    topic: input.topic,
    evidence: input.evidence,
    engagement: buildEngagement(input.evidence, input.relevanceScore),
  };
}

export const mockSentinelSuggestions: MockSentinelSuggestion[] = [
  defineSuggestion({
    id: "sentinela-vacinas-bcg",
    themeLabel: "Saúde",
    matchedThemes: ["Saúde", "Direitos Humanos"],
    relevanceScore: 92,
    topic: "Saúde · vacina BCG",
    evidence: {
      postsAnalyzed: 347,
      engagementTrendPercent: 300,
      searchTrend: {
        keyword: "vacina BCG",
        geoLabel: "São Paulo",
        changePercent: 42,
        periodDays: 7,
      },
      byNetwork: [
        { network: "instagram", likes: 520, comments: 210, shares: 180 },
        { network: "x", likes: 150, comments: 120, shares: 140 },
        { network: "tiktok", likes: 120, comments: 66, shares: 100 },
      ],
      actors: [
        {
          profileLabel: "Líder comunitário Centro",
          handle: "@getulio_23",
          network: "instagram",
          postUrl: "https://instagram.com/p/mock-vacinas-bcg",
          sourceList: "interest",
        },
        {
          profileLabel: "Notícias da cidade",
          handle: "@NoticiasCidadeX",
          network: "x",
          postUrl: "https://x.com/NoticiasCidadeX/status/mock-vacinas",
          sourceList: "interest",
        },
      ],
    },
  }),
  defineSuggestion({
    id: "sentinela-seguranca-publica",
    themeLabel: "Segurança Pública",
    matchedThemes: ["Segurança Pública", "Endurecimento de Penas"],
    relevanceScore: 88,
    topic: "Segurança Pública · endurecimento de penas",
    evidence: {
      postsAnalyzed: 412,
      engagementTrendPercent: 215,
      searchTrend: {
        keyword: "endurecimento de penas",
        geoLabel: "Brasil",
        changePercent: 28,
        periodDays: 7,
      },
      byNetwork: [
        { network: "x", likes: 580, comments: 280, shares: 410 },
        { network: "tiktok", likes: 390, comments: 162, shares: 310 },
        { network: "instagram", likes: 230, comments: 100, shares: 170 },
      ],
      actors: [
        {
          handle: "@Brasil_26",
          network: "x",
          postUrl: "https://x.com/Brasil_26/status/mock-seguranca",
          sourceList: "opposition",
        },
        {
          handle: "@cortes_politica",
          network: "tiktok",
          postUrl: "https://tiktok.com/@cortes_politica/video/mock-seguranca",
          sourceList: "interest",
        },
      ],
    },
  }),
  defineSuggestion({
    id: "sentinela-saude-filantropica",
    themeLabel: "Saúde",
    matchedThemes: ["Saúde"],
    relevanceScore: 74,
    topic: "Saúde · hospitais filantrópicos",
    evidence: {
      postsAnalyzed: 198,
      engagementTrendPercent: 180,
      byNetwork: [
        { network: "tiktok", likes: 1800, comments: 520, shares: 620 },
        { network: "instagram", likes: 980, comments: 240, shares: 310 },
        { network: "x", likes: 620, comments: 130, shares: 170 },
      ],
      actors: [
        {
          profileLabel: "Entidade hospitalar regional",
          handle: "@Salamanca45",
          network: "tiktok",
          postUrl: "https://tiktok.com/@Salamanca45/video/mock-saude",
          sourceList: "interest",
        },
      ],
    },
  }),
  defineSuggestion({
    id: "sentinela-educacao-ideb",
    themeLabel: "Educação",
    matchedThemes: ["Educação"],
    relevanceScore: 69,
    topic: "Educação · IDEB",
    evidence: {
      postsAnalyzed: 156,
      engagementTrendPercent: 142,
      searchTrend: {
        keyword: "IDEB",
        geoLabel: "Minas Gerais",
        changePercent: 18,
        periodDays: 7,
      },
      byNetwork: [
        { network: "x", likes: 510, comments: 128, shares: 190 },
        { network: "instagram", likes: 380, comments: 86, shares: 115 },
      ],
      actors: [
        {
          profileLabel: "Coletivo de professores",
          handle: "@IDEB_Brasil",
          network: "x",
          postUrl: "https://x.com/IDEB_Brasil/status/mock-educacao",
          sourceList: "interest",
        },
      ],
    },
  }),
  defineSuggestion({
    id: "sentinela-meio-ambiente",
    themeLabel: "Meio ambiente",
    matchedThemes: ["Proteção de Biomas"],
    relevanceScore: 58,
    topic: "Meio ambiente · queimadas",
    evidence: {
      postsAnalyzed: 89,
      engagementTrendPercent: 96,
      byNetwork: [
        { network: "tiktok", likes: 360, comments: 72, shares: 58 },
        { network: "instagram", likes: 260, comments: 46, shares: 36 },
      ],
      actors: [
        {
          handle: "@verde_agora",
          network: "instagram",
          postUrl: "https://instagram.com/p/mock-meio-ambiente",
          sourceList: "interest",
        },
      ],
    },
  }),
];

export function getMockSentinelSuggestionById(id: string) {
  return mockSentinelSuggestions.find((suggestion) => suggestion.id === id) ?? null;
}

export function sentinelNetworkLabel(network: SentinelSocialNetwork) {
  switch (network) {
    case "instagram":
      return "Instagram";
    case "tiktok":
      return "TikTok";
    default:
      return "X";
  }
}

export function formatSentinelMetricShort(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    return "0";
  }
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return millions >= 10
      ? `${Math.round(millions)}M`
      : `${millions.toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (value >= 1000) {
    const thousands = value / 1000;
    return thousands >= 10
      ? `${Math.round(thousands)}k`
      : `${thousands.toFixed(1).replace(/\.0$/, "")}k`;
  }
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function formatSentinelSearchTrend(trend: SentinelSearchTrend) {
  const sign = trend.changePercent >= 0 ? "+" : "";
  return `${sign}${trend.changePercent}% buscas (“${trend.keyword}”, ${trend.geoLabel}, ${trend.periodDays} dias)`;
}

export function formatSentinelActorSource(sourceList: SentinelVerifiedActor["sourceList"]) {
  return sourceList === "opposition" ? "Oposição" : "Monitorado";
}

/** Briefing enviado ao Criativo — somente dados verificáveis. */
export function buildSentinelBriefingForCriativo(suggestion: MockSentinelSuggestion) {
  const { evidence, matchedThemes } = suggestion;
  const parts = [
    `Tema do radar: ${suggestion.themeLabel}`,
    `Temas correspondentes: ${matchedThemes.join(", ")}`,
    `Materias analisadas: ${evidence.postsAnalyzed}`,
  ];

  if (evidence.outletCount && evidence.outletCount > 1) {
    parts.push(`Cobertura editorial: ${evidence.outletCount} veiculos distintos`);
  }

  if (evidence.engagementTrendPercent !== 0) {
    parts.push(
      `Variacao de engajamento: ${evidence.engagementTrendPercent >= 0 ? "+" : ""}${evidence.engagementTrendPercent}% vs periodo anterior`,
    );
  }

  if (evidence.searchTrend) {
    parts.push(`Google Trends: ${formatSentinelSearchTrend(evidence.searchTrend)}`);
  }

  const networkLines = evidence.byNetwork.map((row) => {
    return `${sentinelNetworkLabel(row.network)}: ${formatSentinelMetricShort(row.likes)} curtidas, ${formatSentinelMetricShort(row.comments)} comentarios, ${formatSentinelMetricShort(row.shares)} compartilhamentos`;
  });
  if (networkLines.length) {
    parts.push(`Engajamento por rede: ${networkLines.join("; ")}`);
  }

  const actorLines = evidence.actors.map((actor) => {
    const label = actor.profileLabel ? `${actor.profileLabel} (${actor.handle})` : actor.handle;
    return `${label} [${formatSentinelActorSource(actor.sourceList)}]`;
  });
  if (actorLines.length) {
    parts.push(`Perfis com posts detectados: ${actorLines.join("; ")}`);
  }

  const articleLines = (evidence.articles ?? []).map((article) => {
    const source = article.sourceName ? ` (${article.sourceName})` : "";
    return `${article.title}${source}: ${article.url}`;
  });
  if (articleLines.length) {
    parts.push(`Materias detectadas: ${articleLines.join("; ")}`);
  }

  return parts.join("\n");
}

export function buildCriativoNovoHref(topic: string) {
  return `/criativo/novo?tema=${encodeURIComponent(topic)}`;
}
