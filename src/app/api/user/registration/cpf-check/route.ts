import { NextResponse } from "next/server";

import { apiRoute } from "@/lib/auth/api-route";
import { digitsOnly, isValidCpf } from "@/lib/br-input";
import { getSessionUser } from "@/lib/auth/session";
import {
  checkDistributedRateLimit,
  TSE_PREFILL_LOOKUP_MAX_PER_DAY,
  TSE_PREFILL_LOOKUP_WINDOW_MS,
  tsePrefillRateLimitKey,
} from "@/lib/rate-limit-firestore";
import { findTseCandidateByCpf } from "@/lib/tse-candidates-storage";
import type { TseCandidatePrefill } from "@/lib/tse-candidates";
import { findRegistrationByCpf } from "@/lib/user-registration-storage";

/**
 * Busca o CPF na base TSE 2026 para o prefill do cadastro.
 *
 * Silencioso por definição: qualquer falha (rate limit, Firestore fora,
 * CPF ausente da base) devolve `null` e o cadastro segue normalmente. O
 * usuário nunca descobre se o CPF está ou não na base.
 */
async function resolvePrefill(
  cpf: string,
  ownerUserId: string,
): Promise<TseCandidatePrefill | null> {
  try {
    const limit = await checkDistributedRateLimit({
      key: tsePrefillRateLimitKey(ownerUserId),
      max: TSE_PREFILL_LOOKUP_MAX_PER_DAY,
      windowMs: TSE_PREFILL_LOOKUP_WINDOW_MS,
    });
    if (!limit.allowed) {
      return null;
    }
    return await findTseCandidateByCpf(cpf);
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  return apiRoute(async () => {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ message: "Nao autenticado." }, { status: 401 });
    }

    const cpf = digitsOnly(new URL(request.url).searchParams.get("cpf") ?? "");
    if (cpf.length !== 11) {
      return NextResponse.json({
        valid: false,
        available: false,
        message: "Informe os 11 digitos do CPF.",
      });
    }

    if (!isValidCpf(cpf)) {
      return NextResponse.json({
        valid: false,
        available: false,
        message: "CPF invalido.",
      });
    }

    const existing = await findRegistrationByCpf({
      cpf,
      excludeOwnerUserId: session.id,
    });

    if (existing) {
      return NextResponse.json({
        valid: true,
        available: false,
        message: "Ja existe uma conta cadastrada com este CPF.",
      });
    }

    return NextResponse.json({
      valid: true,
      available: true,
      message: null,
      prefill: await resolvePrefill(cpf, session.id),
    });
  });
}
