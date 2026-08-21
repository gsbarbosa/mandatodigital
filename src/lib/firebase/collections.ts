import { getFirestore } from "@/lib/firebase/admin";

/** Nomes canônicos das collections (Firestore). */
export const COLLECTIONS = {
  politicianProfiles: "politicianProfiles",
  mandateWorkflowConfigs: "mandateWorkflowConfigs",
  contentRequests: "contentRequests",
  generatedContents: "generatedContents",
  contentFeedback: "contentFeedback",
  profileTrainingAssets: "profileTrainingAssets",
  creativeProjects: "creativeProjects",
  evaluationRuns: "evaluationRuns",
  evaluationCandidates: "evaluationCandidates",
  evaluationScores: "evaluationScores",
  sentinelSuggestionCache: "sentinelSuggestionCache",
  sentinelSignals: "sentinelSignals",
  sentinelThemeExpansions: "sentinelThemeExpansions",
  sentinelArticleThemeVerdicts: "sentinelArticleThemeVerdicts",
  sentinelFactChecks: "sentinelFactChecks",
  /** Cache diário da tela Notícias do Dia (doc id = profileId). Isolado do Sentinela. */
  noticiasDoDiaCache: "noticiasDoDiaCache",
  /**
   * Radar de Bairro (doc id = profileId): localidades cadastradas + grupo de
   * Facebook verificado de cada uma. Isolado do Sentinela e da Notícias do Dia.
   */
  radarBairroRegistry: "radarBairroRegistry",
  /** Última coleta do Radar de Bairro (doc id = profileId). */
  radarBairroCache: "radarBairroCache",
  asyncJobs: "asyncJobs",
  /** MP3 TTS temporário aguardando render HeyGen (doc id = heygenVideoId). */
  ttsAudioPending: "ttsAudioPending",
  /** Seleção de voz ElevenLabs + prévias TTS (doc id = profileId). */
  profileVoiceSelections: "profileVoiceSelections",
  /** Contas sociais conectadas (Instagram Graph) por perfil político. */
  socialConnections: "socialConnections",
  /** Pacotes de publicação do Distribuidor. */
  distributionPosts: "distributionPosts",
  /** Trilha append-only de ações do Distribuidor. */
  distributionAuditLog: "distributionAuditLog",
  auditLog: "auditLog",
  contractAcceptances: "contractAcceptances",
  /** Cadastro real do usuário (doc id = ownerUserId). */
  userRegistrations: "userRegistrations",
  /** Créditos vitalícios da versão convidado (doc id = ownerUserId). */
  guestCredits: "guestCredits",
  /** Eventos de webhook Asaas já processados (idempotência; doc id = event id). */
  billingWebhookEvents: "billingWebhookEvents",
  /** Tasks do roadmap no painel de gestão (compartilhado). */
  adminRoadmapTasks: "adminRoadmapTasks",
  /** Overrides de API keys de provedores (criptografados; só Admin SDK). */
  adminProviderSecrets: "adminProviderSecrets",
  /** Threads de suporte N1/N2 (subcollection messages). */
  supportThreads: "supportThreads",
  /** Casos resolvidos para RAG do suporte (embeddings OpenAI). */
  supportLearningItems: "supportLearningItems",
  /**
   * Base de candidaturas TSE 2026 para prefill do cadastro (doc id = CPF).
   * Dado de referência, não do usuário: populado por scripts/seed-tse-candidates.ts
   * e de propósito fora do `db:reset`.
   */
  tseCandidates2026: "tseCandidates2026",
  /**
   * Contatos do outbound. Só entra quem já foi disparado (ou opt-out).
   * Lista de trabalho fica no CSV até o envio. Ver docs/marketing-outbound.md.
   */
  marketingContacts: "marketingContacts",
  /** Segmentos de público salvos no painel de marketing. */
  marketingSegments: "marketingSegments",
  /** Campanhas de e-mail/WhatsApp do painel de marketing. */
  marketingCampaigns: "marketingCampaigns",
  /** Registro por contato de cada disparo (trilha de acompanhamento). */
  marketingSends: "marketingSends",
  /** Threads de conversa do WhatsApp (doc id = telefone E.164). */
  marketingConversations: "marketingConversations",
  /** Legado — lido só para migração soft; não gravar mais. */
  earlyAccessReservations: "earlyAccessReservations",
} as const;

export type AppCollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

export const APP_COLLECTION_NAMES: AppCollectionName[] = Object.values(COLLECTIONS);

export function col(name: AppCollectionName) {
  return getFirestore().collection(name);
}
