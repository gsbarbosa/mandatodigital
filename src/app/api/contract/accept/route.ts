import { NextResponse } from "next/server";
import { z } from "zod";

import { apiRoute } from "@/lib/auth/api-route";
import { handleRouteError } from "@/lib/api";
import {
  ContractAcceptanceError,
  processContractAcceptance,
} from "@/lib/legal/accept-contract";
import { resolveContractOwnerUserId } from "@/lib/legal/contract-storage";

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

export async function POST(request: Request) {
  try {
    return await apiRoute(async () => {
      const body = bodySchema.parse(await request.json());
      const ownerUserId = resolveContractOwnerUserId();
      if (!ownerUserId) {
        return NextResponse.json({ message: "Nao autenticado." }, { status: 401 });
      }

      try {
        const result = await processContractAcceptance({
          request,
          ownerUserId,
          body,
        });
        return NextResponse.json(result);
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
