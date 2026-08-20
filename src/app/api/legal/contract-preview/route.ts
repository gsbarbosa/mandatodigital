import { NextResponse } from "next/server";
import { z } from "zod";

import { apiRoute } from "@/lib/auth/api-route";
import { handleRouteError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth/session";
import {
  ContractAcceptanceError,
  deriveContractFields,
} from "@/lib/legal/accept-contract";
import { digitsOnlyCnpj } from "@/lib/legal/cnpj-format";
import {
  renderContractDocument,
  renderDossierDocument,
} from "@/lib/legal/templates";
import {
  checkDistributedRateLimit,
  CNPJ_LOOKUP_MAX_PER_DAY,
  CNPJ_LOOKUP_WINDOW_MS,
  cnpjLookupRateLimitKey,
} from "@/lib/rate-limit-firestore";

export const maxDuration = 60;

const bodySchema = z.object({
  planId: z.enum(["essencial", "avancado", "elite"]),
  cnpj: z.string().min(14),
  /** Fallback se a Receita nao trouxer razao social. */
  campaignName: z.string().optional(),
  /** Fallback se a Receita nao trouxer endereco. */
  campaignAddress: z.string().optional(),
  financialResponsible: z.string().min(2),
  party: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    return await apiRoute(async () => {
      const session = await getSessionUser();
      if (!session?.id) {
        return NextResponse.json({ message: "Nao autenticado." }, { status: 401 });
      }

      const limit = await checkDistributedRateLimit({
        key: cnpjLookupRateLimitKey(session.id),
        max: CNPJ_LOOKUP_MAX_PER_DAY,
        windowMs: CNPJ_LOOKUP_WINDOW_MS,
      });
      if (!limit.allowed) {
        return NextResponse.json(
          { message: "Limite diario de consultas de CNPJ atingido. Tente amanha." },
          { status: 429 },
        );
      }

      const body = bodySchema.parse(await request.json());
      const digits = digitsOnlyCnpj(body.cnpj);
      if (digits.length !== 14) {
        return NextResponse.json(
          { message: "Informe o CNPJ com 14 digitos." },
          { status: 400 },
        );
      }

      try {
        const derived = await deriveContractFields({
          cnpjDigits: digits,
          fallbackCampaignName: body.campaignName?.trim() || "",
          fallbackCampaignAddress: body.campaignAddress?.trim() || "",
          party: body.party,
        });

        if (!derived.campaignName.trim() || !derived.campaignAddress.trim()) {
          return NextResponse.json(
            {
              message:
                "Nome ou endereco ausentes. Complete os campos editaveis ou use um CNPJ com dados na Receita.",
            },
            { status: 400 },
          );
        }

        const fill = {
          acceptanceId: "PREVIEW",
          campaignName: derived.campaignName,
          campaignCnpj: derived.campaignCnpj,
          campaignAddress: derived.campaignAddress,
          financialResponsible: body.financialResponsible.trim(),
          planId: body.planId,
          ip: "0.0.0.0",
          userAgent: "contract-preview",
          acceptedAt: new Date(),
        };

        const contractDoc = renderContractDocument(fill);
        const dossierDoc = renderDossierDocument(fill, contractDoc.hash);

        return NextResponse.json({
          contractTitle: contractDoc.title,
          contractText: contractDoc.text,
          dossierTitle: dossierDoc.title,
          dossierText: dossierDoc.text,
          campaignNameLocked: derived.campaignNameLocked,
          campaignAddressLocked: derived.campaignAddressLocked,
          campaignName: derived.campaignName,
          campaignAddress: derived.campaignAddress,
          campaignCnpj: derived.campaignCnpj,
        });
      } catch (error) {
        if (error instanceof ContractAcceptanceError) {
          return NextResponse.json({ message: error.message }, { status: error.status });
        }
        throw error;
      }
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
