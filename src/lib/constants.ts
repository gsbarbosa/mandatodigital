import type { ContentFormat, IntensityLevel } from "@/lib/types";

export const spectrumOptions = [
  "Extrema-Esquerda",
  "Esquerda",
  "Centro-Esquerda",
  "Centro",
  "Centro-Direita",
  "Direita",
  "Extrema-Direita",
] as const;

export type SpectrumOption = (typeof spectrumOptions)[number];

export const SPECTRUM_CENTER_INDEX = 3;

export const SPECTRUM_DEFAULT: SpectrumOption = spectrumOptions[SPECTRUM_CENTER_INDEX];

export function spectrumToIndex(value: string | undefined | null) {
  const index = spectrumOptions.indexOf(value as SpectrumOption);
  return index >= 0 ? index : SPECTRUM_CENTER_INDEX;
}

export function indexToSpectrum(index: number): SpectrumOption {
  const clamped = Math.min(Math.max(Math.round(index), 0), spectrumOptions.length - 1);
  return spectrumOptions[clamped];
}

export const archetypeOptions = [
  "O Estadista (Sério, Longo prazo)",
  "Homem do Povo (Empatia)",
  "O Xerife/Justiceiro (Ordem)",
  "O Missionário (Moral/Costumes)",
  "O Gestor/CEO (Eficiência)",
  "O Militante (Mobilizador)",
  "O Professor (Didático)",
  "O Conciliador (União/Pontes)",
  "Agro/Regionalista (Interior)",
  "O Inovador/Digital (Tech)",
];

export const voiceToneOptions = [
  "Acadêmico",
  "Popular",
  "Indignado",
  "Conciliador",
  "Institucional",
  "Técnico/Êxito",
  "Didático",
  "Patriótico",
  "Agressivo",
  "Sofisticado",
  "Otimista",
  "Paternal/Maternal",
  "Sarcástico/Irônico",
  "Motivacional",
  "Denuncista",
  "Humorístico",
];

export const avatarTypeOptions = [
  "Meu Gêmeo Digital",
  "Minha Caricatura",
] as const;

export const defaultFormats: ContentFormat[] = [
  "Roteiro Reels",
  "Post Instagram",
  "Legenda Instagram",
  "Tweet/X",
  "Resposta Rápida",
  "Áudio WhatsApp",
  "Discurso Curto",
];

export const defaultIntensities: IntensityLevel[] = [
  "Cautelosa",
  "Firme",
  "Confrontadora",
];

export const sampleIssueSuggestions = [
  "Combate à corrupção",
  "Saúde pública",
  "Segurança",
  "Emprego e renda",
  "Educação básica",
  "Infraestrutura urbana",
  "Liberdade econômica",
  "Defesa da família",
];

export const sampleValidationTopics = [
  "novo aumento no tempo de espera para consultas especializadas",
  "alagamentos recorrentes após chuva forte no centro da cidade",
  "projeto para reduzir burocracia de pequenos empreendedores",
];

export const socialNetworkOptions = [
  "Instagram",
  "X / Twitter",
  "TikTok",
  "YouTube",
] as const;

/** Catálogo enxuto para configuração do radar (v2). Temas salvos fora da lista continuam válidos no perfil. */
export const sentinelThemeGroups = [
  {
    title: "Saúde, educação e assistência",
    options: [
      "Saúde Pública (SUS)",
      "Vacinação",
      "Educação Básica",
      "Piso Salarial",
      "Combate a Fome / Pobreza",
      "Programas Assistenciais",
    ],
  },
  {
    title: "Segurança, economia e gestão",
    options: [
      "Segurança Pública",
      "Combate à Corrupção",
      "Empreendedorismo",
      "MEI e Simples Nacional",
      "Inflação e Preços",
      "Contratos Públicos",
    ],
  },
  {
    title: "Cidade e território",
    options: [
      "Saneamento Básico",
      "Mobilidade Urbana",
      "Apoio ao Agronegócio",
    ],
  },
] as const;

export const oppositionThemeGroups = [
  {
    title: "Responder com prioridade",
    options: [
      "Segurança Pública",
      "Combate à Corrupção",
      "Reforma Fiscal",
      "Inflação e Preços",
      "Educação Básica",
      "Saúde Pública (SUS)",
      "Contratos Públicos",
      "Mobilidade Urbana",
    ],
  },
] as const;

export const avatarEmotionOptions = [
  "Manter o estilo do vídeo original",
  "Indignado",
  "Otimista",
  "Triste / Empático",
  "Sóbrio / Institucional",
  "Urgente",
  "Sarcástico",
  "Religioso / Sereno",
] as const;

export const avatarVoicePaceOptions = [
  "Manter velocidade original",
  "Muito Lenta (0.75x)",
  "Lenta (0.90x)",
  "Padrão (1.00x)",
  "Dinâmica (1.15x)",
  "Rápida (1.25x)",
  "Muito Rápida (1.50x)",
] as const;

export const editingStyleOptions = [
  "Manter o formato original (Apenas legendas)",
  "Retenção Alta",
  "Documentário Curto",
  "Minimalista",
  "Entrevista / Podcast",
  "Storytelling",
  "Reação / Dueto",
] as const;

export const factCheckingSourceOptions = [
  "Agência Lupa",
  "Aos Fatos",
  "Fato ou Fake (G1)",
  "Estadão Verifica",
  "PolitiFact (Global)",
  "Projeto Comprova",
  "UOL Confere",
  "Reuters Fact Check",
  "AFP Checamos",
] as const;

export const hardDataSourceOptions = [
  "IBGE (População/Censo)",
  "IPEA (Pesquisa Econômica)",
  "Banco Central do Brasil",
  "Portal da Transparência",
  "Tesouro Nacional",
  "TSE (Eleições/Doações)",
  "DataSUS (Leitos/Vacinas)",
  "INEP (IDEB/ENEM)",
] as const;

export const distributionChannelOptions = [
  "Instagram (Feed/Reels)",
  "X / Twitter (Threads)",
  "TikTok",
  "YouTube (Shorts)",
  "Facebook (Página)",
  "LinkedIn",
  "Threads",
  "WhatsApp (Grupos VIP)",
  "Telegram (Canal Oficial)",
  "Kwai",
] as const;

export const distributionWindowOptions = [
  "Madrugada (00h-06h)",
  "Manhã (07h-11h)",
  "Almoço (11h-14h)",
  "Tarde (14h-18h)",
  "Noite (18h-22h)",
  "Fim de Noite (22h-00h)",
] as const;
