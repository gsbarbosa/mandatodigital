export const auditorDetail = {
  badge: "4. Agente Auditor",
  titleLead: "Verificação e Integridade:",
  titleAccent: "O Impacto Real",
  metrics: [
    { value: "14s", label: "Tempo de checagem" },
    { value: "01", label: "Crise reputacional evitada" },
  ],
  stories: [
    {
      title: "O Desafio do Mandato",
      body: "Um dado incorreto em roteiro preliminar pode virar crise reputacional, direito de resposta ou takedown. Equipes humanas não cruzam fontes na velocidade da produção contínua.",
    },
    {
      title: "A Ativação da IA",
      body: "O Agente Auditor cruza o conteúdo com agências de checagem e portais de referência. Em segundos, bloqueia preventivamente o que divergir — e informa a equipe do Candidato.",
    },
  ],
  report: {
    title: "Relatório de Integridade: Análise das fontes",
    lead: "Validação automatizada de conteúdo cruzando informações com agências de checagem independentes.",
    columns: [
      "Nome do Post",
      "Fonte Utilizada",
      "Fonte Validadora",
      "Status da Validação",
      "Print da matéria",
    ] as const,
    rows: [
      {
        post: "Reforma Tributária — STF",
        source: "gov.br/economia",
        sourceTone: "ok" as const,
        validator: "Agência Lupa",
        status: "Aprovado" as const,
        print: "12/05/2026",
      },
      {
        post: "Segurança Pública — Dados",
        source: "ssp.sp.gov.br",
        sourceTone: "ok" as const,
        validator: "PolitiFact",
        status: "Aprovado" as const,
        print: "11/05/2026",
      },
      {
        post: "Plano Diretor — Audiências",
        source: "camara.leg.br",
        sourceTone: "ok" as const,
        validator: "Agência Lupa",
        status: "Aprovado" as const,
        print: "10/05/2026",
      },
      {
        post: "Educação Básica — IDEB",
        source: "portal.fake",
        sourceTone: "bad" as const,
        validator: "PolitiFact",
        status: "Reprovado" as const,
        print: "09/05/2026",
      },
    ],
  },
  verification: {
    title: "Como o Roteiro é",
    titleAccent: "Certificado Antes de Ir ao Ar",
    lead: "O Agente Auditor não opina. Ele cruza cada roteiro com fontes fidedignas e registra a comprovação, pronta para qualquer questionamento.",
    steps: [
      {
        icon: "globe",
        title: "Fontes Fidedignas",
        body: "Portais oficiais (gov.br, TSE, câmaras) e agências de checagem, como Agência Lupa e PolitiFact.",
      },
      {
        icon: "sparkles",
        title: "Leitura via IA",
        body: "O roteiro é lido e cruzado contra essas fontes antes de qualquer gravação.",
      },
      {
        icon: "fileCheck",
        title: "Certificação Registrada",
        body: "Fonte aprovadora, data e horário ficam documentados — prova concreta em caso de questionamento.",
      },
    ],
    footnote:
      "Se uma informação diverge da fonte, o roteiro é bloqueado antes da produção — nunca depois da publicação.",
  },
} as const;
