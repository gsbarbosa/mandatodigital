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
  asyncJobs: "asyncJobs",
  auditLog: "auditLog",
  contractAcceptances: "contractAcceptances",
  /** Cadastro real do usuário (doc id = ownerUserId). */
  userRegistrations: "userRegistrations",
  /** Créditos vitalícios da versão convidado (doc id = ownerUserId). */
  guestCredits: "guestCredits",
  /** Tasks do roadmap no painel de gestão (compartilhado). */
  adminRoadmapTasks: "adminRoadmapTasks",
  /** Legado — lido só para migração soft; não gravar mais. */
  earlyAccessReservations: "earlyAccessReservations",
} as const;

export type AppCollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

export const APP_COLLECTION_NAMES: AppCollectionName[] = Object.values(COLLECTIONS);

export function col(name: AppCollectionName) {
  return getFirestore().collection(name);
}
