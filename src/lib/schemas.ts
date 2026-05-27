import { z } from "zod";

import {
  avatarTrainingStatuses,
  contentFormats,
  contentStatuses,
  evaluationCandidateRoles,
  evaluationCandidateStatuses,
  evaluationCriteria,
  evaluationRunModes,
  evaluationRunStatuses,
  intensityLevels,
  llmProviders,
  productFeedbackClassifications,
  productFeedbackCriticalities,
  trainingAssetRoles,
  trainingAssetSourceTypes,
  trainingAssetStatuses,
  trainingStorageProviders,
  type ContentFormat,
  type ContentStatus,
  type EvaluationCandidateRole,
  type EvaluationCandidateStatus,
  type EvaluationCriterion,
  type EvaluationRunMode,
  type EvaluationRunStatus,
  type IntensityLevel,
  type LlmProvider,
  type ProductFeedbackClassification,
  type ProductFeedbackCriticality,
  type TrainingAssetSourceType,
  type TrainingAssetStatus,
  type TrainingAssetRole,
  type TrainingStorageProvider,
} from "@/lib/types";

const requiredStringList = z.array(z.string().trim().min(1)).min(1);
const optionalStringList = z.array(z.string().trim().min(1)).default([]);
const limitedOptionalStringList = (maxItems: number) =>
  z.array(z.string().trim().min(1)).max(maxItems).default([]);
const socialHandleSchema = z.object({
  network: z.string().trim().min(2),
  handle: z.string().trim().min(2),
});

export const profileInputSchema = z.object({
  id: z.string().optional(),
  fullName: z.string().trim().min(3),
  role: z.string().trim().min(2),
  city: z.string().trim().min(2),
  state: z.string().trim().min(2).max(2),
  audience: z.string().trim().min(3),
  spectrum: z.string().trim().min(3),
  archetype: z.string().trim().min(3),
  voiceTones: z.array(z.string().trim().min(2)).default([]),
  keyIssues: requiredStringList,
  slogans: optionalStringList,
  redLines: optionalStringList,
  referenceExamples: optionalStringList,
  bio: z.string().trim().min(20),
  personaArchetypes: optionalStringList,
  sentinelThemes: optionalStringList,
  oppositionThemes: optionalStringList,
  customRadarThemes: z.array(z.string().trim().max(60)).max(3).default([]),
  interestProfiles: z.array(socialHandleSchema).max(10).default([]),
  interestSites: limitedOptionalStringList(10),
  oppositionProfiles: z.array(socialHandleSchema).max(10).default([]),
  oppositionSites: limitedOptionalStringList(10),
  glossaryTerms: optionalStringList,
  trainingReferenceLinks: limitedOptionalStringList(5),
  youtubeVideoUrl: z.string().trim().url().or(z.literal("")).default(""),
  avatarType: z.string().trim().default(""),
  avatarVideoTopic: z.string().trim().default(""),
  argilAvatarId: z.string().trim().default(""),
  argilVoiceId: z.string().trim().default(""),
  avatarTrainingStatus: z
    .enum([...avatarTrainingStatuses, ""])
    .default(""),
  notificationEmail: z.string().trim().email().or(z.literal("")).default(""),
  avatarEmotions: optionalStringList,
  voicePace: z.string().trim().default("Manter velocidade original"),
  editingStyles: optionalStringList,
  factCheckingSources: optionalStringList,
  hardDataSources: optionalStringList,
  distributionChannels: optionalStringList,
  distributionWindows: optionalStringList,
  autoPublish: z.boolean().default(false),
});

export const contentRequestInputSchema = z.object({
  topic: z.string().trim().min(5),
  objective: z.string().trim().min(5),
  format: z.enum(contentFormats),
  intensity: z.enum(intensityLevels),
  context: z.string().trim().default(""),
  keyFacts: optionalStringList,
  desiredCallToAction: z.string().trim().default(""),
  mandatoryTerms: optionalStringList,
});

export const generatedContentUpdateSchema = z.object({
  body: z.string().trim().min(10).optional(),
  status: z.enum(contentStatuses).optional(),
});

export const feedbackInputSchema = z.object({
  note: z.string().trim().min(5),
});

export const productFeedbackInputSchema = z.object({
  screen: z.string().trim().default(""),
  workedWell: z.string().trim().default(""),
  issueObserved: z.string().trim().min(8),
});

export const productFeedbackAnalysisSchema = z.object({
  classification: z.enum(productFeedbackClassifications),
  criticality: z.enum(productFeedbackCriticalities),
  rationale: z.string().trim().min(12),
  scopeAssessment: z.string().trim().min(12),
  suggestedAction: z.string().trim().min(12),
  implementationPrompt: z.string().trim().min(12),
  provider: z.string().trim().min(2).default("fallback-local"),
});

export const tokenUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
});

export const llmExecutionOptionsSchema = z.object({
  provider: z.enum(["openai", "anthropic"]).optional(),
  model: z.string().trim().min(2).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  strict: z.boolean().optional(),
});

export const promptMetadataSchema = z.object({
  templateId: z.string().trim().min(2),
  promptVersion: z.string().trim().min(2),
  preview: z.string().trim().min(12),
});

export const generatedContentVariantSchema = z.object({
  title: z.string().trim().min(3),
  angle: z.string().trim().min(3),
  body: z.string().trim().min(20),
});

export const evaluationScoreSchema = z.object({
  criterion: z.enum(evaluationCriteria),
  score: z.number().min(0).max(10),
  rationale: z.string().trim().min(12),
  verdict: z.string().trim().default(""),
});

export const evaluationJudgeCandidateSchema = z.object({
  candidateKey: z.string().trim().min(2),
  summary: z.string().trim().min(12),
  scores: z.array(evaluationScoreSchema).length(evaluationCriteria.length),
});

export const evaluationJudgeResultSchema = z.object({
  winnerCandidateKey: z.string().trim().min(2),
  winnerRecommendation: z.string().trim().min(12),
  rationale: z.string().trim().min(12),
  candidates: z.array(evaluationJudgeCandidateSchema).min(1),
  provider: z.string().trim().min(2).default("fallback-local"),
});

export const evaluationRunCreateSchema = z.object({
  contentRequestId: z.string().trim().optional().nullable(),
  profileId: z.string().trim().optional().nullable(),
  mode: z.enum(evaluationRunModes).default("shadow"),
  status: z.enum(evaluationRunStatuses).default("pending"),
  primaryProvider: z.string().trim().default(""),
  primaryModel: z.string().trim().default(""),
  judgeProvider: z.string().trim().default(""),
  judgeModel: z.string().trim().default(""),
  winnerCandidateId: z.string().trim().optional().nullable(),
  winnerRecommendation: z.string().trim().default(""),
  judgeSummary: z.string().trim().default(""),
  errorMessage: z.string().trim().default(""),
});

export const evaluationCandidateCreateSchema = z.object({
  evaluationRunId: z.string().trim().min(2),
  contentRequestId: z.string().trim().optional().nullable(),
  generatedContentIds: z.array(z.string().trim().min(2)).default([]),
  role: z.enum(evaluationCandidateRoles),
  provider: z.string().trim().min(2),
  model: z.string().trim().default(""),
  promptVersion: z.string().trim().min(2),
  templateId: z.string().trim().min(2),
  latencyMs: z.number().int().nonnegative().default(0),
  promptPreview: z.string().trim().min(12),
  rawResponse: z.string().default(""),
  tokenUsage: tokenUsageSchema.nullable().default(null),
  outputVariants: z.array(generatedContentVariantSchema).min(1),
  status: z.enum(evaluationCandidateStatuses).default("completed"),
});

export const evaluationRunUpdateSchema = z.object({
  status: z.enum(evaluationRunStatuses),
  winnerCandidateId: z.string().trim().optional().nullable(),
  winnerRecommendation: z.string().trim().optional(),
  judgeSummary: z.string().trim().optional(),
  errorMessage: z.string().trim().optional(),
  judgeProvider: z.string().trim().optional(),
  judgeModel: z.string().trim().optional(),
});

export const evaluationShadowRequestSchema = z.object({
  contentRequestId: z.string().trim().min(2),
  shadowProvider: z.enum(["openai", "anthropic"]).optional(),
  shadowModel: z.string().trim().min(2).optional(),
  judgeProvider: z.enum(["openai", "anthropic"]).optional(),
  judgeModel: z.string().trim().min(2).optional(),
});

export const evaluationJudgeRequestSchema = z.object({
  contentRequestId: z.string().trim().min(2),
  judgeProvider: z.enum(["openai", "anthropic"]).optional(),
  judgeModel: z.string().trim().min(2).optional(),
});

export const trainingAssetCreateSchema = z.object({
  profileId: z.string().trim().optional().nullable(),
  draftProfileId: z.string().trim().optional().nullable(),
  sourceType: z.enum(trainingAssetSourceTypes).default("upload"),
  trainingRole: z.enum(trainingAssetRoles).default("dataset"),
  storageProvider: z.enum(trainingStorageProviders),
  storageBucket: z.string().trim().optional().nullable(),
  storagePath: z.string().trim().min(3),
  originalFilename: z.string().trim().min(1),
  mimeType: z.string().trim().default("application/octet-stream"),
  sizeBytes: z.number().int().nonnegative().default(0),
  status: z.enum(trainingAssetStatuses).default("uploaded"),
  errorMessage: z.string().trim().default(""),
});

export type ProfileInput = z.infer<typeof profileInputSchema>;
export type ContentRequestInput = z.infer<typeof contentRequestInputSchema>;
export type GeneratedContentUpdateInput = z.infer<typeof generatedContentUpdateSchema>;
export type FeedbackInput = z.infer<typeof feedbackInputSchema>;
export type ProductFeedbackInput = z.infer<typeof productFeedbackInputSchema>;
export type ProductFeedbackAnalysis = z.infer<
  typeof productFeedbackAnalysisSchema
>;
export type TokenUsageInput = z.infer<typeof tokenUsageSchema>;
export type LlmExecutionOptionsInput = z.infer<typeof llmExecutionOptionsSchema>;
export type PromptMetadataInput = z.infer<typeof promptMetadataSchema>;
export type GeneratedContentVariantInput = z.infer<
  typeof generatedContentVariantSchema
>;
export type EvaluationScoreInput = z.infer<typeof evaluationScoreSchema>;
export type EvaluationJudgeResult = z.infer<typeof evaluationJudgeResultSchema>;
export type EvaluationRunCreateInput = z.infer<typeof evaluationRunCreateSchema>;
export type EvaluationCandidateCreateInput = z.infer<
  typeof evaluationCandidateCreateSchema
>;
export type EvaluationRunUpdateInput = z.infer<typeof evaluationRunUpdateSchema>;
export type EvaluationShadowRequestInput = z.infer<
  typeof evaluationShadowRequestSchema
>;
export type EvaluationJudgeRequestInput = z.infer<
  typeof evaluationJudgeRequestSchema
>;
export type TrainingAssetCreateInput = z.infer<typeof trainingAssetCreateSchema>;

export function isContentFormat(value: string): value is ContentFormat {
  return (contentFormats as readonly string[]).includes(value);
}

export function isIntensityLevel(value: string): value is IntensityLevel {
  return (intensityLevels as readonly string[]).includes(value);
}

export function isContentStatus(value: string): value is ContentStatus {
  return (contentStatuses as readonly string[]).includes(value);
}

export function isProductFeedbackClassification(
  value: string,
): value is ProductFeedbackClassification {
  return (productFeedbackClassifications as readonly string[]).includes(value);
}

export function isProductFeedbackCriticality(
  value: string,
): value is ProductFeedbackCriticality {
  return (productFeedbackCriticalities as readonly string[]).includes(value);
}

export function isLlmProvider(value: string): value is LlmProvider {
  return (llmProviders as readonly string[]).includes(value);
}

export function isEvaluationRunMode(value: string): value is EvaluationRunMode {
  return (evaluationRunModes as readonly string[]).includes(value);
}

export function isEvaluationRunStatus(
  value: string,
): value is EvaluationRunStatus {
  return (evaluationRunStatuses as readonly string[]).includes(value);
}

export function isEvaluationCandidateRole(
  value: string,
): value is EvaluationCandidateRole {
  return (evaluationCandidateRoles as readonly string[]).includes(value);
}

export function isEvaluationCandidateStatus(
  value: string,
): value is EvaluationCandidateStatus {
  return (evaluationCandidateStatuses as readonly string[]).includes(value);
}

export function isEvaluationCriterion(
  value: string,
): value is EvaluationCriterion {
  return (evaluationCriteria as readonly string[]).includes(value);
}

export function isTrainingAssetStatus(value: string): value is TrainingAssetStatus {
  return (trainingAssetStatuses as readonly string[]).includes(value);
}

export function isTrainingAssetSourceType(
  value: string,
): value is TrainingAssetSourceType {
  return (trainingAssetSourceTypes as readonly string[]).includes(value);
}

export function isTrainingStorageProvider(
  value: string,
): value is TrainingStorageProvider {
  return (trainingStorageProviders as readonly string[]).includes(value);
}
