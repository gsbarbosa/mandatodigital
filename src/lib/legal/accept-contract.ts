import {
  assertElectoralCnpj,
  lookupCnpjBrasilApi,
} from "@/lib/legal/cnpj-natureza";
import { PLAN_LABELS, PLAN_PRICES_CENTS } from "@/lib/legal/constants";
import {
  saveContractAcceptance,
  storeComplianceBuffer,
  type ContractAcceptanceRow,
} from "@/lib/legal/contract-storage";
import { sendContractAcceptanceEmail } from "@/lib/legal/email";
import { renderLegalPdf } from "@/lib/legal/pdf";
import { extractClientIp, extractUserAgent } from "@/lib/legal/request-meta";
import {
  renderContractDocument,
  renderDossierDocument,
} from "@/lib/legal/templates";
import { auditorStorage } from "@/lib/auditor-storage";
import type { EarlyAccessPlanId } from "@/lib/early-access-types";
import { formatCampaignCnpj } from "@/lib/legal/cnpj-format";

export type ContractAcceptanceInput = {
  cnpj: string;
  accepted: true;
  campaignName: string;
  campaignAddress: string;
  financialResponsible: string;
  email: string;
  planId: EarlyAccessPlanId;
  party?: string;
};

export type ContractAcceptanceResult = {
  acceptanceId: string;
  cnpj: string;
  acceptedAt: string;
  naturezaJuridica: string;
  contractHash: string;
  dossierHash: string;
  contractPdfUrl: string;
  dossierPdfUrl: string;
  emailSent: boolean;
  emailSkipReason?: string;
};

export class ContractAcceptanceError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ContractAcceptanceError";
    this.status = status;
  }
}

/** Exige novo aceite se não houver contrato ou se o plano mudou. */
export function needsContractAcceptanceForCheckout(
  existing: Pick<ContractAcceptanceRow, "planId"> | null | undefined,
  planId: EarlyAccessPlanId,
): boolean {
  if (!existing) {
    return true;
  }
  return existing.planId !== planId;
}

export async function processContractAcceptance(input: {
  request: Request;
  ownerUserId: string;
  body: ContractAcceptanceInput;
}): Promise<ContractAcceptanceResult> {
  const { request, ownerUserId, body } = input;
  const digits = body.cnpj.replace(/\D/g, "");
  if (digits.length !== 14) {
    throw new ContractAcceptanceError("CNPJ invalido.", 400);
  }

  const lookup = await lookupCnpjBrasilApi(digits);
  try {
    assertElectoralCnpj(lookup);
  } catch (error) {
    throw new ContractAcceptanceError(
      error instanceof Error ? error.message : "CNPJ nao elegivel.",
      422,
    );
  }

  const acceptanceId = crypto.randomUUID();
  const acceptedAt = new Date();
  const ip = extractClientIp(request);
  const userAgent = extractUserAgent(request);
  const campaignCnpj = formatCampaignCnpj(digits);
  const campaignName = body.party?.trim()
    ? `${body.campaignName.trim()} (${body.party.trim()})`
    : body.campaignName.trim();

  const fill = {
    acceptanceId,
    campaignName,
    campaignCnpj,
    campaignAddress: body.campaignAddress.trim(),
    financialResponsible: body.financialResponsible.trim(),
    planId: body.planId,
    ip,
    userAgent,
    acceptedAt,
  };

  const contractDoc = renderContractDocument(fill);
  const dossierDoc = renderDossierDocument(fill, contractDoc.hash);
  const [contractPdf, dossierPdf] = await Promise.all([
    renderLegalPdf(contractDoc),
    renderLegalPdf(dossierDoc),
  ]);

  const [contractStored, dossierStored] = await Promise.all([
    storeComplianceBuffer({
      relativePath: `contracts/${acceptanceId}-contrato.pdf`,
      buffer: contractPdf,
      mimeType: "application/pdf",
    }),
    storeComplianceBuffer({
      relativePath: `contracts/${acceptanceId}-dossie.pdf`,
      buffer: dossierPdf,
      mimeType: "application/pdf",
    }),
  ]);

  let emailSent = false;
  let emailSkipReason: string | undefined;
  try {
    const mail = await sendContractAcceptanceEmail({
      to: body.email,
      campaignName: body.campaignName.trim(),
      planName: PLAN_LABELS[body.planId],
      acceptanceId,
      attachments: [
        { filename: "contrato-mandato-digital.pdf", content: contractPdf },
        { filename: "dossie-transparencia-tse.pdf", content: dossierPdf },
      ],
    });
    emailSent = mail.sent;
    if (!mail.sent) {
      emailSkipReason = mail.reason;
    }
  } catch (error) {
    emailSkipReason = error instanceof Error ? error.message : "Falha no e-mail.";
  }

  const row: ContractAcceptanceRow = {
    id: acceptanceId,
    ownerUserId,
    campaignName,
    campaignCnpj,
    campaignAddress: body.campaignAddress.trim(),
    financialResponsible: body.financialResponsible.trim(),
    email: body.email,
    planId: body.planId,
    amountCents: PLAN_PRICES_CENTS[body.planId],
    naturezaJuridica: lookup.naturezaJuridica,
    ip,
    userAgent,
    acceptedAt: acceptedAt.toISOString(),
    contractTextHash: contractDoc.hash,
    dossierTextHash: dossierDoc.hash,
    contractTemplateVersion: contractDoc.version,
    dossierTemplateVersion: dossierDoc.version,
    contractPdfPath: contractStored.storagePath,
    dossierPdfPath: dossierStored.storagePath,
    emailSent,
  };

  await saveContractAcceptance(row);

  await auditorStorage.appendAuditLog({
    eventType: "contract_acceptance",
    consentTextVersion: contractDoc.version,
    request,
    ip,
    userAgent,
    payload: {
      acceptanceId,
      cnpj: campaignCnpj,
      ip,
      userAgent,
      contractHash: contractDoc.hash,
      dossierHash: dossierDoc.hash,
      naturezaJuridica: lookup.naturezaJuridica,
      emailSent,
    },
  });

  return {
    acceptanceId,
    cnpj: campaignCnpj,
    acceptedAt: row.acceptedAt,
    naturezaJuridica: lookup.naturezaJuridica,
    contractHash: contractDoc.hash,
    dossierHash: dossierDoc.hash,
    contractPdfUrl: contractStored.publicUrl,
    dossierPdfUrl: dossierStored.publicUrl,
    emailSent,
    emailSkipReason,
  };
}
