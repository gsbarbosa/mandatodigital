export const dossieHeader = {
  eyebrow: "Documento Técnico-Jurídico",
  title: "Dossiê de Transparência, Conformidade Eleitoral e Regularidade Contábil",
  meta: [
    { label: "Produto", value: "Plataforma Mandato Digital (SaaS)" },
    {
      label: "Empresa Licenciante",
      value: "EATEASY SERVICOS DIGITAIS LTDA — CNPJ 48.142.514/0001-08 | NIRE 31213497978",
    },
    {
      label: "Enquadramento Fisco-Contábil (CNAEs)",
      value: "62.03-1-00, 63.19-4-00 e 63.11-9-00",
    },
    {
      label: "Base Normativa",
      value:
        "Lei nº 9.504/1997; Resolução TSE nº 23.607/2019; art. 9º-B da Resolução TSE nº 23.610/2019 (redação da Res. TSE nº 23.755/2026); Resolução TSE nº 23.732/2024",
    },
  ],
} as const;

export type DossieBullet = { lead?: string; body: string };
export type DossieSection = {
  number: string;
  title: string;
  body?: string;
  bullets?: DossieBullet[];
};

export const dossieSections: DossieSection[] = [
  {
    number: "1",
    title: "Objetivo do Documento",
    body: "O presente dossiê certifica os parâmetros técnicos, jurídicos e operacionais adotados pela plataforma Mandato Digital para a prestação de serviços de inteligência artificial aplicados à comunicação política. Este documento atesta perante a Justiça Eleitoral, Ministérios Públicos e demais órgãos de controle que a tecnologia licenciada opera em estrita obediência às diretrizes de transparência, integridade da informação e proteção do processo eleitoral.",
  },
  {
    number: "2",
    title: "Enquadramento Jurídico e Lisura da Despesa (SPCE)",
    body: "A contratação da plataforma caracteriza-se juridicamente como licenciamento temporário de direito de uso de software não-customizável (modelo SaaS — Software as a Service), provimento de inteligência de dados e monitoramento de informações na internet.",
    bullets: [
      {
        lead: "Para Campanhas Eleitorais:",
        body: "A despesa possui lastro e adequação de finalidade para quitação via Fundo Especial de Financiamento de Campanha (FEFC) ou recursos privados, com emissão de Nota Fiscal rigorosamente vinculada ao CNPJ Eleitoral contratante, de modo a suprir as exigências do Sistema de Prestação de Contas Eleitorais (SPCE).",
      },
      {
        lead: "Para Mandatos em Exercício:",
        body: "A despesa amolda-se à Cota para Exercício da Atividade Parlamentar (CEAP) ou Verbas de Gabinete, enquadrando-se como suporte à comunicação institucional, com estrita separação de escopo.",
      },
    ],
  },
  {
    number: "3",
    title: "Certificado de Conformidade Algorítmica (Res. TSE 23.610/2019 e 23.755/2026)",
    body: "Declaramos que o ecossistema de Inteligência Artificial da plataforma, composto por seus agentes autônomos, possui travas de segurança (guardrails) com foco em:",
    bullets: [
      {
        lead: "Rotulação Visual Obrigatória (Marca d'Água):",
        body: "Todos os vídeos gerados com o Gêmeo Digital recebem, via renderização em servidor (hardcoded), a inserção de uma marca d'água com os dizeres \"Conteúdo gerado por Inteligência Artificial - Res. TSE 23.610/19 e 23.755/26\", em alto contraste e posicionamento contínuo durante toda a exibição da peça, nos termos do art. 9º-B da Res. TSE 23.610/2019 (redação da Res. TSE 23.755/2026).",
      },
      {
        lead: "Rotulação Textual (Legendas):",
        body: "Em publicações automatizadas realizadas através da plataforma em diferentes redes sociais, o sistema injeta via código a tag informativa de conformidade eleitoral no corpo do texto. Caso o usuário opte por exportar a mídia para publicação manual, a plataforma registra a transferência de responsabilidade, e o CONTRATANTE assume a responsabilidade legal exclusiva pela manutenção da transparência e rotulação da peça, nos termos do art. 9°-B da Resolução TSE nº 23.610/2019.",
      },
      {
        lead: "Prevenção à Desinformação:",
        body: "O sistema adota mecanismos para reduzir o risco de geração de deepfakes, ataques reputacionais e disseminação de informações sabidamente falsas. Para isso, prioriza a consulta a múltiplas fontes jornalísticas reconhecidas e, quando aplicável, utiliza Inteligência Artificial e/ou integrações com serviços de checagem de fatos (como a Agência Lupa) para auxiliar na validação das informações antes da geração e disponibilização de conteúdos.",
      },
    ],
  },
  {
    number: "4",
    title: "Atestado de Apagão Algorítmico (Silêncio Eleitoral)",
    body: "A fim de proteger o pleito e a campanha contratante de eventuais sanções por propaganda irregular, a plataforma opera com uma contingência programada de bloqueio (Kill Switch), em estrita observância ao art. 29, § 11, da Resolução TSE nº 23.610/2019:",
    bullets: [
      {
        body: "O sistema bloqueia ativamente qualquer impulsionamento ou disparo coordenado automatizado desde 72 (setenta e duas) horas antes até 24 (vinte e quatro) horas depois do encerramento da votação.",
      },
      {
        body: "Durante este período de silêncio eleitoral algorítmico, as funções ativas de distribuição são paralisadas, restringindo-se a plataforma exclusivamente à escuta e monitoramento de pautas através do Agente Sentinela.",
      },
    ],
  },
  {
    number: "5",
    title: "Trilha de Auditoria e Transferência de Responsabilidade",
    body: "Para garantir o princípio da prestação de contas, a plataforma atua com rastreabilidade total (Auditoria Cruzada):",
    bullets: [
      {
        lead: "Downloads e Exportações Manuais:",
        body: "Caso o usuário opte por exportar a mídia para publicação manual, a plataforma registra o aceite expresso de responsabilidade do cliente quanto à manutenção do rótulo de Inteligência Artificial.",
      },
      {
        lead: "Registro de Atividades:",
        body: "O sistema arquiva metadados rigorosos contendo o User_ID, Endereço IP, Timestamp (Data, Hora e Fuso), e registro de ações (Aprovação de Conteúdo, Disparo e Exportação). Esses logs atestam a origem do comando e eximem a ferramenta de falhas na ponta humana.",
      },
    ],
  },
  {
    number: "6",
    title: "Privacidade e Isolamento de Dados (LGPD)",
    body: "O Mandato Digital não armazena dados sensíveis ou pessoais de eleitores, garantindo anonimização e 100% de aderência à Lei Geral de Proteção de Dados (LGPD). A arquitetura da plataforma assegura o isolamento hermético das bases de dados de cada contratante, impedindo o cruzamento de prompts e estratégias entre gabinetes ou campanhas adversárias.",
  },
  {
    number: "7",
    title: "Comprovação de Materialidade e Origem de Recursos",
    body: "Com o objetivo de apoiar a transparência e fornecer subsídios técnicos para a instrução processual na aplicação de recursos públicos ou privados, a plataforma disponibiliza os seguintes parâmetros para auxiliar a prestação de contas do contratante:",
    bullets: [
      {
        lead: "Origem dos Recursos e Adequação de Finalidade:",
        body: "A arquitetura de dados e os logs gerados pela plataforma fornecem a materialidade necessária para que a contratação seja devidamente comprovada pelo cliente aos órgãos de controle. Para garantir a separação de finalidades, a plataforma permite a segregação de ambientes (workspaces isolados) de acordo com o contrato e o CNPJ da fonte pagadora. No entanto, por atuar estritamente como provedora de infraestrutura tecnológica (SaaS), cabe exclusivamente ao contratante a gestão semântica do conteúdo gerado e o respeito às restrições de sua fonte de financiamento — seja via Cota/Verba de Gabinete para comunicação institucional, ou via Fundo Eleitoral (FEFC) para propaganda eleitoral —, eximindo a plataforma de responsabilidade por eventual desvio de finalidade nas estratégias de comunicação do usuário.",
      },
      {
        lead: "Comprovação de Materialidade:",
        body: "Para consubstanciar a efetiva entrega dos serviços e auxiliar o cliente em sua comprovação contábil, a plataforma fornece, sob demanda, relatórios volumétricos de geração de conteúdo e métricas da operação. Estes artefatos somam-se aos logs de uso, servindo como evidência técnica da utilização da infraestrutura contratada.",
      },
      {
        lead: "Princípio da Economicidade:",
        body: "Declara-se que os valores cobrados pelo licenciamento do software, incluindo sua infraestrutura de inteligência artificial e travas de segurança, refletem os padrões e práticas de precificação do mercado de tecnologia SaaS (Software as a Service), oferecendo ao contratante uma solução em conformidade com as exigências de razoabilidade em contratações de serviços digitais.",
      },
      {
        lead: "Abrangência do Controle Institucional:",
        body: "Os relatórios de materialidade digital e metadados gerados pelo sistema são estruturados com o propósito de facilitar e instrumentalizar as prestações de contas do usuário, auxiliando na documentação exigida pelo Sistema de Prestação de Contas Eleitorais (SPCE) e pela Justiça Eleitoral, bem como na instrução junto aos órgãos de controle interno do Poder Legislativo e aos Tribunais de Contas competentes (TCU e TCEs).",
      },
    ],
  },
];

export const dossieNotice = {
  title: "Nota de Emissão Pública",
  body: "Este documento constitui o Prospecto Técnico de Referência. No ato da contratação e conciliação bancária do plano, o sistema Mandato Digital emitirá e enviará automaticamente ao administrador financeiro da campanha a respectiva Nota Fiscal e Contrato de Prestação de Serviço acompanhada do Dossiê Definitivo com Certificação Digital contendo a qualificação do candidato, a trilha de IP e o Hash de integridade criptográfica da operação.",
} as const;
