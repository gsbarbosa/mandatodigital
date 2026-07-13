import PDFDocument from "pdfkit";

import type { RenderedLegalDocument } from "@/lib/legal/templates";

export async function renderLegalPdf(document: RenderedLegalDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 56, bottom: 56, left: 56, right: 56 },
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

    doc.font("Helvetica-Bold").fontSize(12).text(document.title, { align: "center" });
    doc.moveDown(0.5);
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#444444")
      .text(`Versão ${document.version} · Hash SHA-256: ${document.hash}`, {
        align: "center",
      });
    doc.moveDown();
    doc.fillColor("#000000").fontSize(9).text(document.text, {
      align: "justify",
      lineGap: 2,
    });
    doc.end();
  });
}
