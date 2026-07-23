export const SUPPORT_THREAD_STATUSES = [
  "ai",
  "waiting_human",
  "human",
  "closed",
] as const;

export type SupportThreadStatus = (typeof SUPPORT_THREAD_STATUSES)[number];

export const SUPPORT_MESSAGE_ROLES = [
  "user",
  "assistant",
  "human",
  "system",
] as const;

export type SupportMessageRole = (typeof SUPPORT_MESSAGE_ROLES)[number];

export const SUPPORT_ESCALATION_REASONS = ["ai", "user"] as const;

export type SupportEscalationReason =
  (typeof SUPPORT_ESCALATION_REASONS)[number];

export type SupportThread = {
  id: string;
  ownerUserId: string;
  userEmail: string;
  status: SupportThreadStatus;
  escalationReason: SupportEscalationReason | null;
  escalationSummary: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  lastMessagePreview: string;
};

export type SupportMessage = {
  id: string;
  role: SupportMessageRole;
  body: string;
  createdAt: string;
  authorLabel: string;
};

export type SupportThreadWithMessages = SupportThread & {
  messages: SupportMessage[];
};

export const OPEN_SUPPORT_STATUSES: SupportThreadStatus[] = [
  "ai",
  "waiting_human",
  "human",
];

export const HUMAN_QUEUE_STATUSES: SupportThreadStatus[] = [
  "waiting_human",
  "human",
];
