/**
 * Gera um dossie de demonstracao 100% mocado, com volume alto e consistente
 * de dados, para apresentar o potencial de materialidade a advogados de
 * campanha. Nao le nenhuma conta real nem precisa de credenciais Firebase —
 * so usa o renderer existente (`renderMaterialityDossierPdf`), sem alterar
 * sua estrutura.
 *
 * Uso:
 *   npx vite-node --config vitest.config.ts scripts/generate-materiality-dossier-demo.ts [caminho-saida]
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { formatAuditTimestampLocal } from "../src/lib/audit/format";
import type { AuditSummary } from "../src/lib/audit/types";
import {
  renderMaterialityDossierPdf,
  type MaterialityActRow,
  type MaterialityLogRow,
} from "../src/lib/legal/materiality-pdf";

const FICTITIOUS = {
  fullName: "Ana Beatriz Souza",
  party: "PSD",
  uf: "PE",
  role: "Candidata a Vereadora",
};

const PERIOD_DAYS = 90;
const IPS = ["191.32.44.10", "191.32.44.187", "179.108.22.63"];

/** Distribuicao ponderada: conteudo > criativo > fact-check > video (nem todo criativo vira video). */
const ACT_LABEL_POOL = [
  "Geracao de conteudo",
  "Geracao de conteudo",
  "Geracao de conteudo",
  "Criativo criado",
  "Criativo criado",
  "Fact-check",
  "Fact-check",
  "Geracao de video",
];

function pick<T>(list: T[], seed: number) {
  return list[seed % list.length];
}

function dateAt(daysAgo: number, hour: number, minute: number, second = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  date.setUTCHours(hour, minute, second, 0);
  return date;
}

function formatDateLabel(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short" }).format(date);
}

type SyntheticEvent = { date: Date; action: string; ip: string; isAct: boolean };

function buildEvents(): SyntheticEvent[] {
  const events: SyntheticEvent[] = [];

  for (let d = PERIOD_DAYS - 1; d >= 0; d -= 1) {
    const probe = dateAt(d, 12, 0);
    const weekday = probe.getUTCDay();
    const isWeekend = weekday === 0 || weekday === 6;

    const logins = isWeekend ? (d % 4 === 0 ? 1 : 0) : 1 + (d % 3);
    for (let i = 0; i < logins; i += 1) {
      events.push({ date: dateAt(d, 8 + i * 5, 12 + i * 9), action: "Login", ip: pick(IPS, d + i), isAct: false });
    }

    const actCount = isWeekend ? (d % 5 === 0 ? 1 : 0) : d % 6 === 0 ? 3 : d % 2 === 0 ? 2 : 1;
    for (let i = 0; i < actCount; i += 1) {
      events.push({
        date: dateAt(d, 10 + i * 3, 20 + i * 11, 40),
        action: pick(ACT_LABEL_POOL, d * 3 + i),
        ip: pick(IPS, d),
        isAct: true,
      });
    }

    if (d % 9 === 0) {
      events.push({ date: dateAt(d, 16, 5), action: "Job de selagem", ip: pick(IPS, d), isAct: false });
    }
    if (d % 11 === 0) {
      events.push({ date: dateAt(d, 17, 25), action: "Job de voz", ip: pick(IPS, d), isAct: false });
    }

    // Monitoramento: acesso quase todo dia util, algumas pautas visualizadas por
    // acesso, atualizacao do radar no mesmo ritmo do acesso, config salva raramente.
    const monitoringViews = isWeekend ? (d % 3 === 0 ? 1 : 0) : 1;
    for (let i = 0; i < monitoringViews; i += 1) {
      events.push({
        date: dateAt(d, 8, 30 + i * 2),
        action: "Acesso ao Monitoramento",
        ip: pick(IPS, d),
        isAct: true,
      });
    }
    const signalViewCount = monitoringViews > 0 ? 1 + (d % 3) : 0;
    for (let i = 0; i < signalViewCount; i += 1) {
      events.push({
        date: dateAt(d, 9, 5 + i * 4),
        action: "Visualizacao de pauta monitorada",
        ip: pick(IPS, d),
        isAct: true,
      });
    }
    if (monitoringViews > 0) {
      events.push({
        date: dateAt(d, 8, 5),
        action: "Atualizacao do radar de monitoramento",
        ip: pick(IPS, d),
        isAct: true,
      });
    }
    if (d % 21 === 0) {
      events.push({
        date: dateAt(d, 8, 0),
        action: "Configuracao de monitoramento salva",
        ip: pick(IPS, d),
        isAct: true,
      });
    }
  }

  events.sort((a, b) => b.date.getTime() - a.date.getTime());
  return events;
}

function buildAccess(events: SyntheticEvent[]): AuditSummary["access"] {
  const byDay = new Map<string, { logins: number; actions: number }>();
  for (const event of events) {
    const dayKey = event.date.toISOString().slice(0, 10);
    const bucket = byDay.get(dayKey) ?? { logins: 0, actions: 0 };
    if (event.action === "Login") {
      bucket.logins += 1;
    } else {
      bucket.actions += 1;
    }
    byDay.set(dayKey, bucket);
  }

  const loginsByDay = [...byDay.entries()]
    .filter(([, v]) => v.logins > 0)
    .map(([day, v]) => ({ day, count: v.logins }))
    .sort((a, b) => a.day.localeCompare(b.day));
  const actionEventsByDay = [...byDay.entries()]
    .filter(([, v]) => v.actions > 0)
    .map(([day, v]) => ({ day, count: v.actions }))
    .sort((a, b) => a.day.localeCompare(b.day));

  const loginCount = loginsByDay.reduce((sum, item) => sum + item.count, 0);
  const lastLoginEvent = events.find((event) => event.action === "Login") ?? events[0];

  return {
    loginCount,
    activeDays: loginsByDay.length,
    lastLogin: {
      timestamp: lastLoginEvent.date.toISOString(),
      timestampLocal: formatAuditTimestampLocal(lastLoginEvent.date),
      ip: lastLoginEvent.ip,
    },
    loginsByDay,
    actionEventsByDay,
  };
}

function countActs(acts: MaterialityActRow[], label: string) {
  return acts.filter((act) => act.label === label).length;
}

function buildVolumes(acts: MaterialityActRow[]): AuditSummary["volumes"] {
  const contentGenerateEvents = countActs(acts, "Geracao de conteudo");
  const videoGenerateEvents = countActs(acts, "Geracao de video");
  const creativeProjects = countActs(acts, "Criativo criado");
  return {
    // Fluxo real do MVP: 3 versoes geradas por pauta.
    contentRequests: Math.max(1, Math.round(contentGenerateEvents / 3)),
    generatedContents: contentGenerateEvents,
    creativeProjects,
    creativeProjectsWithVideo: Math.min(creativeProjects, videoGenerateEvents),
    contentGenerateEvents,
    videoGenerateEvents,
  };
}

function buildAgents(acts: MaterialityActRow[], events: SyntheticEvent[]): AuditSummary["agents"] {
  const videoRenders = countActs(acts, "Geracao de video");
  const factCheckJobs = countActs(acts, "Fact-check");
  const sealJobs = events.filter((event) => event.action === "Job de selagem").length;
  const voiceJobs = events.filter((event) => event.action === "Job de voz").length;

  const withFailures = (count: number, failRate: number) => {
    const failed = Math.round(count * failRate);
    return { succeeded: count - failed, failed };
  };

  const videoStats = withFailures(videoRenders, 0.06);
  const factCheckStats = withFailures(factCheckJobs, 0.09);
  const voiceStats = withFailures(voiceJobs, 0.05);
  const sealStats = withFailures(sealJobs, 0.02);

  const jobsByTypeStatus: AuditSummary["agents"]["jobsByTypeStatus"] = [
    { type: "video_render", status: "succeeded", count: videoStats.succeeded, avgLatencyMs: 46200 },
    { type: "video_render", status: "failed", count: videoStats.failed, avgLatencyMs: 51800 },
    { type: "script_fact_check", status: "succeeded", count: factCheckStats.succeeded, avgLatencyMs: 6100 },
    { type: "script_fact_check", status: "failed", count: factCheckStats.failed, avgLatencyMs: 7400 },
    { type: "voice_job", status: "succeeded", count: voiceStats.succeeded, avgLatencyMs: 15300 },
    { type: "voice_job", status: "failed", count: voiceStats.failed, avgLatencyMs: 16900 },
    { type: "seal_job", status: "succeeded", count: sealStats.succeeded, avgLatencyMs: 4200 },
  ].filter((row) => row.count > 0);

  const jobsSucceeded = videoStats.succeeded + factCheckStats.succeeded + voiceStats.succeeded + sealStats.succeeded;
  const jobsFailed = videoStats.failed + factCheckStats.failed + voiceStats.failed + sealStats.failed;

  return {
    jobsTotal: jobsSucceeded + jobsFailed,
    jobsSucceeded,
    jobsFailed,
    jobsByTypeStatus,
    factChecks: factCheckJobs,
    factCheckBypasses: 4,
  };
}

function buildMonitoring(events: SyntheticEvent[]): AuditSummary["monitoring"] {
  const views = events.filter((event) => event.action === "Acesso ao Monitoramento");
  const signalViews = events.filter((event) => event.action === "Visualizacao de pauta monitorada");
  const refreshes = events.filter((event) => event.action === "Atualizacao do radar de monitoramento");
  const configSaves = events.filter((event) => event.action === "Configuracao de monitoramento salva");

  const dayKeys = new Set(views.map((event) => event.date.toISOString().slice(0, 10)));
  const byDay = new Map<string, number>();
  for (const event of [...views, ...signalViews]) {
    const dayKey = event.date.toISOString().slice(0, 10);
    byDay.set(dayKey, (byDay.get(dayKey) ?? 0) + 1);
  }
  const viewsByDay = [...byDay.entries()]
    .map(([day, count]) => ({ day, count }))
    .sort((a, b) => a.day.localeCompare(b.day));

  // events chega ordenado do mais novo para o mais antigo (ver sort no fim de buildEvents).
  const manualRefreshes = Math.round(refreshes.length * 0.35);

  return {
    monitoringDays: dayKeys.size,
    viewEvents: views.length,
    signalViews: signalViews.length,
    viewsByDay,
    refreshes: refreshes.length,
    manualRefreshes,
    dailyRefreshes: refreshes.length - manualRefreshes,
    configSaves: configSaves.length,
    lastConfigSave: configSaves[0]
      ? { timestamp: configSaves[0].date.toISOString(), timestampLocal: formatAuditTimestampLocal(configSaves[0].date) }
      : null,
  };
}

async function main() {
  const outputPath = process.argv[2] || path.join(os.tmpdir(), "dossie-materialidade-demo-advogados.pdf");

  const events = buildEvents();
  const acts: MaterialityActRow[] = events
    .filter((event) => event.isAct)
    .map((event) => ({
      timestampLocal: formatAuditTimestampLocal(event.date),
      label: event.action,
      ip: event.ip,
    }));
  const logs: MaterialityLogRow[] = events.map((event, index) => ({
    timestampLocal: formatAuditTimestampLocal(event.date),
    action: event.action,
    ip: event.ip,
    ownerUserIdShort: "demo0001",
    detail: JSON.stringify({ seq: events.length - index }),
  }));

  const summary: AuditSummary = {
    from: dateAt(PERIOD_DAYS - 1, 0, 0).toISOString(),
    to: new Date().toISOString(),
    timezone: "America/Sao_Paulo",
    access: buildAccess(events),
    volumes: buildVolumes(acts),
    agents: buildAgents(acts, events),
    monitoring: buildMonitoring(events),
  };

  const fromLabel = formatDateLabel(dateAt(PERIOD_DAYS - 1, 12, 0));
  const toLabel = formatDateLabel(new Date());

  console.log("Resumo gerado:", {
    periodo: `${fromLabel} a ${toLabel}`,
    totalEventos: logs.length,
    totalAtos: acts.length,
    volumes: summary.volumes,
    agentes: { jobsTotal: summary.agents.jobsTotal, factChecks: summary.agents.factChecks },
    acessos: { loginCount: summary.access.loginCount, activeDays: summary.access.activeDays },
  });

  const pdf = await renderMaterialityDossierPdf({
    fullName: FICTITIOUS.fullName,
    party: FICTITIOUS.party,
    uf: FICTITIOUS.uf,
    role: FICTITIOUS.role,
    fromLabel,
    toLabel,
    generatedAtLabel: formatAuditTimestampLocal(new Date()),
    summary,
    acts,
    logs,
    sample: true,
  });

  fs.writeFileSync(outputPath, pdf);
  console.log(`Dossie de demonstracao gerado em: ${outputPath}`);
}

void main();
