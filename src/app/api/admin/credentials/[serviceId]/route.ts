import { NextResponse } from "next/server";

import { isApiUser } from "@/lib/auth/api";
import { auditorStorage } from "@/lib/auditor-storage";
import {
  isPlatformCredentialId,
  PLATFORM_CREDENTIAL_REGISTRY,
} from "@/lib/platform-credential-registry";
import { platformCredentialStorage } from "@/lib/platform-credential-storage";
import { invalidatePlatformCredentialCache } from "@/lib/platform-credentials";
import { requirePlatformAdminApiUser } from "@/lib/platform-admin-api";

type RouteContext = {
  params: Promise<{ serviceId: string }>;
};

export async function PUT(request: Request, context: RouteContext) {
  const userOrResponse = await requirePlatformAdminApiUser();
  if (!isApiUser(userOrResponse)) {
    return userOrResponse;
  }

  const { serviceId: rawServiceId } = await context.params;
  if (!isPlatformCredentialId(rawServiceId)) {
    return NextResponse.json({ message: "Servico invalido." }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as { apiKey?: string };
  const apiKey = body.apiKey?.trim() ?? "";
  if (apiKey.length < 8) {
    return NextResponse.json(
      { message: "Informe uma chave valida (minimo 8 caracteres)." },
      { status: 400 },
    );
  }

  try {
    const maskedHint = await platformCredentialStorage.upsertCredential({
      serviceId: rawServiceId,
      plaintext: apiKey,
      updatedByEmail: userOrResponse.email,
    });

    invalidatePlatformCredentialCache(rawServiceId);

    try {
      await auditorStorage.appendAuditLog({
        eventType: "platform_credential_updated",
        payload: {
          serviceId: rawServiceId,
          label: PLATFORM_CREDENTIAL_REGISTRY[rawServiceId].label,
          maskedHint,
          updatedByEmail: userOrResponse.email,
        },
      });
    } catch {
      // audit opcional — nao bloqueia salvar credencial
    }

    return NextResponse.json({
      ok: true,
      maskedHint,
      message: `${PLATFORM_CREDENTIAL_REGISTRY[rawServiceId].label} salvo.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nao foi possivel salvar a chave.";
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const userOrResponse = await requirePlatformAdminApiUser();
  if (!isApiUser(userOrResponse)) {
    return userOrResponse;
  }

  const { serviceId: rawServiceId } = await context.params;
  if (!isPlatformCredentialId(rawServiceId)) {
    return NextResponse.json({ message: "Servico invalido." }, { status: 400 });
  }

  try {
    await platformCredentialStorage.deleteCredential(rawServiceId);
    invalidatePlatformCredentialCache(rawServiceId);

    try {
      await auditorStorage.appendAuditLog({
        eventType: "platform_credential_removed",
        payload: {
          serviceId: rawServiceId,
          label: PLATFORM_CREDENTIAL_REGISTRY[rawServiceId].label,
          updatedByEmail: userOrResponse.email,
        },
      });
    } catch {
      // audit opcional
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nao foi possivel remover a chave.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
