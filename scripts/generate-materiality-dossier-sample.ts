/**
 * Gera o PDF de exemplo do Dossie de Auditoria/Materialidade usando dados
 * REAIS da conta informada (login local), mas SEMPRE com a identificacao
 * trocada por uma candidata ficticia — o titular real nunca aparece no PDF.
 * Onde a conta nao tem atividade real suficiente numa aba, preenche com
 * dados mocados para o exemplo nao sair vazio.
 *
 * Uso:
 *   npx vite-node --config vitest.config.ts scripts/generate-materiality-dossier-sample.ts [email] [caminho-saida]
 *
 * Requer FIREBASE_SERVICE_ACCOUNT_JSON em .env.local (mesmo usado por `npm run dev`).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { auditActionLabel, formatAuditTimestampLocal } from "../src/lib/audit/format";
import { buildAuditSummary, listAuditEventsInRange } from "../src/lib/audit/query";
import type { AuditSummary } from "../src/lib/audit/types";
import { getFirebaseAdminAuth } from "../src/lib/firebase/admin";
import { COLLECTIONS, col } from "../src/lib/firebase/collections";
import {
  renderMaterialityDossierPdf,
  type MaterialityActRow,
  type MaterialityLogRow,
} from "../src/lib/legal/materiality-pdf";
import { toDatabaseOwnerUserId } from "../src/lib/owner-user-id";

const FICTITIOUS = {
  fullName: "Ana Beatriz Souza",
  party: "PSD",
  uf: "PE",
  role: "Candidata a Vereadora",
};

const ACT_ACTIONS = new Set([
  "content_generate",
  "creative_project_create",
  "video_generate",
  "script_fact_check",
]);

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    return;
  }
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    if (!line || line.startsWith("#") || !line.includes("=")) {
      continue;
    }
    const i = line.indexOf("=");
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
      if (value.startsWith("{") || value.startsWith("[")) {
        try {
          value = JSON.parse(`"${value.replace(/"/g, '\\"')}"`);
        } catch {
          value = value.replace(/\\n/g, "\n").replace(/\\"/g, '"');
        }
      } else {
        value = value.replace(/\\n/g, "\n").replace(/\\"/g, '"');
      }
    }
    if (!(key in process.env) || !String(process.env[key] ?? "").trim()) {
      process.env[key] = value;
    }
  }
}

function formatDateLabel(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short" }).format(
    new Date(iso),
  );
}

function dayKey(daysAgo: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function mockAccess(): AuditSummary["access"] {
  const loginsByDay = Array.from({ length: 14 }, (_, i) => ({ day: dayKey(13 - i), count: 1 + (i % 3) }));
  const actionEventsByDay = Array.from({ length: 14 }, (_, i) => ({ day: dayKey(13 - i), count: 2 + (i % 5) }));
  return {
    loginCount: 22,
    activeDays: 14,
    lastLogin: {
      timestamp: new Date().toISOString(),
      timestampLocal: formatAuditTimestampLocal(new Date()),
      ip: "191.32.44.10",
    },
    loginsByDay,
    actionEventsByDay,
  };
}

function mockVolumes(): AuditSummary["volumes"] {
  return {
    contentRequests: 18,
    generatedContents: 31,
    creativeProjects: 14,
    creativeProjectsWithVideo: 9,
    contentGenerateEvents: 31,
    videoGenerateEvents: 9,
  };
}

function mockAgents(): AuditSummary["agents"] {
  return {
    jobsTotal: 26,
    jobsSucceeded: 23,
    jobsFailed: 3,
    jobsByTypeStatus: [
      { type: "video_render", status: "succeeded", count: 9, avgLatencyMs: 42000 },
      { type: "video_render", status: "failed", count: 1, avgLatencyMs: 51000 },
      { type: "voice_job", status: "succeeded", count: 4, avgLatencyMs: 18000 },
      { type: "script_fact_check", status: "succeeded", count: 10, avgLatencyMs: 6000 },
      { type: "script_fact_check", status: "failed", count: 2, avgLatencyMs: 7000 },
    ],
    factChecks: 12,
    factCheckBypasses: 1,
  };
}

function mockActs(count: number): MaterialityActRow[] {
  const labels = ["Geracao de video", "Geracao de conteudo", "Criativo criado", "Fact-check"];
  return Array.from({ length: count }, (_, i) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - i * 2);
    date.setUTCHours(9 + (i % 10), 15 + i, 0, 0);
    return {
      timestampLocal: formatAuditTimestampLocal(date),
      label: labels[i % labels.length],
      ip: "191.32.44.10",
    };
  });
}

function mockLogs(count: number): MaterialityLogRow[] {
  const actions = ["Login", "Geracao de conteudo", "Geracao de video", "Fact-check", "Criativo criado"];
  return Array.from({ length: count }, (_, i) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - Math.floor(i / 2));
    date.setUTCHours(8 + (i % 12), 5 + i, 0, 0);
    return {
      timestampLocal: formatAuditTimestampLocal(date),
      action: actions[i % actions.length],
      ip: "191.32.44.10",
      ownerUserIdShort: "modelo01",
      detail: `{"exemplo":${i}}`,
    };
  });
}

function sumVolumes(v: AuditSummary["volumes"]) {
  return (
    v.contentRequests +
    v.generatedContents +
    v.creativeProjects +
    v.creativeProjectsWithVideo +
    v.contentGenerateEvents +
    v.videoGenerateEvents
  );
}

async function main() {
  loadEnvLocal();

  const email = process.argv[2] || "tribeiro81@gmail.com";
  const outputPath = process.argv[3] || path.join(os.tmpdir(), "dossie-materialidade-exemplo.pdf");

  const authUser = await getFirebaseAdminAuth().getUserByEmail(email);
  const ownerUserId = toDatabaseOwnerUserId(authUser.uid);

  const profileSnap = await col(COLLECTIONS.politicianProfiles)
    .where("ownerUserId", "==", ownerUserId)
    .limit(1)
    .get();
  const profileId = profileSnap.empty ? null : profileSnap.docs[0].id;

  const to = new Date().toISOString();
  const fromDate = new Date();
  fromDate.setUTCDate(fromDate.getUTCDate() - 90);
  const from = fromDate.toISOString();

  const [summaryReal, eventsReal] = await Promise.all([
    buildAuditSummary({ ownerUserId, profileId, from, to }),
    listAuditEventsInRange({ ownerUserId, from, to, max: 1000 }),
  ]);

  const sortedReal = [...eventsReal].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  const summary: AuditSummary = {
    from,
    to,
    timezone: summaryReal.timezone,
    access: summaryReal.access.loginCount > 0 ? summaryReal.access : mockAccess(),
    volumes: sumVolumes(summaryReal.volumes) > 0 ? summaryReal.volumes : mockVolumes(),
    agents:
      summaryReal.agents.jobsTotal > 0 || summaryReal.agents.factChecks > 0
        ? summaryReal.agents
        : mockAgents(),
  };

  const actsReal: MaterialityActRow[] = sortedReal
    .filter((event) => ACT_ACTIONS.has(event.action || event.eventType))
    .map((event) => ({
      timestampLocal: event.timestampLocal,
      label: auditActionLabel(event.action || event.eventType),
      ip: event.ip,
    }));
  const acts = actsReal.length > 0 ? actsReal : mockActs(14);

  const logsReal: MaterialityLogRow[] = sortedReal.map((event) => ({
    timestampLocal: event.timestampLocal,
    action: auditActionLabel(event.action || event.eventType),
    ip: event.ip,
    ownerUserIdShort: "modelo01",
    detail: JSON.stringify(event.payload).slice(0, 90),
  }));
  const logs = logsReal.length > 0 ? logsReal : mockLogs(20);

  const pdf = await renderMaterialityDossierPdf({
    fullName: FICTITIOUS.fullName,
    party: FICTITIOUS.party,
    uf: FICTITIOUS.uf,
    role: FICTITIOUS.role,
    fromLabel: formatDateLabel(from),
    toLabel: formatDateLabel(to),
    generatedAtLabel: formatAuditTimestampLocal(new Date()),
    summary,
    acts,
    logs,
    sample: true,
  });

  fs.writeFileSync(outputPath, pdf);
  console.log(`Dossie de exemplo gerado em: ${outputPath}`);
  console.log(
    `Fonte: atividade real de ${email} (identificacao trocada por "${FICTITIOUS.fullName}"); ` +
      `lacunas preenchidas com dados mocados quando a conta nao tinha atividade na aba.`,
  );
}

void main();
