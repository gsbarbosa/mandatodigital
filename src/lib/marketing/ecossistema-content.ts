import type { AgentAccent } from "@/lib/marketing/shared";

export type EcosystemAgent = {
  id: string;
  number: string;
  name: string;
  title: string;
  description: string;
  accent: AgentAccent;
  inputs: string[];
  outputs: string[];
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
      "Sites, blogs e portais oficiais indicados para monitoramento contínuo.",
      "Perfis de interesse, adversários e influentes, em YouTube, Instagram, X e TikTok.",
      "Temas de interesse da campanha, como minorias, saúde, agro e infraestrutura.",
    ],
    outputs: [
      "Pautas quentes do dia sobre temas de interesse.",
      "Pautas quentes do dia sobre adversários.",
      "Ranking de oportunidades definidas e encaminhadas para produção pelo Agente Criativo.",
    ],
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
      "Vídeos de referência com discursos e falas indicados pelo próprio parlamentar.",
      "Arquétipos de persona política, como empático ou inovador, e tom de linguagem, como agressivo ou calmo.",
      "Glossário estratégico de expressões pessoais.",
    ],
    outputs: [
      "Zero risco de a peça ou post soar como IA ou robótica.",
      "Coerência absoluta entre o posicionamento do parlamentar e o conteúdo publicado.",
      "Identidade política e ideológica preservada.",
    ],
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
      "Pautas quentes priorizadas e validadas estrategicamente pelo Sentinela.",
      "Persona, posicionamento, vídeos do político e vocabulário estabelecidos pelo Curador.",
      "Solicitação do usuário, por meio do link de uma matéria, para produção de conteúdo específico.",
    ],
    outputs: [
      "Roteiros, scripts de fala e captions persuasivas.",
      "Avatares digitais, apresentados como gêmeos online do próprio candidato.",
      "Vídeos faceless de alta retenção.",
      "Avatar caricato do candidato para posicionamentos mais leves e bem-humorados.",
    ],
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
      "Roteiros e dados brutos gerados pela esteira de produção do Criativo.",
      "APIs de checagem nacionais, como Agência Lupa e PolitiFact.",
      "Resultados do Google e triangulação de portais de referência.",
    ],
    outputs: [
      "Redução drástica do risco jurídico e processual associado à desinformação.",
      "Blindagem ativa contra armadilhas e ataques reputacionais sobre o conteúdo gerado.",
      "Conformidade documentada e demonstrável, com fonte aprovadora, data e horário.",
    ],
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
      "Pacote de conteúdo 100% checado e aprovado pela auditoria da IA.",
      "Aprovação estratégica final, Go/No-go, da equipe de comunicação.",
      "Calendário de agendamento, com datas e janelas de horário.",
    ],
    outputs: [
      "Formato nativo para cada rede.",
      "Alcance orgânico nas sete principais redes sociais: Instagram, LinkedIn, TikTok, Threads, YouTube, Facebook e X.",
      "Publicação na janela de horário escolhida.",
    ],
  },
];
