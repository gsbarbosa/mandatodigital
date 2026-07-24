export const distribuidorDetail = {
  badge: "5. Agente Distribuidor",
  titleLead: "Multicanalidade:",
  titleAccent: "O Impacto Real",
  metrics: [
    { value: "07", label: "Redes sincronizadas" },
    { value: "17s", label: "Atraso médio de disparo" },
  ],
  stories: [
    {
      title: "O Desafio do Mandato",
      body: "Campanhas exigem respostas rápidas e presença simultânea em várias plataformas. O processo manual de publicação rede por rede gera atraso de horas e faz perder a janela entre o fato e a saturação do tema.",
    },
    {
      title: "A Ativação da IA",
      body: "O Distribuidor usa APIs especializadas para disparo coordenado de conteúdos formatados nativamente para cada rede — Instagram, LinkedIn, Facebook, Threads, TikTok, YouTube e X — com presença sem falhas.",
    },
  ],
  painel: {
    title: "Painel de Distribuição:",
    titleAccent: "Disparo Coordenado",
    slots: [
      { time: "07:00", reach: "+ 324K Alcance" },
      { time: "12:00", reach: "+ 612K Alcance" },
      { time: "15:00", reach: "+ 94K Alcance" },
      { time: "18:00", reach: "+ 187K Alcance" },
    ],
    networks: ["Instagram", "TikTok", "YouTube", "X", "LinkedIn", "Facebook", "Threads"] as const,
    status: "Status: 7 redes ativas • Alcance acumulado: 1,4M",
  },
} as const;
