import { NextResponse } from "next/server";

import { apiRoute } from "@/lib/auth/api-route";
import { digitsOnly, isValidCpf } from "@/lib/br-input";
import { getSessionUser } from "@/lib/auth/session";
import { findRegistrationByCpf } from "@/lib/user-registration-storage";

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
    });
  });
}
