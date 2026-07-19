import { OAuth2Client } from "google-auth-library";

/**
 * Auth para push Pub/Sub / workers internos.
 * Aceita:
 * - Authorization: Bearer <JOBS_WORKER_SHARED_SECRET>
 * - x-jobs-worker-secret: <secret>
 * - OIDC do Pub/Sub (Bearer JWT Google) quando audience estiver setado
 */
export async function assertJobsWorkerAuthorized(request: Request) {
  const secret = process.env.JOBS_WORKER_SHARED_SECRET?.trim();
  const header = request.headers.get("authorization")?.trim() ?? "";
  const bearer = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : "";
  const custom = request.headers.get("x-jobs-worker-secret")?.trim() ?? "";

  if (secret && (bearer === secret || custom === secret)) {
    return;
  }

  const audience =
    process.env.JOBS_WORKER_OIDC_AUDIENCE?.trim() ||
    process.env.APP_BASE_URL?.trim() ||
    "";

  if (bearer && bearer.includes(".") && audience) {
    try {
      const client = new OAuth2Client();
      await client.verifyIdToken({
        idToken: bearer,
        audience,
      });
      return;
    } catch {
      // fall through
    }
  }

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JOBS_WORKER_SHARED_SECRET nao configurado.");
    }
    return;
  }

  throw new Error("Worker nao autorizado.");
}

export function parsePubSubPushBody(body: unknown): { jobId: string } | null {
  if (!body || typeof body !== "object") {
    return null;
  }
  const message = (body as { message?: { data?: string; attributes?: Record<string, string> } })
    .message;
  if (!message) {
    const direct = (body as { jobId?: string }).jobId?.trim();
    return direct ? { jobId: direct } : null;
  }
  if (message.attributes?.jobId?.trim()) {
    return { jobId: message.attributes.jobId.trim() };
  }
  if (message.data) {
    try {
      const decoded = JSON.parse(Buffer.from(message.data, "base64").toString("utf8")) as {
        jobId?: string;
      };
      if (decoded.jobId?.trim()) {
        return { jobId: decoded.jobId.trim() };
      }
    } catch {
      return null;
    }
  }
  return null;
}
