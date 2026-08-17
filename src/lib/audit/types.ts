/** Fuso canônico dos logs de auditoria (exibido ao cliente). */
export const AUDIT_TIMEZONE = "America/Sao_Paulo" as const;

export const AUDIT_ACTIONS = [
  "session_login",
  "session_logout",
  "content_generate",
  "creative_project_create",
  "video_generate",
  "client_error",
  "seal_job",
  "voice_job",
  "script_fact_check",
  "fact_check_bypass_free_prompt",
  "contract_acceptance",
  "manual_export",
  "monitoring_view",
  "monitoring_signal_view",
  "monitoring_refresh",
  "monitoring_config_save",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditEvent = {
  id: string;
  ownerUserId: string;
  profileId: string | null;
  projectId: string | null;
  /** Alias tipado; espelha `eventType` para docs novos. */
  action: string;
  /** Mantido por compatibilidade com docs legados. */
  eventType: string;
  ip: string;
  userAgent: string;
  /** ISO UTC. */
  timestamp: string;
  timezone: typeof AUDIT_TIMEZONE;
  /** Data/hora legível em America/Sao_Paulo. */
  timestampLocal: string;
  payload: Record<string, unknown>;
  consentTextVersion: string;
  /** ISO UTC (igual a `timestamp` nos docs novos). */
  createdAt: string;
};

export type AuditLogListItem = AuditEvent;

export type AuditAccessSummary = {
  loginCount: number;
  activeDays: number;
  lastLogin: {
    timestamp: string;
    timestampLocal: string;
    ip: string;
  } | null;
  loginsByDay: Array<{ day: string; count: number }>;
  actionEventsByDay: Array<{ day: string; count: number }>;
};

export type AuditVolumesSummary = {
  contentRequests: number;
  generatedContents: number;
  creativeProjects: number;
  creativeProjectsWithVideo: number;
  contentGenerateEvents: number;
  videoGenerateEvents: number;
};

export type AuditAgentJobBucket = {
  type: string;
  status: string;
  count: number;
  avgLatencyMs: number | null;
};

export type AuditAgentsSummary = {
  jobsTotal: number;
  jobsSucceeded: number;
  jobsFailed: number;
  jobsByTypeStatus: AuditAgentJobBucket[];
  factChecks: number;
  factCheckBypasses: number;
};

export type AuditMonitoringSummary = {
  monitoringDays: number;
  viewEvents: number;
  signalViews: number;
  viewsByDay: Array<{ day: string; count: number }>;
  refreshes: number;
  manualRefreshes: number;
  dailyRefreshes: number;
  configSaves: number;
  lastConfigSave: { timestamp: string; timestampLocal: string } | null;
};

export type AuditSummary = {
  from: string;
  to: string;
  timezone: typeof AUDIT_TIMEZONE;
  access: AuditAccessSummary;
  volumes: AuditVolumesSummary;
  agents: AuditAgentsSummary;
  monitoring: AuditMonitoringSummary;
};

export function isAuditAction(value: string): value is AuditAction {
  return (AUDIT_ACTIONS as readonly string[]).includes(value);
}
