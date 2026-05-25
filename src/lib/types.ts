export const contentStatuses = ["rascunho", "revisado", "aprovado"] as const;
export type ContentStatus = (typeof contentStatuses)[number];

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

export type AppDatabase = {
  profile: PoliticianProfile | null;
  contentRequests: ContentRequest[];
  generatedContents: GeneratedContent[];
  feedback: ContentFeedback[];
  productFeedbacks: ProductFeedback[];
};

export type DashboardData = AppDatabase;
