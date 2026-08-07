import { NextResponse } from "next/server";

import { auditActionLabel, formatAuditTimestampLocal } from "@/lib/audit/format";
import { buildAuditSummary, listAuditEventsInRange } from "@/lib/audit/query";
import { recordAuditEventFireAndForget } from "@/lib/audit/record";
import { apiRoute } from "@/lib/auth/api-route";
import {
  renderMaterialityDossierPdf,
  type MaterialityActRow,
  type MaterialityLogRow,
} from "@/lib/legal/materiality-pdf";
import { getStorageOwnerUserId } from "@/lib/storage-context";
import { getUserRegistrationForOwner } from "@/lib/user-registration-storage";

/** Acoes que contam como "atos de campanha proprios" para o indicio de ausencia de campanha. */
const ACT_ACTIONS = new Set([
  "content_generate",
  "creative_project_create",
  "video_generate",
  "script_fact_check",
  "monitoring_view",
  "monitoring_signal_view",
  "monitoring_refresh",
  "monitoring_config_save",
]);

function defaultFromIso() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 30);
  return date.toISOString();
}

function formatDateLabel(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
  }).format(new Date(iso));
}

const DIACRITICS_PATTERN = new RegExp("[\\u0300-\\u036f]", "g");

function slugify(value: string) {
  const slug = value
    .normalize("NFD")
    .replace(DIACRITICS_PATTERN, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return slug || "candidato";
}

export async function GET(request: Request) {
  return apiRoute(async (repository) => {
    const ownerUserId = getStorageOwnerUserId()?.trim();
    if (!ownerUserId) {
      return NextResponse.json({ message: "Nao autenticado." }, { status: 401 });
    }

    const url = new URL(request.url);
    const from = url.searchParams.get("from")?.trim() || defaultFromIso();
    const to = url.searchParams.get("to")?.trim() || new Date().toISOString();

    const [dashboard, registration] = await Promise.all([
      repository.getDashboard(),
      getUserRegistrationForOwner(ownerUserId),
    ]);

    const [summary, events] = await Promise.all([
      buildAuditSummary({ ownerUserId, profileId: dashboard.profile?.id ?? null, from, to }),
      listAuditEventsInRange({ ownerUserId, from, to, max: 1000 }),
    ]);

    const sortedEvents = [...events].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    const acts: MaterialityActRow[] = sortedEvents
      .filter((event) => ACT_ACTIONS.has(event.action || event.eventType))
      .map((event) => ({
        timestampLocal: event.timestampLocal,
        label: auditActionLabel(event.action || event.eventType),
        ip: event.ip,
      }));

    const logs: MaterialityLogRow[] = sortedEvents.map((event) => ({
      timestampLocal: event.timestampLocal,
      action: auditActionLabel(event.action || event.eventType),
      ip: event.ip,
      ownerUserIdShort: event.ownerUserId.slice(0, 8),
      detail: JSON.stringify(event.payload).slice(0, 90),
    }));

    const fullName =
      registration?.fullName?.trim() || dashboard.profile?.fullName?.trim() || "Titular nao identificado";
    const party = registration?.party?.trim() || "-";
    const uf = registration?.uf?.trim() || "-";
    const role = registration?.role?.trim() || undefined;

    const pdf = await renderMaterialityDossierPdf({
      fullName,
      party,
      uf,
      role,
      fromLabel: formatDateLabel(from),
      toLabel: formatDateLabel(to),
      generatedAtLabel: formatAuditTimestampLocal(new Date()),
      summary,
      acts,
      logs,
    });

    recordAuditEventFireAndForget({
      request,
      ownerUserId,
      action: "manual_export",
      payload: { report: "materiality_dossier", from, to, totalActs: acts.length, totalLogs: logs.length },
    });

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="dossie-materialidade-${slugify(fullName)}.pdf"`,
      },
    });
  });
}
