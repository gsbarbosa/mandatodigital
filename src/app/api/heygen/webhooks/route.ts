import { NextResponse } from "next/server";

import { appLog } from "@/lib/observability/log";

// Webhook opcional (HeyGen): neste MVP o Curador-v2 faz polling.
export async function POST(request: Request) {
  const body = await request.text();
  let eventType: string | null = null;
  let videoId: string | null = null;
  let status: string | null = null;

  try {
    const json = body ? (JSON.parse(body) as Record<string, unknown>) : null;
    eventType =
      (typeof json?.event_type === "string" && json.event_type) ||
      (typeof json?.event === "string" && json.event) ||
      null;
    const data =
      json?.data && typeof json.data === "object"
        ? (json.data as Record<string, unknown>)
        : json;
    videoId =
      (typeof data?.video_id === "string" && data.video_id) ||
      (typeof data?.id === "string" && data.id) ||
      null;
    status = (typeof data?.status === "string" && data.status) || null;
  } catch {
    // payload não-JSON
  }

  appLog("heygen", "webhook_received", {
    eventType,
    videoId,
    status,
    bodyBytes: body.length,
  });

  return NextResponse.json({ ok: true, received: Boolean(body) });
}
