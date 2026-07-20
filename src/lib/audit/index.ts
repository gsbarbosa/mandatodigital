/**
 * Barrel server-side. Em Client Components use `@/lib/audit/client`.
 * Importar este modulo no browser puxa firebase-admin.
 */
export type { AuditAction, AuditEvent, AuditSummary } from "@/lib/audit/types";
export { AUDIT_ACTIONS, AUDIT_TIMEZONE, isAuditAction } from "@/lib/audit/types";
export {
  auditActionLabel,
  AUDIT_ACTION_LABELS,
  auditDayKey,
  formatAuditTimestampLocal,
} from "@/lib/audit/format";
export {
  buildAuditEvent,
  recordAuditEvent,
  recordAuditEventFireAndForget,
} from "@/lib/audit/record";
export {
  buildAccessSummary,
  buildAgentsSummaryFromJobs,
  buildAuditSummary,
  buildVolumesFromAudit,
  countEventsByDay,
  listAuditLogsForOwner,
} from "@/lib/audit/query";
