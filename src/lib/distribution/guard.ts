import { NextResponse } from "next/server";

import { isInstagramConfigured } from "@/lib/distribution/instagram-env";
import { isDistributionEnabled } from "@/lib/feature-flags";

export function distributionDisabledResponse() {
  return NextResponse.json(
    {
      message:
        "Publicador desligado. Defina DISTRIBUTION_ENABLED=true apos configurar o Instagram.",
    },
    { status: 503 },
  );
}

export function assertDistributionReady(): NextResponse | null {
  if (!isDistributionEnabled()) {
    return distributionDisabledResponse();
  }
  if (!isInstagramConfigured()) {
    return NextResponse.json(
      {
        message:
          "Instagram nao configurado. Defina INSTAGRAM_APP_ID/SECRET ou INSTAGRAM_ACCESS_TOKEN + INSTAGRAM_IG_USER_ID.",
      },
      { status: 503 },
    );
  }
  return null;
}
