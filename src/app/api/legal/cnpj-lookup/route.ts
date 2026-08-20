import { NextResponse } from "next/server";

import { apiRoute } from "@/lib/auth/api-route";
import { handleRouteError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth/session";
import { digitsOnlyCnpj, formatCampaignCnpj } from "@/lib/legal/cnpj-format";
import {
  formatAddressFromLookup,
  isAllowedElectoralNatureza,
  lookupCnpjBrasilApi,
} from "@/lib/legal/cnpj-natureza";
import {
  checkDistributedRateLimit,
  CNPJ_LOOKUP_MAX_PER_DAY,
  CNPJ_LOOKUP_WINDOW_MS,
  cnpjLookupRateLimitKey,
} from "@/lib/rate-limit-firestore";

export async function GET(request: Request) {
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

      const digits = digitsOnlyCnpj(new URL(request.url).searchParams.get("cnpj") ?? "");
      if (digits.length !== 14) {
        return NextResponse.json(
          { message: "Informe o CNPJ com 14 digitos." },
          { status: 400 },
        );
      }

      let lookup;
      try {
        lookup = await lookupCnpjBrasilApi(digits);
      } catch (error) {
        return NextResponse.json(
          {
            message:
              error instanceof Error
                ? error.message
                : "Falha ao consultar CNPJ na Receita Federal.",
          },
          { status: 502 },
        );
      }

      const eligible = isAllowedElectoralNatureza(lookup.naturezaJuridica);
      const razaoSocial = lookup.razaoSocial.trim() || null;
      const address = formatAddressFromLookup(lookup);

      return NextResponse.json({
        ok: true,
        cnpj: formatCampaignCnpj(digits),
        eligible,
        naturezaJuridica: lookup.naturezaJuridica || null,
        razaoSocial,
        address,
        message: eligible
          ? null
          : `CNPJ com natureza juridica "${lookup.naturezaJuridica || "desconhecida"}" nao e elegivel. Aceitos: Comite Financeiro ou Candidato a Cargo Politico Eletivo.`,
      });
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
