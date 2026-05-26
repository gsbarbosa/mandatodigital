import type { ContentFormat, IntensityLevel } from "@/lib/types";

export const spectrumOptions = [
  "Extrema-Esquerda",
  "Esquerda",
  "Centro-Esquerda",
  "Centro",
  "Centro-Direita",
  "Direita",
  "Extrema-Direita",
];

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
  "Combate a corrupcao",
  "Saude publica",
  "Seguranca",
  "Emprego e renda",
  "Educacao basica",
  "Infraestrutura urbana",
  "Liberdade economica",
  "Defesa da familia",
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
      "Carga Tributaria",
      "Reforma Fiscal",
      "Desemprego",
      "Inflacao e Precos",
      "Empreendedorismo",
      "Direito Trabalhista",
      "Privatizacoes",
      "Subsidios Estatais",
      "Autonomia do Banco Central",
      "Geracao de Renda",
      "MEI e Simples Nacional",
      "Contratos Publicos",
    ],
  },
  {
    title: "Seguranca, Justica e Combate ao Crime",
    options: [
      "Seguranca Publica",
      "Combate a Corrupcao",
      "Endurecimento de Penas",
      "Maioridade Penal",
      "Porte de Armas (CACs)",
      "Combate ao Trafico",
      "Sistema Prisional",
      "Ressocializacao",
      "Direitos Humanos",
      "Protecao de Fronteiras",
      "Valorizacao Policial",
      "Cameras Corporais",
    ],
  },
  {
    title: "Meio Ambiente, Agro e Infraestrutura",
    options: [
      "Apoio ao Agronegocio",
      "Transicao Energetica",
      "Protecao de Biomas",
      "Agricultura Familiar",
      "Defensivos Agricolas",
      "Demarcacao de Terras",
      "Saneamento Basico",
      "Mobilidade Urbana",
      "Ferrovias e Portos",
    ],
  },
  {
    title: "Sociedade, Costumes e Pautas Morais",
    options: [
      "Valores Tradicionais",
      "Protecao da Familia",
      "Liberdade Religiosa",
      "Combate ao Aborto",
      "Direitos das Minorias",
      "Ideologia de Genero",
      "Cota Racial e Social",
      "Direitos da Mulher",
      "Legalizacao de Drogas",
      "Defesa da Vida",
      "Direitos LGBTQIA+",
    ],
  },
  {
    title: "Estado, Saude e Educacao",
    options: [
      "Saude Publica (SUS)",
      "Educacao Basica",
      "Educacao Superior",
      "Combate a Fome / Pobreza",
      "Programas Assistenciais",
      "Homeschooling",
      "Ensino Tecnico",
      "Piso Salarial",
      "Fila de Cirurgias",
      "Vacinacao",
    ],
  },
  {
    title: "Politica Externa, Tecnologia e Midia",
    options: [
      "Relacoes Internacionais",
      "Regulamentacao de Redes",
      "Liberdade de Expressao",
      "Soberania Nacional",
      "Combate a Fake News",
      "Ativismo Judicial (STF)",
      "Fundao Eleitoral",
      "Transparencia Gov.",
    ],
  },
] as const;

export const oppositionThemeGroups = [
  {
    title: "Economia, Trabalho e Mercado (Oposicao)",
    options: [
      "Carga Tributaria",
      "Reforma Fiscal",
      "Desemprego",
      "Inflacao e Precos",
      "Empreendedorismo",
      "Contratos Publicos",
    ],
  },
  {
    title: "Seguranca e Combate ao Crime (Oposicao)",
    options: [
      "Seguranca Publica",
      "Combate a Corrupcao",
      "Sistema Prisional",
      "Cameras Corporais",
    ],
  },
  {
    title: "Meio Ambiente e Infraestrutura (Oposicao)",
    options: [
      "Apoio ao Agronegocio",
      "Demarcacao de Terras",
      "Saneamento Basico",
      "Mobilidade Urbana",
    ],
  },
  {
    title: "Sociedade, Saude e Educacao (Oposicao)",
    options: [
      "Ideologia de Genero",
      "Direitos da Mulher",
      "Saude Publica / Filas",
      "Educacao Basica",
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
