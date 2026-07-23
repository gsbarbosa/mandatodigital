import type { Route } from "next";

import type { EarlyAccessPlanId } from "@/lib/early-access-types";

export type PricingAccent = "slate" | "cyan" | "purple";

export type PricingPlan = {
  id: EarlyAccessPlanId;
  name: string;
  accent: PricingAccent;
  badge?: string;
  originalPriceLabel: string;
  installmentPrefix: string;
  installmentValue: string;
  campaignTotalLabel: string;
  features: Array<{ text: string; highlight?: boolean; strongPrefix?: string }>;
  restriction: string;
  restrictionTone: "safe" | "urgent";
  ctaLabel: string;
};

export type PricingComparisonRow = {
  section?: string;
  label: string;
  values: [string, string, string];
};

export const pricingUrgencyBanner =
  "Planos com vagas limitadas por Lote e preço promocional com 50% off.";

export const pricingIntro = {
  eyebrow: "Planos e preços",
  title: "Reserva VIP — escolha o pacote da sua campanha",
  body: "Monitoramento em tempo real, avatares personalizados com voz do candidato, e compliance total com TSE. Tudo integrado em uma plataforma.",
} as const;

export const pricingPlans: PricingPlan[] = [
  {
    id: "essencial",
    name: "Essencial",
    accent: "slate",
    originalPriceLabel: "De R$ 1.996",
    installmentPrefix: "3x de",
    installmentValue: "998",
    campaignTotalLabel: "Pacote Campanha: R$ 2.994",
    features: [
      { text: "Monitoramento ilimitado de redes sociais, portais, sites e blogs" },
      { text: "Produção de 5 avatares/mês (2 digitais e 3 caricaturas/3D)." },
      { text: "Checagem de fatos básica." },
    ],
    restriction: "Vagas garantidas no Lote Atual",
    restrictionTone: "safe",
    ctaLabel: "Reservar Desconto",
  },
  {
    id: "avancado",
    name: "Avançado",
    accent: "cyan",
    originalPriceLabel: "De R$ 3.996",
    installmentPrefix: "3x de",
    installmentValue: "1.998",
    campaignTotalLabel: "Pacote Campanha: R$ 5.994",
    features: [
      { text: "Todos os benefícios do plano Essencial." },
      {
        text: "Produção de 22 avatares/mês (livre escolha) com renderização avançada de Gêmeo Digital.",
      },
      {
        text: "Provas geradas e protocoladas para o seu corpo jurídico.",
        highlight: true,
        strongPrefix: "Compliance Legal Pack Institucional*:",
      },
    ],
    restriction: "Limitado por ordem de chegada e UF",
    restrictionTone: "urgent",
    ctaLabel: "Reservar Vaga VIP",
  },
  {
    id: "elite",
    name: "Elite",
    accent: "purple",
    badge: "Melhor Custo Benefício",
    originalPriceLabel: "De R$ 9.996",
    installmentPrefix: "3x de",
    installmentValue: "4.998",
    campaignTotalLabel: "Pacote Campanha: R$ 14.994",
    features: [
      { text: "Todos os benefícios do plano Avançado." },
      {
        text: "(livre escolha) com renderização avançada de Gêmeo Digital.",
        strongPrefix: "Produção de 60 avatares/mês",
      },
      {
        text: "Publicação simultânea e adaptada em 07 redes: Instagram, TikTok, Twitter/X, YouTube, Threads e LinkedIn.",
      },
    ],
    restriction: "Limitado por ordem de chegada e UF",
    restrictionTone: "urgent",
    ctaLabel: "Reservar Vaga VIP",
  },
];

export const pricingComplianceCta = {
  title: "100% Compliance TSE",
  subtitle: "Dossiê de Conformidade (TSE / SPCE)",
  href: "/conformidade" as Route,
} as const;

export const pricingRestriction = {
  eyebrow: "Alerta de Restrição",
  titleLead: "Vagas limitadas por",
  titleAccent: "ordem de chegada",
  titleTail: "e Lotes Estaduais.",
  body: "O Mandato Digital.IA é uma infraestrutura de alta performance. Para garantir a máxima velocidade de processamento e proteger a estabilidade dos avatares de todos os candidatos, estabelecemos uma trava de acessos organizada em lotes com limite dinâmico por Estado:",
  lots: [
    {
      number: "1",
      title: "Lote de Lançamento",
      badge: "Disponível Agora",
      tone: "active" as const,
      body: "Acesso imediato liberado estritamente por ordem de chegada com 50% de desconto.",
      footnote:
        "* Ao atingir a capacidade técnica de processamento dos servidores para o seu Estado, o lote será encerrado automaticamente.",
    },
    {
      number: "2",
      title: "Fila de Espera / 2º Lote",
      badge: "Risco de Virada",
      tone: "waitlist" as const,
      body: "Vagas restritas distribuídas conforme a liberação de nova infraestrutura de IA.",
      footnote:
        "* Esgotado o lote atual, novas assinaturas sofrerão reajuste de precificação ou serão alocadas em fila de espera sem garantia de acesso.",
    },
  ],
  footnotes: [
    {
      title: "Sobre o Compliance Legal Pack*",
      body: "Para impugnações junto ao TSE, o sistema extrai logs atestados por Agente Auditor, com histórico imutável por protocolo. (Add-on no plano Essencial por R$ 2.500).",
    },
    {
      title: "Processamento e Infraestrutura",
      body: "A renderização de Gêmeos Digitais exige processamento massivo de dados. A restrição garante máxima velocidade e estabilidade das campanhas ativas.",
    },
    {
      title: "Vigência e Faturamento",
      body: "Licenciamento integral para o período eleitoral (Julho a Outubro de 2026). Contrato fechado garantindo exclusividade, com faturamento em 3 parcelas vinculadas ao CNPJ da campanha.",
    },
  ],
} as const;

export const pricingComparison = {
  title: "Comparativo Detalhado de Entrega",
  lead: "Verifique a capacidade técnica de processamento e os limites de inteligência de cada pacote.",
  rows: [
    { section: "Monitoramento", label: "Sites, Portais e Blogs", values: ["✓", "✓", "✓"] },
    { label: "Perfis em Redes Sociais", values: ["✓", "✓", "✓"] },
    { label: "Perfis de adversários", values: ["✓", "✓", "✓"] },
    {
      label: "Monitoramento de temas de campanha com expansão semântica",
      values: ["✓", "✓", "✓"],
    },
    {
      label: "Acesso ao painel de monitoramento com ranking de notícias",
      values: ["✓", "✓", "✓"],
    },
    { section: "Personalização", label: "Replicação da voz do candidato", values: ["✓", "✓", "✓"] },
    {
      label: "Avatares com voz do candidato (Gêmeo Digital, Caricato e 3D)",
      values: [
        "5, sendo máximo com 2 Gêmeo Digital",
        "22 com renderização avançada e sem restrições por tipo de avatar",
        "60 com renderização avançada e sem restrições por tipo de avatar",
      ],
    },
    { label: "Inclusão de posicionamento ideológico", values: ["✓", "✓", "✓"] },
    { label: "Inclusão de arquétipo político", values: ["✓", "✓", "✓"] },
    { label: "Inclusão de tom de linguagem", values: ["✓", "✓", "✓"] },
    { label: "Inclusão de glossário de expressões pessoais", values: ["✓", "✓", "✓"] },
    {
      section: "Produção",
      label: "Roteiro viral com posicionamento do candidato em temas selecionados",
      values: ["20", "220", "600"],
    },
    { label: "Edição e ajustes de roteiros", values: ["✓", "✓", "✓"] },
    {
      label: "Marca d'água em total conformidade com as resoluções do TSE",
      values: ["✓", "✓", "✓"],
    },
    {
      label:
        "Legenda automática em conformidade com as resoluções do TSE em todas publicações realizadas a partir da plataforma",
      values: ["✓", "✓", "✓"],
    },
    {
      label: "Avisos sobre o uso do material em conformidade com TSE",
      values: ["✓", "✓", "✓"],
    },
    {
      section: "Auditoria",
      label: "Verifica autenticidade da matéria ou post selecionado",
      values: ["✓", "✓", "✓"],
    },
    {
      label: "Verifica autenticidade do roteiro gerado pelo próprio MandatoDigital",
      values: ["✓", "✓", "✓"],
    },
    { label: "Checagem de fatos", values: ["Básica", "Avançada", "Avançada"] },
    {
      label: "Compliance Legal Pack Institucional*",
      values: ["✕ (R$ 2.500)", "✓ Incluído", "✓ Incluído"],
    },
    {
      section: "Distribuidor",
      label: "Customiza o conteúdo gerado para publicação em 07 redes sociais",
      values: ["✕", "✕", "✓"],
    },
    {
      label:
        "Permite selecionar uma ou todas as redes - Insta, X, TikTok, Threads, Youtube, Face e LinkedIn",
      values: ["✕", "✕", "✓"],
    },
    { label: "Grade de horário de disparos", values: ["✕", "✕", "✓"] },
  ] satisfies PricingComparisonRow[],
} as const;

export const pricingFooterNote = "Plataforma disponível até 31/Outubro/2026";
