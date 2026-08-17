import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api";
import { assertJobsWorkerAuthorized } from "@/lib/async-jobs-auth";
import { publishDueScheduledPosts } from "@/lib/distribution/publish-scheduled";
import { isDistributionEnabled } from "@/lib/feature-flags";

export const maxDuration = 300;

/**
 * Retoma os pacotes agendados cujo horário venceu (Cloud Scheduler → este
 * endpoint com o JOBS_WORKER_SHARED_SECRET). Sem ele o Graph, que não agenda,
 * deixaria o pacote parado em `scheduled` para sempre.
 */
export async function POST(request: Request) {
  try {
    await assertJobsWorkerAuthorized(request);

    if (!isDistributionEnabled()) {
      return NextResponse.json({ skipped: true, reason: "DISTRIBUTION_ENABLED=false" });
    }

    const body = (await request.json().catch(() => ({}))) as { limit?: number };
    const result = await publishDueScheduledPosts({
      limit: typeof body.limit === "number" ? body.limit : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
