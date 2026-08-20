/**
 * Gera Contrato + Dossiê de exemplo e envia por e-mail (Resend).
 *
 * Uso:
 *   npx vite-node --config vitest.config.ts scripts/send-contract-preview.ts [email1] [email2]
 *
 * Default: gsbarbosa180@gmail.com tribeiro81@gmail.com
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { sendContractAcceptanceEmail } from "../src/lib/legal/email";
import { renderLegalPdf } from "../src/lib/legal/pdf";
import { PLAN_LABELS } from "../src/lib/legal/constants";
import {
  renderContractDocument,
  renderDossierDocument,
} from "../src/lib/legal/templates";

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env) || !String(process.env[key] ?? "").trim()) {
      process.env[key] = value;
    }
  }
}

async function main() {
  loadEnvFile(resolve(process.cwd(), ".env.local"));
  loadEnvFile(resolve(process.cwd(), ".env"));

  const recipients = process.argv.slice(2).filter((item) => item.includes("@"));
  const emails =
    recipients.length > 0
      ? recipients
      : ["gsbarbosa180@gmail.com", "tribeiro81@gmail.com"];

  const acceptanceId = crypto.randomUUID();
  const acceptedAt = new Date();
  const fill = {
    acceptanceId,
    campaignName: "Campanha Demonstração — Vereador(a)",
    campaignCnpj: "12.345.678/0001-90",
    campaignAddress:
      "Av. Afonso Pena, 1000, Savassi, Belo Horizonte/MG — CEP 30130-005",
    financialResponsible: "Candidato(a) Demonstração",
    planId: "avancado" as const,
    ip: "203.0.113.42",
    userAgent: "preview-script/contract-sample (Mandato Digital)",
    acceptedAt,
  };

  const contractDoc = renderContractDocument(fill);
  const dossierDoc = renderDossierDocument(fill, contractDoc.hash);
  const [contractPdf, dossierPdf] = await Promise.all([
    renderLegalPdf(contractDoc),
    renderLegalPdf(dossierDoc),
  ]);

  const outDir = resolve(process.cwd(), "tmp/contract-preview");
  mkdirSync(outDir, { recursive: true });
  const contractPath = resolve(outDir, `${acceptanceId.slice(0, 8)}-contrato.pdf`);
  const dossierPath = resolve(outDir, `${acceptanceId.slice(0, 8)}-dossie.pdf`);
  writeFileSync(contractPath, contractPdf);
  writeFileSync(dossierPath, dossierPdf);

  console.log("PDFs gerados:");
  console.log(`  ${contractPath}`);
  console.log(`  ${dossierPath}`);
  console.log(`Referência: ${contractDoc.stamp.contractReference}`);
  console.log("");

  const attachments = [
    { filename: "contrato-mandato-digital.pdf", content: contractPdf },
    { filename: "dossie-transparencia-tse.pdf", content: dossierPdf },
  ];

  for (const email of emails) {
    const result = await sendContractAcceptanceEmail({
      to: email,
      campaignName: fill.campaignName,
      planName: PLAN_LABELS[fill.planId],
      acceptanceId,
      attachments,
    });
    if (result.sent) {
      console.log(`✔ E-mail enviado para ${email}`);
    } else {
      console.log(`✘ ${email}: ${result.reason}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
