import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api";
import {
  assertJobsWorkerAuthorized,
  parsePubSubPushBody,
} from "@/lib/async-jobs-auth";
import { processVoiceJob } from "@/lib/async-jobs-workers";

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    await assertJobsWorkerAuthorized(request);
    const body = await request.json().catch(() => ({}));
    const parsed = parsePubSubPushBody(body);
    const jobId =
      parsed?.jobId ||
      (typeof (body as { jobId?: string }).jobId === "string"
        ? (body as { jobId: string }).jobId.trim()
        : "");
    if (!jobId) {
      return NextResponse.json({ message: "jobId ausente." }, { status: 400 });
    }

    const job = await processVoiceJob(jobId);
    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      result: job.result,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
