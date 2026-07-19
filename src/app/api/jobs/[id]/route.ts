import { NextResponse } from "next/server";

import { apiRoute } from "@/lib/auth/api-route";
import { handleRouteError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth/session";
import { toDatabaseOwnerUserId } from "@/lib/owner-user-id";
import { getAsyncJob } from "@/lib/async-jobs-storage";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    return await apiRoute(async () => {
      const { id } = await context.params;
      const sessionUser = await getSessionUser();
      if (!sessionUser?.id) {
        return NextResponse.json({ message: "Nao autenticado." }, { status: 401 });
      }

      const job = await getAsyncJob(id);
      if (!job) {
        return NextResponse.json({ message: "Job nao encontrado." }, { status: 404 });
      }

      const ownerUserId = toDatabaseOwnerUserId(sessionUser.id);
      if (job.ownerUserId !== ownerUserId) {
        return NextResponse.json({ message: "Job nao encontrado." }, { status: 404 });
      }

      return NextResponse.json({
        jobId: job.id,
        type: job.type,
        status: job.status,
        result: job.result,
        lastError: job.lastError || undefined,
        attempts: job.attempts,
        createdAt: job.createdAt,
        finishedAt: job.finishedAt,
      });
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
