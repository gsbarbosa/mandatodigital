import PDFDocument from "pdfkit";

import { sha256Hex } from "@/lib/legal/request-meta";
import type { AuditSummary } from "@/lib/audit/types";

export type MaterialityActRow = {
  timestampLocal: string;
  label: string;
  ip: string;
};

export type MaterialityLogRow = {
  timestampLocal: string;
  action: string;
  ip: string;
  ownerUserIdShort: string;
  detail: string;
};

export type MaterialityDossierInput = {
  fullName: string;
  party: string;
  uf: string;
  role?: string;
  fromLabel: string;
  toLabel: string;
  generatedAtLabel: string;
  /** Resumo completo das 4 abas tecnicas (Acessos/Volumes/Agentes + base de Materialidade). */
  summary: AuditSummary;
  /** Todos os atos de campanha no periodo (Materialidade) — sem corte artificial. */
  acts: MaterialityActRow[];
  /** Trilha bruta completa de eventos no periodo (aba Logs). */
  logs: MaterialityLogRow[];
  /** Marca o PDF como modelo ilustrativo (material comercial), nao um registro real de conta. */
  sample?: boolean;
};

type Stat = { value: string; label: string; sub?: string };
type Cursor = { y: number };
type TableColumn = { header: string; width: number };
type Accent = { main: string; soft: string };
type SectionDef = { number: number; label: string; color: Accent };

const FONT = {
  display: "Times-Bold",
  body: "Helvetica",
  bodyBold: "Helvetica-Bold",
  mono: "Courier",
} as const;

const COLOR = {
  ink: "#14171f",
  inkSoft: "#4b5160",
  inkFaint: "#848c9c",
  line: "#dde1e8",
  hairline: "#eef0f4",
  brand: "#1d4ed8",
  brandSoft: "#e8effe",
  sample: "#b45309",
  sampleSoft: "#fdf1dd",
  zebra: "#f6f7f9",
} as const;

/** Uma cor de destaque por secao — reforca a navegacao entre as abas ao folhear o PDF. */
const SECTION_COLORS = {
  materialidade: { main: "#b3261e", soft: "#fbe9e7" },
  acessos: { main: "#1d4ed8", soft: "#e8effe" },
  volumes: { main: "#0f766e", soft: "#e3f2f0" },
  agentes: { main: "#6d28d9", soft: "#f0eafd" },
  logs: { main: "#475569", soft: "#edf0f3" },
} as const satisfies Record<string, Accent>;

const SECTION_ACESSOS: SectionDef = { number: 1, label: "Acessos", color: SECTION_COLORS.acessos };
const SECTION_MATERIALIDADE: SectionDef = { number: 2, label: "Materialidade", color: SECTION_COLORS.materialidade };
const SECTION_VOLUMES: SectionDef = { number: 3, label: "Volumes", color: SECTION_COLORS.volumes };
const SECTION_AGENTES: SectionDef = { number: 4, label: "Agentes", color: SECTION_COLORS.agentes };
const SECTION_LOGS: SectionDef = { number: 5, label: "Logs", color: SECTION_COLORS.logs };

const MARGIN = 48;
const TILE_HEIGHT = 58;
const TILE_GAP = 10;
const ROW_HEIGHT = 20;

function integrityHash(input: MaterialityDossierInput) {
  return sha256Hex(
    JSON.stringify({
      fullName: input.fullName,
      party: input.party,
      uf: input.uf,
      from: input.fromLabel,
      to: input.toLabel,
      acts: input.acts.length,
      logs: input.logs.length,
    }),
  ).slice(0, 16);
}

function mostFrequentAction(logs: MaterialityLogRow[]): { label: string; count: number } | null {
  if (logs.length === 0) {
    return null;
  }
  const tally = new Map<string, number>();
  for (const log of logs) {
    tally.set(log.action, (tally.get(log.action) ?? 0) + 1);
  }
  let best: [string, number] | null = null;
  for (const entry of tally) {
    if (!best || entry[1] > best[1]) {
      best = entry;
    }
  }
  return best ? { label: best[0], count: best[1] } : null;
}

function ensureRoom(doc: PDFKit.PDFDocument, cursor: Cursor, needed: number): boolean {
  const bottom = doc.page.height - MARGIN;
  if (cursor.y + needed > bottom) {
    doc.addPage();
    cursor.y = MARGIN;
    return true;
  }
  return false;
}

/** Selo circular numerado — mesma linguagem visual do indice (pagina 1) e dos titulos de secao. */
function drawBadge(doc: PDFKit.PDFDocument, x: number, y: number, diameter: number, color: string, label: string) {
  const radius = diameter / 2;
  doc.circle(x + radius, y + radius, radius).fill(color);
  doc
    .font(FONT.bodyBold)
    .fontSize(diameter * 0.5)
    .fillColor("#ffffff")
    .text(label, x, y + diameter * 0.24, { width: diameter, align: "center" });
}

function drawMasthead(doc: PDFKit.PDFDocument, cursor: Cursor, contentWidth: number, ruleColor: string) {
  doc.roundedRect(MARGIN, cursor.y, 11, 11, 2).fill(COLOR.brand);
  doc
    .font(FONT.bodyBold)
    .fontSize(10.5)
    .fillColor(COLOR.ink)
    .text("MANDATO DIGITAL", MARGIN + 19, cursor.y - 1, { characterSpacing: 0.3 });
  cursor.y += 17;
  doc
    .font(FONT.body)
    .fontSize(7.2)
    .fillColor(COLOR.inkFaint)
    .text("DOSSIE DE AUDITORIA E COMPROVACAO DE MATERIALIDADE", MARGIN, cursor.y, {
      characterSpacing: 0.7,
    });
  cursor.y += 12;
  doc.rect(MARGIN, cursor.y, contentWidth, 2.25).fill(ruleColor);
  cursor.y += 16;
}

function drawDocHeader(
  doc: PDFKit.PDFDocument,
  cursor: Cursor,
  contentWidth: number,
  input: MaterialityDossierInput,
) {
  drawMasthead(doc, cursor, contentWidth, COLOR.brand);

  if (input.sample) {
    const badgeText = "MODELO — DADOS ILUSTRATIVOS PARA DEMONSTRACAO";
    doc.font(FONT.bodyBold).fontSize(7.5);
    const badgeWidth = doc.widthOfString(badgeText) + 18;
    doc.roundedRect(MARGIN, cursor.y, badgeWidth, 17, 8.5).fill(COLOR.sampleSoft);
    doc.fillColor(COLOR.sample).text(badgeText, MARGIN + 9, cursor.y + 5);
    cursor.y += 26;
  }

  const chips = [
    { label: "TITULAR", value: input.fullName },
    { label: "PARTIDO / UF", value: `${input.party}/${input.uf}` },
    ...(input.role ? [{ label: "CARGO", value: input.role }] : []),
    { label: "PERIODO", value: `${input.fromLabel} — ${input.toLabel}` },
  ];
  const gap = 16;
  const chipWidth = (contentWidth - gap * (chips.length - 1)) / chips.length;
  const chipTop = cursor.y;
  chips.forEach((chip, index) => {
    const x = MARGIN + index * (chipWidth + gap);
    doc
      .font(FONT.body)
      .fontSize(6.8)
      .fillColor(COLOR.inkFaint)
      .text(chip.label, x, chipTop, { width: chipWidth, characterSpacing: 0.5 });
    doc
      .font(FONT.bodyBold)
      .fontSize(9.5)
      .fillColor(COLOR.ink)
      .text(chip.value, x, chipTop + 11, { width: chipWidth, height: 13, ellipsis: true });
  });
  cursor.y = chipTop + 30;
  doc.moveTo(MARGIN, cursor.y).lineTo(MARGIN + contentWidth, cursor.y).lineWidth(0.75).strokeColor(COLOR.hairline).stroke();
  cursor.y += 18;
}

/** Titulo numerado de topico/secao (pagina 1 e abertura de cada secao de detalhe). */
function drawSectionTitle(
  doc: PDFKit.PDFDocument,
  cursor: Cursor,
  contentWidth: number,
  section: SectionDef,
  description?: string,
  suffix?: string,
) {
  ensureRoom(doc, cursor, 44);
  const badgeSize = 22;
  drawBadge(doc, MARGIN, cursor.y, badgeSize, section.color.main, String(section.number));
  const titleText = suffix ? `${section.label} — ${suffix}` : section.label;
  doc
    .font(FONT.display)
    .fontSize(13.5)
    .fillColor(COLOR.ink)
    .text(titleText, MARGIN + badgeSize + 12, cursor.y + 4, {
      width: contentWidth - badgeSize - 12,
      height: 16,
      ellipsis: true,
    });
  cursor.y += badgeSize + 6;
  if (description) {
    doc
      .font(FONT.body)
      .fontSize(9.3)
      .fillColor(COLOR.inkSoft)
      .text(description, MARGIN + badgeSize + 12, cursor.y, {
        width: contentWidth - badgeSize - 12,
        lineGap: 2,
      });
    cursor.y = doc.y + 14;
  } else {
    cursor.y += 10;
  }
}

/** Subtitulo leve, sem selo numerado — usado dentro de uma secao (ex.: "Logins por dia"). */
function drawSubheading(doc: PDFKit.PDFDocument, cursor: Cursor, contentWidth: number, title: string, accent: string) {
  ensureRoom(doc, cursor, 24);
  doc.rect(MARGIN, cursor.y + 2, 3, 11).fill(accent);
  doc
    .font(FONT.bodyBold)
    .fontSize(10.5)
    .fillColor(COLOR.ink)
    .text(title, MARGIN + 11, cursor.y, { width: contentWidth - 11 });
  cursor.y = doc.y + 9;
}

/** Cabecalho leve, repetido no topo de cada secao de detalhe (paginas 2+). */
function drawRunningHeader(
  doc: PDFKit.PDFDocument,
  cursor: Cursor,
  contentWidth: number,
  section: SectionDef,
  suffix: string,
) {
  drawMasthead(doc, cursor, contentWidth, section.color.main);
  drawSectionTitle(doc, cursor, contentWidth, section, undefined, suffix);
}

function drawStatTiles(
  doc: PDFKit.PDFDocument,
  cursor: Cursor,
  contentWidth: number,
  stats: Stat[],
  accent: string,
) {
  const perRow = 4;
  for (let start = 0; start < stats.length; start += perRow) {
    const row = stats.slice(start, start + perRow);
    ensureRoom(doc, cursor, TILE_HEIGHT + TILE_GAP);
    const tileWidth = (contentWidth - TILE_GAP * (row.length - 1)) / row.length;
    row.forEach((stat, index) => {
      const x = MARGIN + index * (tileWidth + TILE_GAP);
      const valueFontSize = stat.value.length > 12 ? 12 : 18;
      doc.roundedRect(x, cursor.y, tileWidth, TILE_HEIGHT, 5).lineWidth(1).strokeColor(COLOR.line).stroke();
      doc.rect(x + 1.25, cursor.y + 1.25, 3, TILE_HEIGHT - 2.5).fill(accent);
      doc
        .font(FONT.bodyBold)
        .fontSize(valueFontSize)
        .fillColor(accent)
        .text(stat.value, x + 14, cursor.y + 9, { width: tileWidth - 24, height: 21, ellipsis: true });
      doc
        .font(FONT.bodyBold)
        .fontSize(7.6)
        .fillColor(COLOR.ink)
        .text(stat.label, x + 14, cursor.y + 32, { width: tileWidth - 24, height: 11, ellipsis: true });
      if (stat.sub) {
        doc
          .font(FONT.body)
          .fontSize(6.8)
          .fillColor(COLOR.inkFaint)
          .text(stat.sub, x + 14, cursor.y + 44, { width: tileWidth - 24, height: 10, ellipsis: true });
      }
    });
    cursor.y += TILE_HEIGHT + TILE_GAP;
  }
}

function drawTable(
  doc: PDFKit.PDFDocument,
  cursor: Cursor,
  contentWidth: number,
  columns: TableColumn[],
  rows: string[][],
  emptyLabel: string,
  accent: Accent,
) {
  function drawHeaderRow() {
    doc.rect(MARGIN, cursor.y, contentWidth, ROW_HEIGHT).fill(accent.soft);
    doc.rect(MARGIN, cursor.y, 3, ROW_HEIGHT).fill(accent.main);
    let x = MARGIN;
    doc.font(FONT.bodyBold).fontSize(7.5).fillColor(accent.main);
    for (const column of columns) {
      doc.text(column.header.toUpperCase(), x + 10, cursor.y + 6, {
        width: column.width - 14,
        height: 10,
        ellipsis: true,
        characterSpacing: 0.2,
      });
      x += column.width;
    }
    cursor.y += ROW_HEIGHT;
  }

  ensureRoom(doc, cursor, ROW_HEIGHT * 2);
  drawHeaderRow();

  if (rows.length === 0) {
    doc
      .font(FONT.body)
      .fontSize(9)
      .fillColor(COLOR.inkFaint)
      .text(emptyLabel, MARGIN + 10, cursor.y + 6, { width: contentWidth - 16 });
    cursor.y += ROW_HEIGHT;
    return;
  }

  rows.forEach((row, index) => {
    const brokePage = ensureRoom(doc, cursor, ROW_HEIGHT);
    if (brokePage) {
      drawHeaderRow();
    }
    if (index % 2 === 1) {
      doc.rect(MARGIN, cursor.y, contentWidth, ROW_HEIGHT).fill(COLOR.zebra);
    }
    let x = MARGIN;
    doc.font(FONT.body).fontSize(8).fillColor(COLOR.inkSoft);
    row.forEach((cell, columnIndex) => {
      doc.text(cell, x + 10, cursor.y + 5, {
        width: columns[columnIndex].width - 14,
        height: 11,
        ellipsis: true,
      });
      x += columns[columnIndex].width;
    });
    cursor.y += ROW_HEIGHT;
  });
}

function drawBarList(
  doc: PDFKit.PDFDocument,
  cursor: Cursor,
  contentWidth: number,
  items: Array<{ day: string; count: number }>,
  emptyLabel: string,
  accent: string,
) {
  if (items.length === 0) {
    ensureRoom(doc, cursor, 16);
    doc
      .font(FONT.body)
      .fontSize(9)
      .fillColor(COLOR.inkFaint)
      .text(emptyLabel, MARGIN, cursor.y, { width: contentWidth });
    cursor.y = doc.y + 10;
    return;
  }

  const max = Math.max(1, ...items.map((item) => item.count));
  const dayWidth = 76;
  const countWidth = 34;
  const barWidth = contentWidth - dayWidth - countWidth - 12;
  const rowHeight = 15;

  items.forEach((item) => {
    ensureRoom(doc, cursor, rowHeight);
    doc
      .font(FONT.body)
      .fontSize(7.5)
      .fillColor(COLOR.inkSoft)
      .text(item.day, MARGIN, cursor.y + 3, { width: dayWidth, height: 10, ellipsis: true });
    const barFillWidth = Math.max(3, (item.count / max) * barWidth);
    doc.roundedRect(MARGIN + dayWidth, cursor.y + 2, barWidth, 8, 2).fill(COLOR.hairline);
    doc.roundedRect(MARGIN + dayWidth, cursor.y + 2, barFillWidth, 8, 2).fill(accent);
    doc
      .font(FONT.body)
      .fontSize(7.5)
      .fillColor(COLOR.inkFaint)
      .text(String(item.count), MARGIN + dayWidth + barWidth + 6, cursor.y + 3, {
        width: countWidth,
        height: 10,
        ellipsis: true,
      });
    cursor.y += rowHeight;
  });
}

function materialidadeStats(input: MaterialityDossierInput): Stat[] {
  const m = input.summary.monitoring;
  return [
    { value: String(m.monitoringDays), label: "Dias com acesso ao Monitoramento" },
    { value: String(m.signalViews), label: "Pautas visualizadas" },
    {
      value: String(m.refreshes),
      label: "Atualizacoes do radar",
      sub: `${m.manualRefreshes} manuais, ${m.dailyRefreshes} automaticas`,
    },
    {
      value: String(m.configSaves),
      label: "Configuracoes de radar salvas",
      sub: m.lastConfigSave
        ? `Ultima: ${m.lastConfigSave.timestampLocal.replace(/\s*\(America\/Sao_Paulo\)\s*$/, "")}`
        : undefined,
    },
  ];
}

function acessosStats(input: MaterialityDossierInput): Stat[] {
  const lastLogin = input.summary.access.lastLogin;
  return [
    { value: String(input.summary.access.loginCount), label: "Logins no periodo" },
    { value: String(input.summary.access.activeDays), label: "Dias ativos" },
    {
      value: lastLogin ? lastLogin.timestampLocal.replace(/\s*\(America\/Sao_Paulo\)\s*$/, "") : "—",
      label: "Ultima sessao",
      sub: lastLogin ? `IP ${lastLogin.ip}` : undefined,
    },
  ];
}

function volumesStats(input: MaterialityDossierInput): Stat[] {
  const v = input.summary.volumes;
  return [
    { value: String(v.contentRequests), label: "Pautas (content requests)" },
    { value: String(v.generatedContents), label: "Textos gerados" },
    { value: String(v.creativeProjects), label: "Projetos criativos" },
    { value: String(v.creativeProjectsWithVideo), label: "Criativos com video" },
    { value: String(v.contentGenerateEvents), label: "Eventos de geracao" },
    { value: String(v.videoGenerateEvents), label: "Eventos de video" },
  ];
}

function agentesStats(input: MaterialityDossierInput): Stat[] {
  const a = input.summary.agents;
  return [
    { value: String(a.jobsTotal), label: "Jobs totais" },
    { value: String(a.jobsSucceeded), label: "Jobs concluidos" },
    { value: String(a.jobsFailed), label: "Jobs falhos" },
    { value: String(a.factChecks), label: "Fact-checks", sub: `${a.factCheckBypasses} bypass (prompt livre)` },
  ];
}

function logsStats(input: MaterialityDossierInput): Stat[] {
  const top = mostFrequentAction(input.logs);
  return [
    { value: String(input.logs.length), label: "Eventos registrados no periodo" },
    { value: top ? top.label : "—", label: "Acao mais frequente", sub: top ? `${top.count} ocorrencias` : undefined },
    { value: `${input.fromLabel} – ${input.toLabel}`, label: "Periodo coberto" },
  ];
}

const ACT_COLUMNS: TableColumn[] = [
  { header: "Data / Hora", width: 140 },
  { header: "Acao registrada", width: 220 },
  { header: "IP", width: 139 },
];

const JOB_COLUMNS: TableColumn[] = [
  { header: "Tipo", width: 180 },
  { header: "Status", width: 110 },
  { header: "Qtd", width: 80 },
  { header: "Latencia media", width: 129 },
];

const LOG_COLUMNS: TableColumn[] = [
  { header: "Data / Hora", width: 95 },
  { header: "Acao", width: 110 },
  { header: "IP", width: 80 },
  { header: "Usuario", width: 60 },
  { header: "Detalhe", width: 154 },
];

export async function renderMaterialityDossierPdf(
  input: MaterialityDossierInput,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      bufferPages: true,
      margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
      info: {
        Title: `Dossie de Auditoria - ${input.fullName}`,
        Author: "EatEasy Servicos Digitais LTDA",
        Subject: "Comprovacao de materialidade de campanha",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const contentWidth = doc.page.width - MARGIN * 2;
    const cursor: Cursor = { y: MARGIN };

    // Pagina 1 — indice: quais topicos o dossie cobre e o que cada um significa.
    drawDocHeader(doc, cursor, contentWidth, input);

    doc
      .font(FONT.display)
      .fontSize(18)
      .fillColor(COLOR.ink)
      .text("Topicos abordados neste dossie", MARGIN, cursor.y, { width: contentWidth });
    cursor.y = doc.y + 5;
    doc
      .font(FONT.body)
      .fontSize(9)
      .fillColor(COLOR.inkFaint)
      .text(
        "Cada topico abaixo tem o detalhamento completo, sem cortes, nas paginas seguintes.",
        MARGIN,
        cursor.y,
        { width: contentWidth },
      );
    cursor.y = doc.y + 20;

    const topics: Array<{ section: SectionDef; description: string }> = [
      {
        section: SECTION_ACESSOS,
        description:
          "Historico de sessoes: quantos logins, em quais dias, e data/hora/IP da ultima sessao.",
      },
      {
        section: SECTION_MATERIALIDADE,
        description:
          "Atos de campanha proprios — geracao, edicao e aprovacao de conteudo, alem do uso do " +
            "radar de Monitoramento de Noticias/Pautas (acessos, pautas visualizadas, atualizacoes " +
            "e configuracoes salvas) — registrados com data, hora, IP e usuario no instante do ato.",
      },
      {
        section: SECTION_VOLUMES,
        description:
          "Quantidade de pautas, textos gerados, projetos criativos e videos produzidos no periodo.",
      },
      {
        section: SECTION_AGENTES,
        description:
          "Execucao dos agentes automatizados: jobs concluidos, jobs falhos e checagens de fatos " +
            "realizadas antes da publicacao.",
      },
      {
        section: SECTION_LOGS,
        description:
          "Trilha bruta e completa de todos os eventos registrados na conta — o registro tecnico " +
            "subjacente as demais secoes.",
      },
    ];

    topics.forEach((topic, index) => {
      drawSectionTitle(doc, cursor, contentWidth, topic.section, topic.description);
      if (index < topics.length - 1) {
        doc
          .moveTo(MARGIN, cursor.y - 4)
          .lineTo(MARGIN + contentWidth, cursor.y - 4)
          .lineWidth(0.75)
          .strokeColor(COLOR.hairline)
          .stroke();
      }
    });

    // Pagina(s) 2+ — Acessos completo.
    doc.addPage();
    cursor.y = MARGIN;
    drawRunningHeader(doc, cursor, contentWidth, SECTION_ACESSOS, "sessoes e acoes por dia (completo)");
    drawStatTiles(doc, cursor, contentWidth, acessosStats(input), SECTION_ACESSOS.color.main);
    cursor.y += 12;
    drawSubheading(doc, cursor, contentWidth, "Logins por dia", SECTION_ACESSOS.color.main);
    drawBarList(
      doc,
      cursor,
      contentWidth,
      input.summary.access.loginsByDay,
      "Nenhum login registrado no periodo.",
      SECTION_ACESSOS.color.main,
    );
    cursor.y += 12;
    drawSubheading(doc, cursor, contentWidth, "Acoes por dia", SECTION_ACESSOS.color.main);
    drawBarList(
      doc,
      cursor,
      contentWidth,
      input.summary.access.actionEventsByDay,
      "Nenhuma acao registrada no periodo.",
      SECTION_ACESSOS.color.main,
    );

    // Materialidade completa.
    doc.addPage();
    cursor.y = MARGIN;
    drawRunningHeader(doc, cursor, contentWidth, SECTION_MATERIALIDADE, "atos de campanha (completo)");
    drawStatTiles(doc, cursor, contentWidth, materialidadeStats(input), SECTION_MATERIALIDADE.color.main);
    cursor.y += 8;
    drawTable(
      doc,
      cursor,
      contentWidth,
      ACT_COLUMNS,
      input.acts.map((act) => [
        act.timestampLocal.replace(/\s*\(America\/Sao_Paulo\)\s*$/, ""),
        act.label,
        act.ip,
      ]),
      "Nenhum ato de campanha registrado no periodo selecionado.",
      SECTION_MATERIALIDADE.color,
    );

    // Volumes completo.
    doc.addPage();
    cursor.y = MARGIN;
    drawRunningHeader(doc, cursor, contentWidth, SECTION_VOLUMES, "producao de conteudo (completo)");
    drawStatTiles(doc, cursor, contentWidth, volumesStats(input), SECTION_VOLUMES.color.main);

    // Agentes completo.
    doc.addPage();
    cursor.y = MARGIN;
    drawRunningHeader(doc, cursor, contentWidth, SECTION_AGENTES, "jobs automatizados (completo)");
    drawStatTiles(doc, cursor, contentWidth, agentesStats(input), SECTION_AGENTES.color.main);
    cursor.y += 8;
    drawTable(
      doc,
      cursor,
      contentWidth,
      JOB_COLUMNS,
      input.summary.agents.jobsByTypeStatus.map((job) => [
        job.type,
        job.status,
        String(job.count),
        job.avgLatencyMs == null ? "—" : `${Math.round(job.avgLatencyMs / 1000)}s`,
      ]),
      "Nenhum job no periodo.",
      SECTION_AGENTES.color,
    );

    // Logs completo.
    doc.addPage();
    cursor.y = MARGIN;
    drawRunningHeader(doc, cursor, contentWidth, SECTION_LOGS, "trilha completa de eventos (completo)");
    drawStatTiles(doc, cursor, contentWidth, logsStats(input), SECTION_LOGS.color.main);
    cursor.y += 8;
    drawTable(
      doc,
      cursor,
      contentWidth,
      LOG_COLUMNS,
      input.logs.map((log) => [
        log.timestampLocal.replace(/\s*\(America\/Sao_Paulo\)\s*$/, ""),
        log.action,
        log.ip,
        log.ownerUserIdShort,
        log.detail,
      ]),
      "Nenhum evento registrado no periodo selecionado.",
      SECTION_LOGS.color,
    );

    // Encerramento — base legal e hash de integridade, com tratamento de fechamento formal.
    doc.addPage();
    cursor.y = MARGIN;
    drawMasthead(doc, cursor, contentWidth, COLOR.ink);
    doc
      .font(FONT.display)
      .fontSize(16)
      .fillColor(COLOR.ink)
      .text("Encerramento e base legal", MARGIN, cursor.y, { width: contentWidth });
    cursor.y = doc.y + 16;

    const legalText =
      "Este documento nao substitui a prestacao de contas ao TSE/SPCE nem certifica resultado " +
      "eleitoral. Serve como evidencia de atos de campanha e da comprovacao de materialidade " +
      "perante orgaos de controle. Os dados deste documento refletem a integralidade dos " +
      "registros no periodo selecionado, sem cortes.";
    const panelPadding = 16;
    doc.font(FONT.body).fontSize(9.5);
    const paragraphHeight = doc.heightOfString(legalText, {
      width: contentWidth - panelPadding * 2,
      lineGap: 2.5,
    });
    doc.roundedRect(MARGIN, cursor.y, contentWidth, paragraphHeight + panelPadding * 2, 8).fill(COLOR.hairline);
    doc
      .fillColor(COLOR.inkSoft)
      .text(legalText, MARGIN + panelPadding, cursor.y + panelPadding, {
        width: contentWidth - panelPadding * 2,
        lineGap: 2.5,
      });
    cursor.y = cursor.y + paragraphHeight + panelPadding * 2 + 20;

    const hashText = `HASH DE INTEGRIDADE   ${integrityHash(input)}`;
    doc.font(FONT.mono).fontSize(8.5);
    const hashChipWidth = doc.widthOfString(hashText) + 22;
    doc.roundedRect(MARGIN, cursor.y, hashChipWidth, 23, 11.5).fill(COLOR.ink);
    doc.fillColor("#ffffff").text(hashText, MARGIN + 11, cursor.y + 7);
    cursor.y += 36;

    doc
      .font(FONT.body)
      .fontSize(8)
      .fillColor(COLOR.inkFaint)
      .text(
        `Gerado automaticamente pela plataforma Mandato Digital em ${input.generatedAtLabel}.`,
        MARGIN,
        cursor.y,
        { width: contentWidth },
      );

    // Numeracao de paginas (precisa do total, por isso roda so no final).
    // O texto do rodape vive dentro da margem inferior — sem zerar `margins.bottom`
    // o pdfkit interpreta isso como estouro de pagina e insere uma pagina em branco
    // a cada chamada de `.text()` neste loop.
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i += 1) {
      doc.switchToPage(i);
      const bottomMargin = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc
        .moveTo(MARGIN, doc.page.height - MARGIN + 4)
        .lineTo(doc.page.width - MARGIN, doc.page.height - MARGIN + 4)
        .lineWidth(0.5)
        .strokeColor(COLOR.hairline)
        .stroke();
      doc
        .font(FONT.body)
        .fontSize(7)
        .fillColor(COLOR.inkFaint)
        .text(
          `Mandato Digital — Dossie de Auditoria — pagina ${i + 1} de ${range.count}`,
          MARGIN,
          doc.page.height - MARGIN + 10,
          { width: contentWidth, align: "center", lineBreak: false },
        );
      doc.page.margins.bottom = bottomMargin;
    }

    doc.end();
  });
}
