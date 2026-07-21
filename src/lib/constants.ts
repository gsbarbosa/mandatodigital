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
  "O Estadista (Serio, Longo prazo)",
  "Homem do Povo (Empatia)",
  "O Xerife/Justiceiro (Ordem)",
  "O Missionario (Moral/Costumes)",
  "O Gestor/CEO (Eficiencia)",
  "O Militante (Mobilizador)",
  "O Professor (Didatico)",
  "O Conciliador (Uniao/Pontes)",
  "Agro/Regionalista (Interior)",
  "O Inovador/Digital (Tech)",
];

export const voiceToneOptions = [
  "Academico",
  "Popular",
  "Indignado",
  "Conciliador",
  "Institucional",
  "Tecnico/Exito",
  "Didatico",
  "Patriotico",
  "Agressivo",
  "Sofisticado",
  "Otimista",
  "Paternal/Maternal",
  "Sarcastico/Ironico",
  "Motivacional",
  "Denuncista",
  "Humoristico",
];

export const avatarTypeOptions = [
  "Meu Gemeo Digital",
  "Minha Caricatura",
] as const;

export const defaultFormats: ContentFormat[] = [
  "Roteiro Reels",
  "Post Instagram",
  "Legenda Instagram",
  "Tweet/X",
  "Resposta Rapida",
  "Audio WhatsApp",
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
  "alagamentos recorrentes apos chuva forte no centro da cidade",
  "projeto para reduzir burocracia de pequenos empreendedores",
];

export const socialNetworkOptions = [
  "Instagram",
  "X / Twitter",
  "TikTok",
  "YouTube",
] as const;

export const sentinelThemeGroups = [
  {
    title: "Economia, Trabalho e Mercado",
    options: [
      "Carga Tributária",
      "Reforma Fiscal",
      "Desemprego",
      "Inflação e Preços",
      "Empreendedorismo",
      "Direito Trabalhista",
      "Privatizações",
      "Subsídios Estatais",
      "Autonomia do Banco Central",
      "Geração de Renda",
      "MEI e Simples Nacional",
      "Contratos Públicos",
    ],
  },
  {
    title: "Segurança, Justiça e Combate ao Crime",
    options: [
      "Segurança Pública",
      "Combate à Corrupção",
      "Endurecimento de Penas",
      "Maioridade Penal",
      "Porte de Armas (CACs)",
      "Combate ao Tráfico",
      "Sistema Prisional",
      "Ressocialização",
      "Direitos Humanos",
      "Proteção de Fronteiras",
      "Valorização Policial",
      "Câmeras Corporais",
    ],
  },
  {
    title: "Meio Ambiente, Agro e Infraestrutura",
    options: [
      "Apoio ao Agronegócio",
      "Transição Energética",
      "Proteção de Biomas",
      "Agricultura Familiar",
      "Defensivos Agrícolas",
      "Demarcação de Terras",
      "Saneamento Básico",
      "Mobilidade Urbana",
      "Ferrovias e Portos",
    ],
  },
  {
    title: "Sociedade, Costumes e Pautas Morais",
    options: [
      "Valores Tradicionais",
      "Proteção da Família",
      "Liberdade Religiosa",
      "Combate ao Aborto",
      "Direitos das Minorias",
      "Ideologia de Gênero",
      "Cota Racial e Social",
      "Direitos da Mulher",
      "Legalização de Drogas",
      "Defesa da Vida",
      "Direitos LGBTQIA+",
    ],
  },
  {
    title: "Estado, Saúde e Educação",
    options: [
      "Saúde Pública (SUS)",
      "Educação Básica",
      "Educação Superior",
      "Combate à Fome / Pobreza",
      "Programas Assistenciais",
      "Homeschooling",
      "Ensino Técnico",
      "Piso Salarial",
      "Fila de Cirurgias",
      "Vacinação",
    ],
  },
  {
    title: "Política Externa, Tecnologia e Mídia",
    options: [
      "Relações Internacionais",
      "Regulamentação de Redes",
      "Liberdade de Expressão",
      "Soberania Nacional",
      "Combate a Fake News",
      "Ativismo Judicial (STF)",
      "Fundão Eleitoral",
      "Transparência Gov.",
    ],
  },
] as const;

export const oppositionThemeGroups = [
  {
    title: "Economia, Trabalho e Mercado (Oposição)",
    options: [
      "Carga Tributária",
      "Reforma Fiscal",
      "Desemprego",
      "Inflação e Preços",
      "Empreendedorismo",
      "Contratos Públicos",
    ],
  },
  {
    title: "Segurança e Combate ao Crime (Oposição)",
    options: [
      "Segurança Pública",
      "Combate à Corrupção",
      "Sistema Prisional",
      "Câmeras Corporais",
    ],
  },
  {
    title: "Meio Ambiente e Infraestrutura (Oposição)",
    options: [
      "Apoio ao Agronegócio",
      "Demarcação de Terras",
      "Saneamento Básico",
      "Mobilidade Urbana",
    ],
  },
  {
    title: "Sociedade, Saúde e Educação (Oposição)",
    options: [
      "Ideologia de Gênero",
      "Direitos da Mulher",
      "Saúde Pública / Filas",
      "Educação Básica",
      "Programas Assistenciais",
    ],
  },
] as const;

export const avatarEmotionOptions = [
  "Manter o estilo do video original",
  "Indignado",
  "Otimista",
  "Triste / Empatico",
  "Sobrio / Institucional",
  "Urgente",
  "Sarcastico",
  "Religioso / Sereno",
] as const;

export const avatarVoicePaceOptions = [
  "Manter velocidade original",
  "Muito Lenta (0.75x)",
  "Lenta (0.90x)",
  "Padrao (1.00x)",
  "Dinamica (1.15x)",
  "Rapida (1.25x)",
  "Muito Rapida (1.50x)",
] as const;

export const editingStyleOptions = [
  "Manter o formato original (Apenas legendas)",
  "Retencao Alta",
  "Documentario Curto",
  "Minimalista",
  "Entrevista / Podcast",
  "Storytelling",
  "Reacao / Dueto",
] as const;

export const factCheckingSourceOptions = [
  "Agencia Lupa",
  "Aos Fatos",
  "Fato ou Fake (G1)",
  "Estadao Verifica",
  "PolitiFact (Global)",
  "Projeto Comprova",
  "UOL Confere",
  "Reuters Fact Check",
  "AFP Checamos",
] as const;

export const hardDataSourceOptions = [
  "IBGE (Populacao/Censo)",
  "IPEA (Pesquisa Economica)",
  "Banco Central do Brasil",
  "Portal da Transparencia",
  "Tesouro Nacional",
  "TSE (Eleicoes/Doacoes)",
  "DataSUS (Leitos/Vacinas)",
  "INEP (IDEB/ENEM)",
] as const;

export const distributionChannelOptions = [
  "Instagram (Feed/Reels)",
  "X / Twitter (Threads)",
  "TikTok",
  "YouTube (Shorts)",
  "Facebook (Pagina)",
  "LinkedIn",
  "Threads",
  "WhatsApp (Grupos VIP)",
  "Telegram (Canal Oficial)",
  "Kwai",
] as const;

export const distributionWindowOptions = [
  "Madrugada (00h-06h)",
  "Manha (07h-11h)",
  "Almoco (11h-14h)",
  "Tarde (14h-18h)",
  "Noite (18h-22h)",
  "Fim de Noite (22h-00h)",
] as const;
