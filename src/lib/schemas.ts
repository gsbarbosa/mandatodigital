import { z } from "zod";

import {
  contentFormats,
  contentStatuses,
  intensityLevels,
  productFeedbackClassifications,
  productFeedbackCriticalities,
  type ContentFormat,
  type ContentStatus,
  type IntensityLevel,
  type ProductFeedbackClassification,
  type ProductFeedbackCriticality,
} from "@/lib/types";

const requiredStringList = z.array(z.string().trim().min(1)).min(1);
const optionalStringList = z.array(z.string().trim().min(1)).default([]);

export const profileInputSchema = z.object({
  id: z.string().optional(),
  fullName: z.string().trim().min(3),
  role: z.string().trim().min(2),
  city: z.string().trim().min(2),
  state: z.string().trim().min(2).max(2),
  audience: z.string().trim().min(3),
  spectrum: z.string().trim().min(3),
  archetype: z.string().trim().min(3),
  voiceTones: z.array(z.string().trim().min(2)).min(1).max(3),
  keyIssues: requiredStringList,
  slogans: optionalStringList,
  redLines: optionalStringList,
  referenceExamples: optionalStringList,
  bio: z.string().trim().min(20),
});

export const contentRequestInputSchema = z.object({
  topic: z.string().trim().min(5),
  objective: z.string().trim().min(5),
  format: z.enum(contentFormats),
  intensity: z.enum(intensityLevels),
  context: z.string().trim().default(""),
  keyFacts: optionalStringList,
  desiredCallToAction: z.string().trim().default(""),
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

export type ProfileInput = z.infer<typeof profileInputSchema>;
export type ContentRequestInput = z.infer<typeof contentRequestInputSchema>;
export type GeneratedContentUpdateInput = z.infer<typeof generatedContentUpdateSchema>;
export type FeedbackInput = z.infer<typeof feedbackInputSchema>;
export type ProductFeedbackInput = z.infer<typeof productFeedbackInputSchema>;
export type ProductFeedbackAnalysis = z.infer<
  typeof productFeedbackAnalysisSchema
>;

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
