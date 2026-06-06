export const contentStatuses = ["rascunho", "revisado", "aprovado"] as const;
export type ContentStatus = (typeof contentStatuses)[number];

export const llmProviders = ["openai", "anthropic", "fallback-local"] as const;
export type LlmProvider = (typeof llmProviders)[number];

export const productFeedbackClassifications = [
  "bug",
  "melhoria",
  "fora_do_escopo_atual",
] as const;
export type ProductFeedbackClassification =
  (typeof productFeedbackClassifications)[number];

export const productFeedbackCriticalities = [
  "alta",
  "media",
  "baixa",
] as const;
export type ProductFeedbackCriticality =
  (typeof productFeedbackCriticalities)[number];

export const trainingAssetStatuses = [
  "uploaded",
  "processing",
  "trained",
  "failed",
] as const;
export type TrainingAssetStatus = (typeof trainingAssetStatuses)[number];

export const trainingAssetSourceTypes = ["upload", "youtube"] as const;
export type TrainingAssetSourceType = (typeof trainingAssetSourceTypes)[number];

export const trainingAssetRoles = [
  "avatar_image",
  "avatar_caricature",
  "voice_audio",
  "consent",
  "dataset",
] as const;
export type TrainingAssetRole = (typeof trainingAssetRoles)[number];

export const trainingStorageProviders = ["supabase", "local"] as const;
export type TrainingStorageProvider = (typeof trainingStorageProviders)[number];

export const avatarTrainingStatuses = [
  "NOT_TRAINED",
  "TRAINING",
  "TRAINING_FAILED",
  "IDLE",
  "REFUSED",
] as const;
export type AvatarTrainingStatus = (typeof avatarTrainingStatuses)[number];

export const avatarVideoGenerationStatuses = [
  "IDLE",
  "GENERATING_AUDIO",
  "GENERATING_VIDEO",
  "DONE",
  "FAILED",
] as const;
export type AvatarVideoGenerationStatus =
  (typeof avatarVideoGenerationStatuses)[number];

export const contentFormats = [
  "Post Instagram",
  "Legenda Instagram",
  "Roteiro Reels",
  "Tweet/X",
  "Resposta Rapida",
  "Audio WhatsApp",
  "Discurso Curto",
] as const;
export type ContentFormat = (typeof contentFormats)[number];

export const intensityLevels = ["Cautelosa", "Firme", "Confrontadora"] as const;
export type IntensityLevel = (typeof intensityLevels)[number];

export const evaluationRunModes = ["judge", "shadow", "manual"] as const;
export type EvaluationRunMode = (typeof evaluationRunModes)[number];

export const evaluationRunStatuses = [
  "pending",
  "completed",
  "failed",
] as const;
export type EvaluationRunStatus = (typeof evaluationRunStatuses)[number];

export const evaluationCandidateRoles = ["primary", "shadow"] as const;
export type EvaluationCandidateRole = (typeof evaluationCandidateRoles)[number];

export const evaluationCandidateStatuses = [
  "completed",
  "failed",
] as const;
export type EvaluationCandidateStatus =
  (typeof evaluationCandidateStatuses)[number];

export const evaluationCriteria = [
  "aderencia_perfil_politico",
  "adequacao_cargo_cidade_base",
  "respeito_redlines",
  "aderencia_objetivo_cta",
  "uso_keyfacts",
  "adequacao_formato_intensidade",
  "clareza_utilidade_politica",
  "overall",
] as const;
export type EvaluationCriterion = (typeof evaluationCriteria)[number];

export type PromptTemplateMetadata = {
  templateId: string;
  promptVersion: string;
  preview: string;
};

export type SocialHandle = {
  network: string;
  handle: string;
};

export type GeneratedContentVariant = {
  title: string;
  angle: string;
  body: string;
};

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type LlmExecutionResult = {
  rawText: string | null;
  provider: LlmProvider | null;
  model: string | null;
  latencyMs: number | null;
  tokenUsage: TokenUsage | null;
};

export type PoliticianProfile = {
  id: string;
  fullName: string;
  role: string;
  city: string;
  state: string;
  audience: string;
  spectrum: string;
  archetype: string;
  voiceTones: string[];
  keyIssues: string[];
  slogans: string[];
  redLines: string[];
  referenceExamples: string[];
  bio: string;
  personaArchetypes: string[];
  sentinelThemes: string[];
  oppositionThemes: string[];
  customRadarThemes: string[];
  interestProfiles: SocialHandle[];
  interestSites: string[];
  oppositionProfiles: SocialHandle[];
  oppositionSites: string[];
  glossaryTerms: string[];
  trainingReferenceLinks: string[];
  youtubeVideoUrl: string;
  avatarType: string;
  avatarVideoTopic: string;
  argilAvatarId: string;
  argilVoiceId: string;
  avatarTrainingStatus: AvatarTrainingStatus | "";
  notificationEmail: string;
  avatarEmotions: string[];
  voicePace: string;
  editingStyles: string[];
  factCheckingSources: string[];
  hardDataSources: string[];
  distributionChannels: string[];
  distributionWindows: string[];
  autoPublish: boolean;
  updatedAt: string;
};

export type ContentRequest = {
  id: string;
  topic: string;
  objective: string;
  format: ContentFormat;
  intensity: IntensityLevel;
  context: string;
  keyFacts: string[];
  desiredCallToAction: string;
  mandatoryTerms: string[];
  createdAt: string;
};

export type GeneratedContent = {
  id: string;
  contentRequestId: string;
  title: string;
  angle: string;
  body: string;
  status: ContentStatus;
  promptPreview: string;
  provider: string;
  createdAt: string;
  updatedAt: string;
};

export type ContentFeedback = {
  id: string;
  generatedContentId: string;
  note: string;
  createdAt: string;
};

export type ProductFeedback = {
  id: string;
  screen: string;
  workedWell: string;
  issueObserved: string;
  classification: ProductFeedbackClassification;
  criticality: ProductFeedbackCriticality;
  rationale: string;
  scopeAssessment: string;
  suggestedAction: string;
  implementationPrompt: string;
  provider: string;
  createdAt: string;
};

export type ProfileAvatarTraining = {
  id: string;
  profileId: string | null;
  draftProfileId: string | null;
  argilAvatarId: string | null;
  argilVoiceId: string | null;
  status: AvatarTrainingStatus;
  dryRun: boolean;
  datasetAssetId: string | null;
  /** @deprecated Legado (video de consentimento). Use voiceAudioAssetId. */
  consentAssetId: string | null;
  voiceAudioAssetId: string | null;
  avatarName: string;
  errorMessage: string;
  createdAt: string;
  updatedAt: string;
};

export const creativeProjectStatuses = [
  "draft",
  "generating",
  "ready",
  "failed",
] as const;
export type CreativeProjectStatus = (typeof creativeProjectStatuses)[number];

export type CreativeProject = {
  id: string;
  profileId: string | null;
  topic: string;
  personaArchetypes: string[];
  voiceTones: string[];
  scriptDraft: string;
  scriptApproved: boolean;
  freePrompt: string;
  useFreePrompt: boolean;
  avatarTrack: "realistic" | "caricature";
  caricatureAssetId: string;
  heygenVideoId: string | null;
  videoUrl: string;
  captionUrl: string;
  status: CreativeProjectStatus;
  errorMessage: string;
  createdAt: string;
  updatedAt: string;
};

export type AvatarVideoGeneration = {
  id: string;
  profileId: string | null;
  topic: string;
  transcript: string;
  name: string;
  argilVideoId: string | null;
  status: AvatarVideoGenerationStatus;
  dryRun: boolean;
  previewUrl: string;
  videoUrl: string;
  videoUrlSubtitled: string;
  errorMessage: string;
  createdAt: string;
  updatedAt: string;
};

export type ProfileTrainingAsset = {
  id: string;
  profileId: string | null;
  draftProfileId: string | null;
  sourceType: TrainingAssetSourceType;
  trainingRole: TrainingAssetRole;
  storageProvider: TrainingStorageProvider;
  storageBucket: string | null;
  storagePath: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  status: TrainingAssetStatus;
  errorMessage: string;
  createdAt: string;
  updatedAt: string;
};

export type EvaluationRun = {
  id: string;
  contentRequestId: string | null;
  profileId: string | null;
  mode: EvaluationRunMode;
  status: EvaluationRunStatus;
  primaryProvider: string;
  primaryModel: string;
  judgeProvider: string;
  judgeModel: string;
  winnerCandidateId: string | null;
  winnerRecommendation: string;
  judgeSummary: string;
  errorMessage: string;
  createdAt: string;
  updatedAt: string;
};

export type EvaluationCandidate = {
  id: string;
  evaluationRunId: string;
  contentRequestId: string | null;
  generatedContentIds: string[];
  role: EvaluationCandidateRole;
  provider: string;
  model: string;
  promptVersion: string;
  templateId: string;
  latencyMs: number;
  promptPreview: string;
  rawResponse: string;
  tokenUsage: TokenUsage | null;
  outputVariants: GeneratedContentVariant[];
  status: EvaluationCandidateStatus;
  createdAt: string;
};

export type EvaluationScore = {
  id: string;
  evaluationRunId: string;
  candidateId: string;
  criterion: EvaluationCriterion;
  score: number;
  rationale: string;
  verdict: string;
  createdAt: string;
};

export type EvaluationReport = {
  run: EvaluationRun;
  candidates: Array<
    EvaluationCandidate & {
      scores: EvaluationScore[];
      totalScore: number;
    }
  >;
  winner:
    | (EvaluationCandidate & {
        scores: EvaluationScore[];
        totalScore: number;
      })
    | null;
};

export type AppDatabase = {
  profile: PoliticianProfile | null;
  trainingAssets: ProfileTrainingAsset[];
  contentRequests: ContentRequest[];
  generatedContents: GeneratedContent[];
  feedback: ContentFeedback[];
  productFeedbacks: ProductFeedback[];
  evaluationRuns: EvaluationRun[];
  evaluationCandidates: EvaluationCandidate[];
  evaluationScores: EvaluationScore[];
};

export type DashboardData = AppDatabase;
