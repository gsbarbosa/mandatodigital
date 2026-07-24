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
      body: "O Agente Auditor cruza o conteúdo com agências de checagem e portais de referência. Em 14 segundos, bloqueia preventivamente o que divergir — antes da publicação.",
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
  approval: {
    title: "Aprovação de Conteúdo",
    cards: [
      {
        title: "Reforma Tributária",
        body: "Peça checada e pronta para publicação nas redes prioritárias do mandato.",
        tag: "#reforma",
        image: "/marketing/auditor/auditor-reforma.jpg",
        imageAlt: "Thumbnail temática de Reforma Tributária",
      },
      {
        title: "Segurança no Centro",
        body: "Roteiro validado com fontes oficiais e selo de conformidade emitido.",
        tag: "#seguranca",
        image: "/marketing/auditor/auditor-seguranca.jpg",
        imageAlt: "Thumbnail temática de Segurança Pública",
      },
      {
        title: "Saúde nos Postos",
        body: "Avatar e caption aprovados após cruzamento com dados da secretaria.",
        tag: "#saude",
        image: "/marketing/auditor/auditor-saude.jpg",
        imageAlt: "Thumbnail temática de Saúde",
      },
    ],
  },
} as const;
