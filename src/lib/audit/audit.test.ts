import { describe, expect, it } from "vitest";

import {
  auditActionLabel,
  auditDayKey,
  formatAuditTimestampLocal,
} from "@/lib/audit/format";
import {
  buildAccessSummary,
  buildAgentsSummaryFromJobs,
  buildVolumesFromAudit,
  countEventsByDay,
} from "@/lib/audit/query";
import { buildAuditEvent } from "@/lib/audit/record";
import type { AuditEvent } from "@/lib/audit/types";
import type { AsyncJobRow } from "@/lib/async-jobs-types";
import { runWithStorageOwner } from "@/lib/storage-context";

function makeEvent(partial: Partial<AuditEvent> & Pick<AuditEvent, "action">): AuditEvent {
  const timestamp = partial.timestamp ?? "2026-07-20T12:00:00.000Z";
  return {
    id: partial.id ?? "evt-1",
    ownerUserId: partial.ownerUserId ?? "owner-1",
    profileId: partial.profileId ?? null,
    projectId: partial.projectId ?? null,
    action: partial.action,
    eventType: partial.eventType ?? partial.action,
    ip: partial.ip ?? "1.2.3.4",
    userAgent: partial.userAgent ?? "test-agent",
    timestamp,
    timezone: "America/Sao_Paulo",
    timestampLocal: partial.timestampLocal ?? formatAuditTimestampLocal(new Date(timestamp)),
    payload: partial.payload ?? {},
    consentTextVersion: partial.consentTextVersion ?? "v1",
    createdAt: partial.createdAt ?? timestamp,
  };
}

describe("audit format", () => {
  it("formata timestamp local com fuso", () => {
    const label = formatAuditTimestampLocal(new Date("2026-07-20T15:00:00.000Z"));
    expect(label).toContain("America/Sao_Paulo");
    expect(label.length).toBeGreaterThan(10);
  });

  it("gera chave de dia no fuso de auditoria", () => {
    // 15:00 UTC = 12:00 BRT (UTC-3)
    expect(auditDayKey("2026-07-20T15:00:00.000Z")).toBe("2026-07-20");
  });

  it("rotula acoes conhecidas", () => {
    expect(auditActionLabel("session_login")).toBe("Login");
    expect(auditActionLabel("custom_x")).toBe("custom_x");
  });
});

describe("buildAuditEvent", () => {
  it("monta evento com owner do contexto e meta do request", async () => {
    const request = new Request("https://example.com/api", {
      headers: {
        "x-forwarded-for": "203.0.113.10",
        "user-agent": "VitestAgent/1.0",
      },
    });

    const event = await runWithStorageOwner("firebase-uid-abc", async () =>
      buildAuditEvent({
        request,
        action: "content_generate",
        profileId: "profile-1",
        payload: { variants: 2 },
      }),
    );

    expect(event).not.toBeNull();
    expect(event?.action).toBe("content_generate");
    expect(event?.eventType).toBe("content_generate");
    expect(event?.ip).toBe("203.0.113.10");
    expect(event?.userAgent).toBe("VitestAgent/1.0");
    expect(event?.timezone).toBe("America/Sao_Paulo");
    expect(event?.timestampLocal).toContain("America/Sao_Paulo");
    expect(event?.ownerUserId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(event?.payload).toEqual({ variants: 2 });
  });

  it("retorna null sem owner", () => {
    const event = buildAuditEvent({
      action: "session_login",
      payload: {},
    });
    expect(event).toBeNull();
  });

  it("aceita owner explicito fora do contexto", () => {
    const event = buildAuditEvent({
      ownerUserId: "11111111-1111-4111-8111-111111111111",
      action: "session_login",
      ip: "10.0.0.1",
    });
    expect(event?.ownerUserId).toBe("11111111-1111-4111-8111-111111111111");
    expect(event?.ip).toBe("10.0.0.1");
  });
});

describe("audit aggregations", () => {
  it("agrupa eventos por dia", () => {
    const byDay = countEventsByDay([
      { timestamp: "2026-07-20T12:00:00.000Z" },
      { timestamp: "2026-07-20T18:00:00.000Z" },
      { timestamp: "2026-07-21T12:00:00.000Z" },
    ]);
    expect(byDay).toEqual([
      { day: "2026-07-20", count: 2 },
      { day: "2026-07-21", count: 1 },
    ]);
  });

  it("resume acessos a partir de logins", () => {
    const summary = buildAccessSummary([
      makeEvent({
        action: "session_login",
        timestamp: "2026-07-21T12:00:00.000Z",
        ip: "9.9.9.9",
        timestampLocal: "21/07/2026, 09:00:00 (America/Sao_Paulo)",
      }),
      makeEvent({
        id: "evt-2",
        action: "content_generate",
        timestamp: "2026-07-20T12:00:00.000Z",
      }),
      makeEvent({
        id: "evt-3",
        action: "session_login",
        timestamp: "2026-07-20T08:00:00.000Z",
        ip: "8.8.8.8",
      }),
    ]);

    expect(summary.loginCount).toBe(2);
    expect(summary.activeDays).toBe(2);
    expect(summary.lastLogin?.ip).toBe("9.9.9.9");
  });

  it("conta volumes a partir de eventos de auditoria", () => {
    const volumes = buildVolumesFromAudit([
      makeEvent({ action: "content_generate" }),
      makeEvent({ id: "a", action: "content_generate" }),
      makeEvent({ id: "b", action: "video_generate" }),
      makeEvent({ id: "c", action: "seal_job" }),
    ]);
    expect(volumes).toEqual({
      contentGenerateEvents: 2,
      videoGenerateEvents: 1,
    });
  });

  it("agrega jobs por tipo/status e latencia", () => {
    const jobs: AsyncJobRow[] = [
      {
        id: "1",
        ownerUserId: "o",
        type: "seal_video",
        status: "succeeded",
        payload: {},
        result: {},
        attempts: 1,
        maxAttempts: 3,
        lastError: "",
        idempotencyKey: null,
        createdAt: "2026-07-20T10:00:00.000Z",
        updatedAt: "2026-07-20T10:00:05.000Z",
        startedAt: "2026-07-20T10:00:00.000Z",
        finishedAt: "2026-07-20T10:00:04.000Z",
      },
      {
        id: "2",
        ownerUserId: "o",
        type: "voice_tts",
        status: "failed",
        payload: {},
        result: {},
        attempts: 2,
        maxAttempts: 3,
        lastError: "x",
        idempotencyKey: null,
        createdAt: "2026-07-20T11:00:00.000Z",
        updatedAt: "2026-07-20T11:00:01.000Z",
        startedAt: "2026-07-20T11:00:00.000Z",
        finishedAt: "2026-07-20T11:00:01.000Z",
      },
    ];

    const agents = buildAgentsSummaryFromJobs(jobs, 3, 1);
    expect(agents.jobsTotal).toBe(2);
    expect(agents.jobsSucceeded).toBe(1);
    expect(agents.jobsFailed).toBe(1);
    expect(agents.factChecks).toBe(3);
    expect(agents.factCheckBypasses).toBe(1);
    expect(agents.jobsByTypeStatus).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "seal_video",
          status: "succeeded",
          count: 1,
          avgLatencyMs: 4000,
        }),
      ]),
    );
  });
});
