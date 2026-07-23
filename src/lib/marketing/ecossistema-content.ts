import type { AgentAccent } from "@/lib/marketing/shared";

export type EcosystemIoIcon =
  | "globe"
  | "usersFocus"
  | "tag"
  | "flame"
  | "chess"
  | "podium"
  | "video"
  | "userCog"
  | "book"
  | "shield"
  | "scale"
  | "persona"
  | "list"
  | "layers"
  | "link"
  | "badge"
  | "clapper"
  | "file"
  | "gavel"
  | "feed"
  | "clock"
  | "share";

export type EcosystemIoItem = {
  text: string;
  icon: EcosystemIoIcon;
};

export type EcosystemAgent = {
  id: string;
  number: string;
  name: string;
  title: string;
  description: string;
  accent: AgentAccent;
  inputs: EcosystemIoItem[];
  outputs: EcosystemIoItem[];
  learnMoreHref?: string;
};

export const ecosystemIntro = {
  eyebrow: "Ecossistema",
  title: "Cinco agentes. Uma linha de montagem eleitoral.",
  body: "Cada agente cumpre um papel especializado — da captura da pauta à publicação multiplataforma — preservando identidade, qualidade e conformidade.",
} as const;

export const ecosystemAgents: EcosystemAgent[] = [
  {
    id: "sentinela",
    number: "1",
    name: "Sentinela",
    title: "Identifica Pautas Quentes do Dia",
    description:
      "Varre redes sociais, portais e blogs 24 horas por dia em busca de gatilhos de pauta nos seus temas, capturando o que está esquentando antes que vire manchete consolidada.",
    accent: "sentinela",
    inputs: [
      {
        icon: "globe",
        text: "Sites, blogs e portais oficiais indicados para monitoramento contínuo.",
      },
      {
        icon: "usersFocus",
        text: "Perfis de interesse, adversários e influentes, em YouTube, Instagram, X e TikTok.",
      },
      {
        icon: "tag",
        text: "Temas de interesse da campanha, como minorias, saúde, agro e infraestrutura.",
      },
    ],
    outputs: [
      {
        icon: "flame",
        text: "Pautas quentes do dia sobre temas de interesse.",
      },
      {
        icon: "chess",
        text: "Pautas quentes do dia sobre adversários.",
      },
      {
        icon: "podium",
        text: "Ranking de oportunidades definidas e encaminhadas para produção pelo Agente Criativo.",
      },
    ],
    learnMoreHref: "/ecossistema/sentinela",
  },
  {
    id: "curador",
    number: "2",
    name: "Curador",
    title: "Preservação de Identidade e Estilo",
    description:
      "Guarda a alma comunicacional. Aplica o posicionamento ideológico e preserva a personalidade do parlamentar, garantindo que cada peça soe inequivocamente como o mandato.",
    accent: "curador",
    inputs: [
      {
        icon: "video",
        text: "Vídeos de referência com discursos e falas indicados pelo próprio parlamentar.",
      },
      {
        icon: "userCog",
        text: "Arquétipos de persona política, como empático ou inovador, e tom de linguagem, como agressivo ou calmo.",
      },
      {
        icon: "book",
        text: "Glossário estratégico de expressões pessoais.",
      },
    ],
    outputs: [
      {
        icon: "shield",
        text: "Zero risco de a peça ou post soar como IA ou robótica.",
      },
      {
        icon: "scale",
        text: "Coerência absoluta entre o posicionamento do parlamentar e o conteúdo publicado.",
      },
      {
        icon: "persona",
        text: "Identidade política e ideológica preservada.",
      },
    ],
    learnMoreHref: "/ecossistema/curador",
  },
  {
    id: "criativo",
    number: "3",
    name: "Criativo",
    title: "Roteirização e Síntese de Mídia",
    description:
      "A linha de montagem viral — conteúdo persuasivo para cada tema identificado, com a personalidade do candidato.",
    accent: "criativo",
    inputs: [
      {
        icon: "list",
        text: "Pautas quentes priorizadas e validadas estrategicamente pelo Sentinela.",
      },
      {
        icon: "userCog",
        text: "Persona, posicionamento, vídeos do político e vocabulário estabelecidos pelo Curador.",
      },
      {
        icon: "link",
        text: "Solicitação do usuário, por meio do link de uma matéria, para produção de conteúdo específico.",
      },
    ],
    outputs: [
      {
        icon: "layers",
        text: "Roteiros, scripts de fala e captions persuasivas.",
      },
      {
        icon: "persona",
        text: "Avatares digitais, apresentados como gêmeos online do próprio candidato.",
      },
      {
        icon: "badge",
        text: "Vídeos faceless de alta retenção.",
      },
      {
        icon: "clapper",
        text: "Avatar caricato do candidato para posicionamentos mais leves e bem-humorados.",
      },
    ],
    learnMoreHref: "/ecossistema/criativo",
  },
  {
    id: "auditor",
    number: "4",
    name: "Auditor",
    title: "Conteúdo Checado e Verificado",
    description:
      "A trava de qualidade e blindagem reputacional. Realiza o cruzamento de fontes de informação; nada é publicado sem checagem cruzada e detecção de divergências.",
    accent: "auditor",
    inputs: [
      {
        icon: "file",
        text: "Roteiros e dados brutos gerados pela esteira de produção do Criativo.",
      },
      {
        icon: "shield",
        text: "APIs de checagem nacionais, como Agência Lupa e PolitiFact.",
      },
      {
        icon: "globe",
        text: "Resultados do Google e triangulação de portais de referência.",
      },
    ],
    outputs: [
      {
        icon: "gavel",
        text: "Redução drástica do risco jurídico e processual associado à desinformação.",
      },
      {
        icon: "shield",
        text: "Blindagem ativa contra armadilhas e ataques reputacionais sobre o conteúdo gerado.",
      },
      {
        icon: "file",
        text: "Conformidade documentada e demonstrável, com fonte aprovadora, data e horário.",
      },
    ],
    learnMoreHref: "/ecossistema/auditor",
  },
  {
    id: "distribuidor",
    number: "5",
    name: "Distribuidor",
    title: "Publicação e Multicanalidade",
    description:
      "Onipresença orquestrada. Publicação simultânea nas sete principais redes sociais, mantendo a mesma narrativa.",
    accent: "distribuidor",
    inputs: [
      {
        icon: "badge",
        text: "Pacote de conteúdo 100% checado e aprovado pela auditoria da IA.",
      },
      {
        icon: "gavel",
        text: "Aprovação estratégica final, Go/No-go, da equipe de comunicação.",
      },
      {
        icon: "clock",
        text: "Calendário de agendamento, com datas e janelas de horário.",
      },
    ],
    outputs: [
      {
        icon: "feed",
        text: "Formato nativo para cada rede.",
      },
      {
        icon: "share",
        text: "Alcance orgânico nas sete principais redes sociais: Instagram, LinkedIn, TikTok, Threads, YouTube, Facebook e X.",
      },
      {
        icon: "clock",
        text: "Publicação na janela de horário escolhida.",
      },
    ],
    learnMoreHref: "/ecossistema/distribuidor",
  },
];
