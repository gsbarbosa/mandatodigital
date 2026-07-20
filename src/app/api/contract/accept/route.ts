import { NextResponse } from "next/server";
import { z } from "zod";

import { apiRoute } from "@/lib/auth/api-route";
import { handleRouteError } from "@/lib/api";
import {
  assertElectoralCnpj,
  lookupCnpjBrasilApi,
} from "@/lib/legal/cnpj-natureza";
import {
  PLAN_LABELS,
  PLAN_PRICES_CENTS,
} from "@/lib/legal/constants";
import {
  resolveContractOwnerUserId,
  saveContractAcceptance,
  storeComplianceBuffer,
} from "@/lib/legal/contract-storage";
import { sendContractAcceptanceEmail } from "@/lib/legal/email";
import { renderLegalPdf } from "@/lib/legal/pdf";
import {
  extractClientIp,
  extractUserAgent,
} from "@/lib/legal/request-meta";
import {
  renderContractDocument,
  renderDossierDocument,
} from "@/lib/legal/templates";
import { auditorStorage } from "@/lib/auditor-storage";

export const maxDuration = 60;

const bodySchema = z.object({
  cnpj: z.string().min(14),
  accepted: z.literal(true),
  campaignName: z.string().min(2),
  campaignAddress: z.string().min(5),
  financialResponsible: z.string().min(2),
  email: z.string().email(),
  planId: z.enum(["essencial", "avancado", "elite"]),
  party: z.string().optional(),
});

function formatCnpj(digits: string) {
  const d = digits.replace(/\D/g, "").slice(0, 14);
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

export async function POST(request: Request) {
  try {
    return await apiRoute(async () => {
      const body = bodySchema.parse(await request.json());
      const digits = body.cnpj.replace(/\D/g, "");
      if (digits.length !== 14) {
        return NextResponse.json({ message: "CNPJ invalido." }, { status: 400 });
      }

      const lookup = await lookupCnpjBrasilApi(digits);
      try {
        assertElectoralCnpj(lookup);
      } catch (error) {
        return NextResponse.json(
          { message: error instanceof Error ? error.message : "CNPJ nao elegivel." },
          { status: 422 },
        );
      }

      const acceptanceId = crypto.randomUUID();
      const acceptedAt = new Date();
      const ip = extractClientIp(request);
      const userAgent = extractUserAgent(request);
      const campaignCnpj = formatCnpj(digits);
      const campaignName =
        body.party?.trim()
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

      const row = {
        id: acceptanceId,
        ownerUserId: resolveContractOwnerUserId(),
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

      return NextResponse.json({
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
      });
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
