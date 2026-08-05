import { describe, expect, it } from "vitest";

import { renderMaterialityDossierPdf } from "@/lib/legal/materiality-pdf";
import type { AuditSummary } from "@/lib/audit/types";

function baseSummary(): AuditSummary {
  return {
    from: "2026-07-01T00:00:00.000Z",
    to: "2026-08-01T00:00:00.000Z",
    timezone: "America/Sao_Paulo",
    access: {
      loginCount: 5,
      activeDays: 3,
      lastLogin: {
        timestamp: "2026-07-31T21:00:00.000Z",
        timestampLocal: "31/07/2026, 18:00:00 (America/Sao_Paulo)",
        ip: "191.32.44.10",
      },
      loginsByDay: [
        { day: "2026-07-30", count: 2 },
        { day: "2026-07-31", count: 3 },
      ],
      actionEventsByDay: [{ day: "2026-07-31", count: 4 }],
    },
    volumes: {
      contentRequests: 6,
      generatedContents: 9,
      creativeProjects: 4,
      creativeProjectsWithVideo: 2,
      contentGenerateEvents: 4,
      videoGenerateEvents: 1,
    },
    agents: {
      jobsTotal: 3,
      jobsSucceeded: 2,
      jobsFailed: 1,
      jobsByTypeStatus: [
        { type: "video_render", status: "succeeded", count: 2, avgLatencyMs: 42000 },
        { type: "video_render", status: "failed", count: 1, avgLatencyMs: null },
      ],
      factChecks: 2,
      factCheckBypasses: 0,
    },
  };
}

describe("materiality dossier pdf", () => {
  it("gera buffer PDF nao vazio com atos e logs registrados", async () => {
    const pdf = await renderMaterialityDossierPdf({
      fullName: "Fulana de Tal",
      party: "PSD",
      uf: "PE",
      role: "Candidata a Vereadora",
      fromLabel: "01/07/2026",
      toLabel: "01/08/2026",
      generatedAtLabel: "01/08/2026, 09:00:00 (America/Sao_Paulo)",
      summary: baseSummary(),
      acts: [
        { timestampLocal: "31/07/2026, 18:42:10", label: "Geracao de video", ip: "191.32.44.10" },
        { timestampLocal: "30/07/2026, 09:11:47", label: "Geracao de conteudo", ip: "191.32.44.10" },
      ],
      logs: [
        {
          timestampLocal: "31/07/2026, 18:42:10",
          action: "Geracao de video",
          ip: "191.32.44.10",
          ownerUserIdShort: "abcd1234",
          detail: '{"projectId":"p1"}',
        },
      ],
    });

    expect(pdf.byteLength).toBeGreaterThan(500);
    expect(pdf.subarray(0, 4).toString("utf8")).toBe("%PDF");
  });

  it("nao lanca erro quando nao ha atos nem logs no periodo", async () => {
    const empty = baseSummary();
    empty.volumes = { contentRequests: 0, generatedContents: 0, creativeProjects: 0, creativeProjectsWithVideo: 0, contentGenerateEvents: 0, videoGenerateEvents: 0 };
    empty.agents = { jobsTotal: 0, jobsSucceeded: 0, jobsFailed: 0, jobsByTypeStatus: [], factChecks: 0, factCheckBypasses: 0 };
    empty.access = { loginCount: 0, activeDays: 0, lastLogin: null, loginsByDay: [], actionEventsByDay: [] };

    const pdf = await renderMaterialityDossierPdf({
      fullName: "Fulana de Tal",
      party: "PSD",
      uf: "PE",
      fromLabel: "01/07/2026",
      toLabel: "01/08/2026",
      generatedAtLabel: "01/08/2026, 09:00:00 (America/Sao_Paulo)",
      summary: empty,
      acts: [],
      logs: [],
    });

    expect(pdf.subarray(0, 4).toString("utf8")).toBe("%PDF");
  });

  it("gera muitas paginas quando ha muitos logs (paginacao de tabela)", async () => {
    const many = Array.from({ length: 120 }, (_, index) => ({
      timestampLocal: `0${(index % 9) + 1}/07/2026, 10:00:00`,
      action: "Geracao de conteudo",
      ip: "191.32.44.10",
      ownerUserIdShort: "abcd1234",
      detail: `{"i":${index}}`,
    }));

    const pdf = await renderMaterialityDossierPdf({
      fullName: "Fulana de Tal",
      party: "PSD",
      uf: "PE",
      fromLabel: "01/07/2026",
      toLabel: "01/08/2026",
      generatedAtLabel: "01/08/2026, 09:00:00 (America/Sao_Paulo)",
      summary: baseSummary(),
      acts: [],
      logs: many,
    });

    expect(pdf.byteLength).toBeGreaterThan(2000);
    expect(pdf.subarray(0, 4).toString("utf8")).toBe("%PDF");
  });

  it("sinaliza modelo ilustrativo quando sample=true", async () => {
    const pdf = await renderMaterialityDossierPdf({
      fullName: "Ana Beatriz Souza",
      party: "PSD",
      uf: "PE",
      fromLabel: "01/07/2026",
      toLabel: "01/08/2026",
      generatedAtLabel: "01/08/2026, 09:00:00 (America/Sao_Paulo)",
      summary: baseSummary(),
      acts: [],
      logs: [],
      sample: true,
    });

    expect(pdf.byteLength).toBeGreaterThan(500);
  });
});
