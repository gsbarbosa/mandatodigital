import type { DocumentData } from "firebase-admin/firestore";

import { auditDayKey } from "@/lib/audit/format";
import {
  AUDIT_TIMEZONE,
  type AuditAccessSummary,
  type AuditAgentJobBucket,
  type AuditAgentsSummary,
  type AuditEvent,
  type AuditLogListItem,
  type AuditSummary,
  type AuditVolumesSummary,
} from "@/lib/audit/types";
import type { AsyncJobRow } from "@/lib/async-jobs-types";
import { COLLECTIONS, col } from "@/lib/firebase/collections";

function mapAuditDoc(id: string, data: DocumentData): AuditEvent {
  const eventType = String(data.eventType ?? data.action ?? "unknown");
  const action = String(data.action ?? eventType);
  const createdAt = String(data.createdAt ?? data.timestamp ?? new Date().toISOString());
  const timestamp = String(data.timestamp ?? createdAt);
  const payload =
    data.payload && typeof data.payload === "object" && !Array.isArray(data.payload)
      ? (data.payload as Record<string, unknown>)
      : {};

  const ipFromPayload = typeof payload.ip === "string" ? payload.ip : "";
  const uaFromPayload =
    typeof payload.userAgent === "string" ? payload.userAgent : "";

  const ip = String(data.ip ?? "").trim() || ipFromPayload.trim() || "unknown";
  const userAgent =
    String(data.userAgent ?? "").trim() || uaFromPayload.trim() || "unknown";

  return {
    id,
    ownerUserId: String(data.ownerUserId ?? ""),
    profileId:
      data.profileId === null || data.profileId === undefined
        ? null
        : String(data.profileId),
    projectId:
      data.projectId === null || data.projectId === undefined
        ? null
        : String(data.projectId),
    action,
    eventType,
    ip,
    userAgent,
    timestamp,
    timezone: AUDIT_TIMEZONE,
    timestampLocal: String(
      data.timestampLocal ?? `${timestamp} (${AUDIT_TIMEZONE})`,
    ),
    payload,
    consentTextVersion: String(data.consentTextVersion ?? "v1"),
    createdAt,
  };
}

export function countEventsByDay(
  events: Array<{ timestamp?: string; createdAt?: string }>,
): Array<{ day: string; count: number }> {
  const map = new Map<string, number>();
  for (const event of events) {
    const iso = event.timestamp || event.createdAt || "";
    const day = auditDayKey(iso);
    if (!day) {
      continue;
    }
    map.set(day, (map.get(day) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([day, count]) => ({ day, count }))
    .sort((a, b) => a.day.localeCompare(b.day));
}

export function buildAccessSummary(events: AuditEvent[]): AuditAccessSummary {
  const logins = events.filter(
    (event) => event.action === "session_login" || event.eventType === "session_login",
  );
  const loginsByDay = countEventsByDay(logins);
  const actionEventsByDay = countEventsByDay(events);
  const lastLogin = logins[0]
    ? {
        timestamp: logins[0].timestamp,
        timestampLocal: logins[0].timestampLocal,
        ip: logins[0].ip,
      }
    : null;

  return {
    loginCount: logins.length,
    activeDays: loginsByDay.length,
    lastLogin,
    loginsByDay,
    actionEventsByDay,
  };
}

export function buildVolumesFromAudit(events: AuditEvent[]): Pick<
  AuditVolumesSummary,
  "contentGenerateEvents" | "videoGenerateEvents"
> {
  let contentGenerateEvents = 0;
  let videoGenerateEvents = 0;
  for (const event of events) {
    const action = event.action || event.eventType;
    if (action === "content_generate") {
      contentGenerateEvents += 1;
    }
    if (action === "video_generate") {
      videoGenerateEvents += 1;
    }
  }
  return { contentGenerateEvents, videoGenerateEvents };
}

export function buildAgentsSummaryFromJobs(
  jobs: AsyncJobRow[],
  factChecks: number,
  factCheckBypasses: number,
): AuditAgentsSummary {
  const buckets = new Map<string, { count: number; latencySum: number; latencyN: number }>();
  let jobsSucceeded = 0;
  let jobsFailed = 0;

  for (const job of jobs) {
    if (job.status === "succeeded") {
      jobsSucceeded += 1;
    }
    if (job.status === "failed" || job.status === "dead") {
      jobsFailed += 1;
    }

    const key = `${job.type}|${job.status}`;
    const current = buckets.get(key) ?? { count: 0, latencySum: 0, latencyN: 0 };
    current.count += 1;

    if (job.startedAt && job.finishedAt) {
      const started = new Date(job.startedAt).getTime();
      const finished = new Date(job.finishedAt).getTime();
      if (!Number.isNaN(started) && !Number.isNaN(finished) && finished >= started) {
        current.latencySum += finished - started;
        current.latencyN += 1;
      }
    }

    buckets.set(key, current);
  }

  const jobsByTypeStatus: AuditAgentJobBucket[] = [...buckets.entries()]
    .map(([key, value]) => {
      const [type, status] = key.split("|");
      return {
        type,
        status,
        count: value.count,
        avgLatencyMs:
          value.latencyN > 0 ? Math.round(value.latencySum / value.latencyN) : null,
      };
    })
    .sort((a, b) => b.count - a.count);

  return {
    jobsTotal: jobs.length,
    jobsSucceeded,
    jobsFailed,
    jobsByTypeStatus,
    factChecks,
    factCheckBypasses,
  };
}

function inRange(iso: string, fromMs: number, toMs: number) {
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) {
    return false;
  }
  return ms >= fromMs && ms <= toMs;
}

function sortByCreatedAtDesc<T extends { createdAt: string }>(items: T[]) {
  return [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

/**
 * Busca por ownerUserId sem orderBy composto — funciona enquanto o índice
 * (ownerUserId + createdAt) ainda está building. Ordena em memoria.
 */
async function fetchAuditLogsByOwner(ownerUserId: string, max: number) {
  const snap = await col(COLLECTIONS.auditLog)
    .where("ownerUserId", "==", ownerUserId)
    .limit(max)
    .get();

  return sortByCreatedAtDesc(
    snap.docs.map((doc) => mapAuditDoc(doc.id, doc.data())),
  );
}

export async function listAuditLogsForOwner(input: {
  ownerUserId: string;
  limit?: number;
  action?: string | null;
  from?: string | null;
  to?: string | null;
  cursor?: string | null;
}): Promise<{ items: AuditLogListItem[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const fromMs = input.from ? new Date(input.from).getTime() : null;
  const toMs = input.to ? new Date(input.to).getTime() : null;
  const action = input.action?.trim() || null;

  let items = await fetchAuditLogsByOwner(input.ownerUserId, 500);

  if (action) {
    items = items.filter(
      (item) => item.action === action || item.eventType === action,
    );
  }
  if (fromMs != null && !Number.isNaN(fromMs)) {
    items = items.filter((item) => new Date(item.createdAt).getTime() >= fromMs);
  }
  if (toMs != null && !Number.isNaN(toMs)) {
    items = items.filter((item) => new Date(item.createdAt).getTime() <= toMs);
  }

  if (input.cursor?.trim()) {
    const cursorId = input.cursor.trim();
    const cursorIndex = items.findIndex((item) => item.id === cursorId);
    if (cursorIndex >= 0) {
      items = items.slice(cursorIndex + 1);
    }
  }

  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;

  return { items: page, nextCursor };
}

export async function listAuditEventsInRange(input: {
  ownerUserId: string;
  from: string;
  to: string;
  max?: number;
}): Promise<AuditEvent[]> {
  const max = Math.min(input.max ?? 500, 1000);
  const fromMs = new Date(input.from).getTime();
  const toMs = new Date(input.to).getTime();

  const items = await fetchAuditLogsByOwner(input.ownerUserId, max);
  return items.filter((item) => inRange(item.createdAt, fromMs, toMs));
}

export async function listAsyncJobsInRange(input: {
  ownerUserId: string;
  from: string;
  to: string;
  max?: number;
}): Promise<AsyncJobRow[]> {
  const max = Math.min(input.max ?? 500, 1000);
  const fromMs = new Date(input.from).getTime();
  const toMs = new Date(input.to).getTime();

  // Sem orderBy composto: evita FAILED_PRECONDITION enquanto o indice sobe.
  const snap = await col(COLLECTIONS.asyncJobs)
    .where("ownerUserId", "==", input.ownerUserId)
    .limit(max)
    .get();

  const jobs = sortByCreatedAtDesc(
    snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ownerUserId: String(data.ownerUserId ?? ""),
        type: String(data.type ?? "") as AsyncJobRow["type"],
        status: String(data.status ?? "") as AsyncJobRow["status"],
        payload: (data.payload as Record<string, unknown>) ?? {},
        result: (data.result as Record<string, unknown>) ?? {},
        attempts: Number(data.attempts ?? 0),
        maxAttempts: Number(data.maxAttempts ?? 3),
        lastError: String(data.lastError ?? ""),
        idempotencyKey: data.idempotencyKey ? String(data.idempotencyKey) : null,
        createdAt: String(data.createdAt ?? ""),
        updatedAt: String(data.updatedAt ?? ""),
        startedAt: data.startedAt ? String(data.startedAt) : null,
        finishedAt: data.finishedAt ? String(data.finishedAt) : null,
      } satisfies AsyncJobRow;
    }),
  );

  return jobs.filter((job) => inRange(job.createdAt, fromMs, toMs));
}

export async function countContentVolumes(input: {
  profileId: string;
  from: string;
  to: string;
}): Promise<Pick<
  AuditVolumesSummary,
  "contentRequests" | "generatedContents" | "creativeProjects" | "creativeProjectsWithVideo"
>> {
  const fromMs = new Date(input.from).getTime();
  const toMs = new Date(input.to).getTime();

  const [requestsSnap, projectsSnap] = await Promise.all([
    col(COLLECTIONS.contentRequests)
      .where("profileId", "==", input.profileId)
      .orderBy("createdAt", "desc")
      .limit(500)
      .get(),
    col(COLLECTIONS.creativeProjects)
      .where("profileId", "==", input.profileId)
      .orderBy("createdAt", "desc")
      .limit(500)
      .get(),
  ]);

  const contentRequests = requestsSnap.docs.filter((doc) =>
    inRange(String(doc.data().createdAt ?? ""), fromMs, toMs),
  );
  const requestIds = contentRequests.map((doc) => doc.id);

  let generatedContents = 0;
  for (let i = 0; i < requestIds.length; i += 10) {
    const chunk = requestIds.slice(i, i + 10);
    if (chunk.length === 0) {
      continue;
    }
    const genSnap = await col(COLLECTIONS.generatedContents)
      .where("contentRequestId", "in", chunk)
      .get();
    generatedContents += genSnap.size;
  }

  const projects = projectsSnap.docs.filter((doc) =>
    inRange(String(doc.data().createdAt ?? ""), fromMs, toMs),
  );
  const creativeProjectsWithVideo = projects.filter((doc) => {
    const data = doc.data();
    return Boolean(data.heygenVideoId || data.videoUrl);
  }).length;

  return {
    contentRequests: contentRequests.length,
    generatedContents,
    creativeProjects: projects.length,
    creativeProjectsWithVideo,
  };
}

export async function buildAuditSummary(input: {
  ownerUserId: string;
  profileId: string | null;
  from: string;
  to: string;
}): Promise<AuditSummary> {
  const events = await listAuditEventsInRange({
    ownerUserId: input.ownerUserId,
    from: input.from,
    to: input.to,
  });

  const [jobs, contentVolumes] = await Promise.all([
    listAsyncJobsInRange({
      ownerUserId: input.ownerUserId,
      from: input.from,
      to: input.to,
    }),
    input.profileId
      ? countContentVolumes({
          profileId: input.profileId,
          from: input.from,
          to: input.to,
        })
      : Promise.resolve({
          contentRequests: 0,
          generatedContents: 0,
          creativeProjects: 0,
          creativeProjectsWithVideo: 0,
        }),
  ]);

  const auditVolumes = buildVolumesFromAudit(events);
  let factChecks = 0;
  let factCheckBypasses = 0;
  for (const event of events) {
    const action = event.action || event.eventType;
    if (action === "script_fact_check") {
      factChecks += 1;
    }
    if (action === "fact_check_bypass_free_prompt") {
      factCheckBypasses += 1;
    }
  }

  return {
    from: input.from,
    to: input.to,
    timezone: AUDIT_TIMEZONE,
    access: buildAccessSummary(events),
    volumes: {
      ...contentVolumes,
      ...auditVolumes,
    },
    agents: buildAgentsSummaryFromJobs(jobs, factChecks, factCheckBypasses),
  };
}
