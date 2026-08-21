/**
 * Tipos do Radar de Bairro. Mecanismo isolado (Rota B): não reaproveita os tipos
 * do Sentinela nem o modelo de geografia dele (que para em UF) — ver
 * docs/radar-de-bairro.md.
 */

/**
 * Unidade de coleta. "cidade" é o modo das cidades abaixo do corte populacional
 * (lá o grupo de bairro em geral nem existe como identidade social); "bairro" é o
 * modo das cidades acima do corte.
 */
export type RadarBairroLocalityKind = "cidade" | "bairro";

/** De onde veio a decisão de monitorar esta localidade. */
export type RadarBairroLocalitySource =
  /** Descoberta automática a partir da cidade do perfil (corte populacional). */
  | "automatico"
  /** Escolha explícita do candidato/equipe — consome cota do plano. */
  | "candidato";

export type RadarBairroLocalityStatus =
  /** Grupo encontrado e aprovado na verificação (ativo + mistura de conteúdo ok). */
  | "ativo"
  /** Nenhum grupo encontrado na busca. Não consome cota. */
  | "sem-grupo"
  /** Grupo existe mas reprovou na verificação (parado ou só comércio). */
  | "reprovado";

export type RadarBairroLocality = {
  kind: RadarBairroLocalityKind;
  source: RadarBairroLocalitySource;
  /** Nome do bairro ou da cidade, como exibido. */
  name: string;
  /** Cidade de referência — usada pra desambiguar o bairro na busca. */
  city: string;
  uf: string;
  status: RadarBairroLocalityStatus;
  /** URL do grupo público do Facebook, quando status = "ativo". */
  groupUrl: string | null;
  groupTitle: string | null;
  /** Posts com texto na amostra de verificação — sinal de "grupo vivo". */
  sampledPosts: number;
  /**
   * Quantos posts da amostra passaram no filtro de relevância. Separa grupo de
   * comunidade de grupo de classificados: os dois têm volume, só um tem conteúdo.
   */
  sampledRelevant: number;
  verifiedAt: string | null;
};

/** Categorias do filtro de relevância — ver docs/radar-de-bairro.md. */
export type RadarBairroTheme =
  | "infraestrutura"
  | "seguranca"
  | "mobilidade"
  | "clima"
  | "saude-educacao"
  | "mobilizacao"
  | "institucional";

export const RADAR_BAIRRO_THEME_LABELS: Record<RadarBairroTheme, string> = {
  infraestrutura: "Infraestrutura e serviço público",
  seguranca: "Segurança pública",
  mobilidade: "Trânsito e mobilidade",
  clima: "Clima e eventos extremos",
  "saude-educacao": "Saúde e educação pública",
  mobilizacao: "Mobilização comunitária",
  institucional: "Ação institucional",
};

export function isRadarBairroTheme(value: unknown): value is RadarBairroTheme {
  return typeof value === "string" && value in RADAR_BAIRRO_THEME_LABELS;
}

/** Post cru coletado de um grupo, antes do filtro de relevância. */
export type RadarBairroPost = {
  id: string;
  url: string;
  text: string;
  publishedAt: string | null;
  authorName: string;
  likes: number;
  comments: number;
  /** Nome do grupo de origem — vira a "fonte" no card. */
  groupTitle: string;
  /** Localidade que originou a coleta (bairro ou cidade). */
  localityName: string;
};

/** Post que passou no filtro, já classificado por tema. */
export type RadarBairroSignal = RadarBairroPost & {
  theme: RadarBairroTheme;
  /** Resumo de uma linha do porquê isso interessa a um mandato. */
  reason: string;
};

export type RadarBairroResult = {
  signals: RadarBairroSignal[];
  meta: {
    generatedAt: string;
    city: string;
    uf: string;
    /** Localidades que produziram esta coleta. */
    localities: string[];
    /** Localidades cadastradas que não renderam nenhum sinal nesta coleta. */
    emptyLocalities: string[];
    postsCollected: number;
    postsKept: number;
  };
};

export function emptyRadarBairroResult(city = "", uf = ""): RadarBairroResult {
  return {
    signals: [],
    meta: {
      generatedAt: new Date().toISOString(),
      city,
      uf,
      localities: [],
      emptyLocalities: [],
      postsCollected: 0,
      postsKept: 0,
    },
  };
}
