/** Exports seguros para Client Components (sem firebase-admin). */
export type {
  AuditAction,
  AuditAgentsSummary,
  AuditAccessSummary,
  AuditEvent,
  AuditLogListItem,
  AuditSummary,
  AuditVolumesSummary,
} from "@/lib/audit/types";
export { AUDIT_ACTIONS, AUDIT_TIMEZONE, isAuditAction } from "@/lib/audit/types";
export {
  auditActionLabel,
  AUDIT_ACTION_LABELS,
  auditDayKey,
  formatAuditTimestampLocal,
} from "@/lib/audit/format";
