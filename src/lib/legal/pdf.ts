import PDFDocument from "pdfkit";

import type { RenderedLegalDocument } from "@/lib/legal/templates";

/** Espaço físico abaixo do carimbo. */
const PAGE_EDGE_MARGIN = 36;
/** Altura reservada só para o carimbo (o texto do contrato não entra aqui). */
const FOOTER_HEIGHT = 62;
const FOOTER_GAP = 8;
const CONTENT_BOTTOM_MARGIN = PAGE_EDGE_MARGIN + FOOTER_HEIGHT + FOOTER_GAP;

function truncateMiddle(value: string, maxLength: number) {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  const head = Math.ceil((maxLength - 1) / 2);
  const tail = Math.floor((maxLength - 1) / 2);
  return `${trimmed.slice(0, head)}…${trimmed.slice(-tail)}`;
}

function isHeadingLine(line: string) {
  return /^(INSTRUMENTO|QUADRO RESUMO|CLÁUSULA|DECLARAÇÃO FINAL|[12]\. CONTRAT)/.test(
    line,
  );
}

function writeDocumentBody(doc: InstanceType<typeof PDFDocument>, text: string) {
  const lines = text.split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      doc.moveDown(0.35);
      continue;
    }
    const heading = isHeadingLine(line);
    doc
      .font(heading ? "Helvetica-Bold" : "Helvetica")
      .fontSize(heading ? 10 : 9)
      .fillColor("#111111")
      .text(line, {
        align: heading ? "left" : "justify",
        lineGap: heading ? 1 : 2,
      });
    doc.moveDown(heading ? 0.2 : 0.12);
  }
}

function drawLegalPdfFooter(
  doc: InstanceType<typeof PDFDocument>,
  document: RenderedLegalDocument,
  pageLabel: string,
) {
  const { stamp, hash, acceptedAtLabel, version } = document;
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const left = PAGE_EDGE_MARGIN;
  const contentWidth = pageWidth - PAGE_EDGE_MARGIN * 2;
  const footerTop = pageHeight - PAGE_EDGE_MARGIN - FOOTER_HEIGHT;

  const previousBottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;

  doc.save();
  doc
    .moveTo(left, footerTop)
    .lineTo(pageWidth - PAGE_EDGE_MARGIN, footerTop)
    .strokeColor("#cccccc")
    .lineWidth(0.5)
    .stroke();

  const textOpts = {
    width: contentWidth,
    align: "center" as const,
    lineBreak: false,
    lineGap: 0,
  };

  doc.fillColor("#555555").font("Helvetica-Bold").fontSize(7);
  doc.text("Carimbo de Autenticidade Digital", left, footerTop + 5, textOpts);

  doc.font("Helvetica").fontSize(6.5);
  const hashLine = stamp.linkedContractHash
    ? `Hash SHA-256 (dossiê): ${truncateMiddle(hash, 24)} · Contrato: ${truncateMiddle(stamp.linkedContractHash, 24)}`
    : `Hash SHA-256: ${truncateMiddle(hash, 40)}`;
  doc.text(hashLine, left, footerTop + 16, textOpts);
  doc.text(`Timestamp: ${acceptedAtLabel}`, left, footerTop + 26, textOpts);
  doc.text(
    `IP: ${stamp.ip} · User-Agent: ${truncateMiddle(stamp.userAgent, 64)}`,
    left,
    footerTop + 36,
    textOpts,
  );
  doc.text(
    `${pageLabel} · Ref. ${stamp.contractReference} · Aceite ${stamp.acceptanceId} · ${version}`,
    left,
    footerTop + 46,
    textOpts,
  );
  doc.restore();
  doc.page.margins.bottom = previousBottom;
}

export async function renderLegalPdf(document: RenderedLegalDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: {
        top: 52,
        bottom: CONTENT_BOTTOM_MARGIN,
        left: 52,
        right: 52,
      },
      bufferPages: true,
      info: {
        Title: document.title,
        Author: "EatEasy Servicos Digitais LTDA",
        Subject: document.version,
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.font("Helvetica-Bold").fontSize(13).fillColor("#111111").text(document.title, {
      align: "center",
    });
    doc.moveDown(0.35);
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#555555")
      .text(`Versão ${document.version}`, { align: "center" });
    doc.moveDown(0.8);
    writeDocumentBody(doc, document.text);

    const pageRange = doc.bufferedPageRange();
    const totalPages = pageRange.count;
    for (let offset = 0; offset < totalPages; offset += 1) {
      const index = pageRange.start + offset;
      doc.switchToPage(index);
      drawLegalPdfFooter(doc, document, `Página ${offset + 1} de ${totalPages}`);
    }

    doc.end();
  });
}
