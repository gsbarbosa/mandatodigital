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
      body: "Campanhas exigem respostas rápidas e presença simultânea em várias redes sociais. O processo manual de publicação tem complexidades que potencializam a chance de perder a janela entre o fato e a saturação do tema.",
    },
    {
      title: "A Ativação da IA",
      body: "Cada rede exige um formato, corte e tom próprios — vertical no Instagram, thread no X, tom institucional no LinkedIn. Disparos coordenados de conteúdos formatados nativamente para cada rede (Instagram, LinkedIn, FB, Threads, TikTok, YouTube, X) é a solução definitiva para o timing certo de publicação.",
    },
  ],
  propagation: {
    title: "Um Conteúdo,",
    titleAccent: "Sete Adaptações Nativas",
    lead: "O mesmo roteiro aprovado se propaga pelas redes já ajustado ao formato, ao corte e ao tom que cada uma exige.",
    source: "Roteiro Aprovado: Reforma Tributária — STF",
    networks: [
      { network: "Instagram", format: "Reels vertical, legenda curta" },
      { network: "TikTok", format: "Corte dinâmico, gancho nos 2s" },
      { network: "YouTube", format: "Shorts" },
      { network: "X", format: "Thread de texto, direto ao ponto" },
      { network: "LinkedIn", format: "Post institucional, tom formal" },
      { network: "Facebook", format: "Vídeo nativo, legenda longa" },
      { network: "Threads", format: "Post conversacional, tom leve" },
    ] as const,
  },
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
