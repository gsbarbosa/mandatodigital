import { GoogleAuth } from "google-auth-library";

import type { AsyncJobType } from "@/lib/async-jobs-types";

function getProjectId() {
  return (
    process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
    process.env.GCLOUD_PROJECT?.trim() ||
    process.env.GCP_PROJECT?.trim() ||
    "madatodigital"
  );
}

export function getPubSubTopicForJobType(type: AsyncJobType) {
  if (type === "seal_video") {
    return process.env.PUBSUB_TOPIC_SEAL?.trim() || "md-jobs-seal";
  }
  return process.env.PUBSUB_TOPIC_VOICE?.trim() || "md-jobs-voice";
}

export function isPubSubPublishEnabled() {
  const flag = process.env.PUBSUB_JOBS_ENABLED?.trim().toLowerCase();
  return flag === "1" || flag === "true" || flag === "on" || flag === "yes";
}

/** Publica no Pub/Sub ou retorna false (caller dispara worker local). */
export async function tryPublishAsyncJobMessage(input: {
  type: AsyncJobType;
  jobId: string;
}): Promise<boolean> {
  if (!isPubSubPublishEnabled()) {
    return false;
  }
  try {
    return await publishAsyncJobMessage(input);
  } catch (error) {
    console.error(
      `[async-jobs] Pub/Sub publish falhou job=${input.jobId}; fallback worker local`,
      error,
    );
    return false;
  }
}

/**
 * Publica { jobId } no topic. Retorna false se Pub/Sub desligado (caller deve
 * disparar worker local).
 */
export async function publishAsyncJobMessage(input: {
  type: AsyncJobType;
  jobId: string;
}): Promise<boolean> {
  if (!isPubSubPublishEnabled()) {
    return false;
  }

  const projectId = getProjectId();
  const topic = getPubSubTopicForJobType(input.type);
  const url = `https://pubsub.googleapis.com/v1/projects/${projectId}/topics/${topic}:publish`;

  const auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/pubsub"],
  });
  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();
  const token = typeof accessToken === "string" ? accessToken : accessToken?.token;
  if (!token) {
    throw new Error("Nao foi possivel obter access token para Pub/Sub.");
  }

  const body = {
    messages: [
      {
        data: Buffer.from(JSON.stringify({ jobId: input.jobId, type: input.type })).toString(
          "base64",
        ),
        attributes: {
          jobId: input.jobId,
          type: input.type,
        },
      },
    ],
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Pub/Sub publish falhou (${response.status}): ${text.slice(0, 400)}`);
  }

  return true;
}
