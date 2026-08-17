import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api";
import { assertJobsWorkerAuthorized } from "@/lib/async-jobs-auth";
import { refreshExpiringInstagramTokens } from "@/lib/distribution/instagram-token-refresh";
import { isDistributionEnabled } from "@/lib/feature-flags";

export const maxDuration = 300;

/**
 * Renova os tokens de longa duração do Instagram perto do vencimento
 * (Cloud Scheduler diário → este endpoint com o JOBS_WORKER_SHARED_SECRET).
 */
export async function POST(request: Request) {
  try {
    await assertJobsWorkerAuthorized(request);

    if (!isDistributionEnabled()) {
      return NextResponse.json({ skipped: true, reason: "DISTRIBUTION_ENABLED=false" });
    }

    const body = (await request.json().catch(() => ({}))) as {
      windowDays?: number;
      limit?: number;
    };
    const result = await refreshExpiringInstagramTokens({
      windowDays: typeof body.windowDays === "number" ? body.windowDays : undefined,
      limit: typeof body.limit === "number" ? body.limit : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
