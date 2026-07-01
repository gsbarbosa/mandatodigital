import { NextResponse } from "next/server";

import { isApiUser } from "@/lib/auth/api";
import {
  isPlatformCredentialId,
  PLATFORM_CREDENTIAL_REGISTRY,
} from "@/lib/platform-credential-registry";
import { platformCredentialStorage } from "@/lib/platform-credential-storage";
import { testPlatformCredential } from "@/lib/platform-credential-test";
import { requirePlatformAdminApiUser } from "@/lib/platform-admin-api";

type RouteContext = {
  params: Promise<{ serviceId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const userOrResponse = await requirePlatformAdminApiUser();
  if (!isApiUser(userOrResponse)) {
    return userOrResponse;
  }

  const { serviceId: rawServiceId } = await context.params;
  if (!isPlatformCredentialId(rawServiceId)) {
    return NextResponse.json({ message: "Servico invalido." }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as { apiKey?: string };
  const result = await testPlatformCredential(rawServiceId, body.apiKey);

  try {
    await platformCredentialStorage.recordTestResult({
      serviceId: rawServiceId,
      status: result.ok ? "ok" : "error",
      message: result.message,
    });
  } catch {
    // registro de teste opcional
  }

  return NextResponse.json({
    ok: result.ok,
    message: result.message,
    label: PLATFORM_CREDENTIAL_REGISTRY[rawServiceId].label,
  });
}
