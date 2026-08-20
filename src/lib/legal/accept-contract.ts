import {
  assertElectoralCnpj,
  formatAddressFromLookup,
  lookupCnpjBrasilApi,
  type CnpjLookupResult,
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
  /** Usado só se a Receita não trouxer razão social. */
  campaignNameFallback?: string;
  /** Usado só se a Receita não trouxer endereço fiscal completo. */
  campaignAddressFallback?: string;
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

export type DerivedContractFields = {
  campaignName: string;
  campaignAddress: string;
  campaignCnpj: string;
  naturezaJuridica: string;
  campaignNameLocked: boolean;
  campaignAddressLocked: boolean;
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

export async function deriveContractFields(input: {
  cnpjDigits: string;
  fallbackCampaignName: string;
  fallbackCampaignAddress: string;
  party?: string;
}): Promise<DerivedContractFields> {
  let lookup: CnpjLookupResult;
  try {
    lookup = await lookupCnpjBrasilApi(input.cnpjDigits);
  } catch (error) {
    throw new ContractAcceptanceError(
      error instanceof Error
        ? error.message
        : "Falha ao consultar CNPJ na Receita Federal.",
      502,
    );
  }
  try {
    assertElectoralCnpj(lookup);
  } catch (error) {
    throw new ContractAcceptanceError(
      error instanceof Error ? error.message : "CNPJ nao elegivel.",
      422,
    );
  }

  const razaoSocial = lookup.razaoSocial.trim();
  const lookedUpAddress = formatAddressFromLookup(lookup);
  const campaignNameLocked = Boolean(razaoSocial);
  const campaignNameBase = razaoSocial || input.fallbackCampaignName.trim();
  // Partido só no fallback (nome do cadastro). Razão social da Receita já é nominal.
  const campaignName =
    !campaignNameLocked && input.party?.trim()
      ? `${campaignNameBase} (${input.party.trim()})`
      : campaignNameBase;

  return {
    campaignName,
    campaignAddress: lookedUpAddress || input.fallbackCampaignAddress.trim(),
    campaignCnpj: formatCampaignCnpj(input.cnpjDigits),
    naturezaJuridica: lookup.naturezaJuridica,
    campaignNameLocked,
    campaignAddressLocked: Boolean(lookedUpAddress),
  };
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

  const derived = await deriveContractFields({
    cnpjDigits: digits,
    fallbackCampaignName: body.campaignNameFallback?.trim() || "",
    fallbackCampaignAddress: body.campaignAddressFallback?.trim() || "",
    party: body.party,
  });

  if (!derived.campaignName.trim()) {
    throw new ContractAcceptanceError(
      "Nome da campanha ausente. Informe o nome ou use um CNPJ com razao social na Receita.",
      400,
    );
  }
  if (!derived.campaignAddress.trim()) {
    throw new ContractAcceptanceError(
      "Endereco da campanha ausente. Informe o endereco ou use um CNPJ com endereco fiscal na Receita.",
      400,
    );
  }

  const financialResponsible = body.financialResponsible.trim();
  if (financialResponsible.length < 2) {
    throw new ContractAcceptanceError("Informe o responsavel financeiro.", 400);
  }

  const acceptanceId = crypto.randomUUID();
  const acceptedAt = new Date();
  const ip = extractClientIp(request);
  const userAgent = extractUserAgent(request);

  const fill = {
    acceptanceId,
    campaignName: derived.campaignName,
    campaignCnpj: derived.campaignCnpj,
    campaignAddress: derived.campaignAddress,
    financialResponsible,
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
      campaignName: derived.campaignName,
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
    campaignName: derived.campaignName,
    campaignCnpj: derived.campaignCnpj,
    campaignAddress: derived.campaignAddress,
    financialResponsible,
    email: body.email,
    planId: body.planId,
    amountCents: PLAN_PRICES_CENTS[body.planId],
    naturezaJuridica: derived.naturezaJuridica,
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
      cnpj: derived.campaignCnpj,
      ip,
      userAgent,
      contractHash: contractDoc.hash,
      dossierHash: dossierDoc.hash,
      naturezaJuridica: derived.naturezaJuridica,
      campaignNameLocked: derived.campaignNameLocked,
      campaignAddressLocked: derived.campaignAddressLocked,
      emailSent,
    },
  });

  return {
    acceptanceId,
    cnpj: derived.campaignCnpj,
    acceptedAt: row.acceptedAt,
    naturezaJuridica: derived.naturezaJuridica,
    contractHash: contractDoc.hash,
    dossierHash: dossierDoc.hash,
    contractPdfUrl: contractStored.publicUrl,
    dossierPdfUrl: dossierStored.publicUrl,
    emailSent,
    emailSkipReason,
  };
}
