import type { AgentAccent } from "@/lib/marketing/shared";

export const homeHero = {
  title: "A Tropa de Inteligência Artificial para sua (re)eleição.",
  body: "Um ecossistema completo para monitorar, produzir, auditar e publicar a sua comunicação em ritmo industrial, preservando a sua personalidade e ideologia.",
} as const;

export const homeFactToFeed = {
  title: "Do Fato ao Feed em 15 Minutos",
  body: "Postagens da sua identidade política, nos temas da sua campanha, em grande escala. Aproveite a janela curta entre o fato e a saturação do tema.",
  start: { time: "10:00", label: "Fato relevante" },
  middle: "Ecossistema de agentes de IA",
  end: { time: "10:15", label: "Resposta no feed" },
  networks: ["Instagram", "TikTok", "YouTube", "X", "LinkedIn", "Facebook", "Threads"] as const,
} as const;

export const homeAssembly = {
  title: "Linha de montagem autônoma de propaganda contextual",
  body: "Cada ciclo nasce de um gatilho real do noticiário, atravessa quatro estações operadas por agentes de IA e termina em publicação multiplataforma — sem perder tom, sem inventar dado, sem furar a estratégia. O resultado é um fluxo contínuo de conteúdo contextual, sempre alinhado ao timing da pauta pública.",
  steps: [
    {
      accent: "sentinela" as AgentAccent,
      stage: "Ignição",
      agent: "Agente Sentinela",
      description:
        "Monitoramento 24/7 de tendências e gatilhos midiáticos. Captura a temperatura das redes antes do tema virar manchete consolidada.",
    },
    {
      accent: "curador" as AgentAccent,
      stage: "Viés",
      agent: "Agente Curador",
      description:
        "Aplica o posicionamento ideológico e preserva a personalidade do parlamentar em cada roteiro produzido.",
    },
    {
      accent: "criativo" as AgentAccent,
      stage: "Produção",
      agent: "Agente Criativo",
      description:
        "Geração de scripts virais, edição de alta retenção, captions e avatares digitais para produção contínua.",
    },
    {
      accent: "distribuidor" as AgentAccent,
      stage: "Escala",
      agent: "Agente Distribuidor",
      description:
        "Publicação coordenada e simultânea. Transforma o conteúdo em onipresença digital multiplataforma.",
    },
  ],
  footer:
    "A linha de montagem tem uma trava de qualidade e blindagem reputacional. Nada é publicado sem checagem cruzada.",
  note: "O ecossistema completo possui cinco agentes, incluindo o Auditor entre Criativo e Distribuidor.",
} as const;

export const homeScale = {
  title: "Replique a sua identidade em escala industrial",
  pillars: [
    {
      title: "Eficiência de Equipe",
      body: "Substitui o esforço de dezenas de especialistas em um único stack de IA.",
    },
    {
      title: "Volume Massivo",
      body: "Da ignição à publicação, a linha de montagem entrega múltiplas peças por dia.",
    },
    {
      title: "Identidade Preservada",
      body: "O Curador trava voz, ideologia e estilo. Cada peça soa como o parlamentar.",
    },
  ],
} as const;

export const homeVacuum = {
  title: "O vácuo informacional é fatal.",
  body: "A campanha tradicional é lenta demais para a velocidade digital. O ritmo das redes sociais exige uma taxa de produção que esgota rapidamente qualquer equipe humana — por mais talentosa que seja.",
  points: [
    {
      title: "Volume ganha",
      body: "Quem produz mais peças por dia ocupa mais espaço cognitivo do eleitor.",
    },
    {
      title: "Velocidade domina",
      body: "O primeiro a publicar molda o enquadramento — os demais respondem dentro dele.",
    },
    {
      title: "Feed vence",
      body: "A briga real não é mais no plenário ou no jornal: é dentro do feed do eleitor.",
    },
  ],
} as const;

export const homeWhy = {
  title: "Por que o Mandato Digital?",
  benefits: [
    {
      title: "Ganhos de Escala",
      body: "Volume industrial de conteúdo sem perder a qualidade editorial. Padrão de produção de uma grande agência, gerido por uma equipe enxuta e focada na estratégia.",
    },
    {
      title: "Operação 24/7",
      body: "O ecossistema não dorme. Varre as redes sociais, monitora portais e produz conteúdo mesmo quando o parlamentar está em sessão no plenário ou em viagens, sem interrupções.",
    },
    {
      title: "Qualidade Inegociável",
      body: "Zero risco de “soar como ChatGPT”. A IA é treinada para mimetizar sua voz, sotaque e expressões, garantindo peças de alta retenção visual e narrativa estruturada.",
    },
  ],
} as const;

export const homeEcosystemSummary = {
  title: "O Ecossistema de IA Eleitoral",
  subtitle: "Agentes especialistas trabalhando em sinergia, 24 horas por dia.",
  agents: [
    "Sentinela: monitora conteúdos e tendências.",
    "Curador: adota a persona política e orienta narrativas.",
    "Criativo: cria posts que engajam com as tendências.",
    "Auditor: revisa, verifica fontes e garante qualidade.",
    "Distribuidor: publica nas redes sociais na hora certa.",
  ],
  ctaLabel: "Conheça a solução",
} as const;
