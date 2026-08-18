import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api";
import { assertJobsWorkerAuthorized } from "@/lib/async-jobs-auth";
import { flushDueSuggestedReplies } from "@/lib/outbound/outbound-autosend";

export const maxDuration = 120;

/**
 * Envia sugestões da Marina cujo prazo de 3 min venceu (Cloud Scheduler a
 * cada 1 min → este endpoint com o JOBS_WORKER_SHARED_SECRET).
 */
export async function POST(request: Request) {
  try {
    await assertJobsWorkerAuthorized(request);
    const result = await flushDueSuggestedReplies();
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
