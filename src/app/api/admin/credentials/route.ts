import { NextResponse } from "next/server";

import { isApiUser } from "@/lib/auth/api";
import { PLATFORM_CREDENTIAL_REGISTRY } from "@/lib/platform-credential-registry";
import { listPlatformCredentialStatuses } from "@/lib/platform-credentials";
import { requirePlatformAdminApiUser } from "@/lib/platform-admin-api";

export async function GET() {
  const userOrResponse = await requirePlatformAdminApiUser();
  if (!isApiUser(userOrResponse)) {
    return userOrResponse;
  }

  try {
    const statuses = await listPlatformCredentialStatuses();
    const services = statuses.map((status) => ({
      ...status,
      ...PLATFORM_CREDENTIAL_REGISTRY[status.serviceId],
    }));

    return NextResponse.json({ services });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Nao foi possivel carregar integracoes.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
