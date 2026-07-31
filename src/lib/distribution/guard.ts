import { NextResponse } from "next/server";

import { isAyrshareConfigured } from "@/lib/distribution/ayrshare-client";
import { isDistributionEnabled } from "@/lib/feature-flags";

export function distributionDisabledResponse() {
  return NextResponse.json(
    {
      message:
        "Distribuidor desligado. Defina DISTRIBUTION_ENABLED=true apos configurar Ayrshare.",
    },
    { status: 503 },
  );
}

export function assertDistributionReady(): NextResponse | null {
  if (!isDistributionEnabled()) {
    return distributionDisabledResponse();
  }
  if (!isAyrshareConfigured()) {
    return NextResponse.json(
      { message: "AYRSHARE_API_KEY nao configurada no servidor." },
      { status: 503 },
    );
  }
  return null;
}
