/** Schemas zod compartilhados pelas rotas de `/api/admin/marketing`. */

import { z } from "zod";

import { CAMPAIGN_CHANNELS, CONTACT_SOURCES } from "@/lib/outbound/types";

export const segmentFilterSchema = z.object({
  sources: z.array(z.enum(CONTACT_SOURCES)).default([]),
  ufs: z.array(z.string().length(2)).default([]),
  parties: z.array(z.string().min(1).max(40)).default([]),
  channel: z.enum(CAMPAIGN_CHANNELS).nullable().default(null),
  onlyCandidates2026: z.boolean().default(false),
  excludeSuspended: z.boolean().default(true),
  search: z.string().max(120).default(""),
});

export const campaignInputSchema = z.object({
  name: z.string().min(2).max(120),
  channel: z.enum(CAMPAIGN_CHANNELS),
  segmentId: z.string().min(1),
  subject: z.string().max(200).optional(),
  body: z.string().max(20000).optional(),
  templateName: z.string().max(120).optional(),
});

export const campaignPatchSchema = campaignInputSchema.partial();
