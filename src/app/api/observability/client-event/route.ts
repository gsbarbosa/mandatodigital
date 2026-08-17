import { NextResponse } from "next/server";

import { recordAuditEventFireAndForget } from "@/lib/audit/record";
import { apiRoute } from "@/lib/auth/api-route";
import {
  clientObservabilityLogFields,
  parseClientObservabilityEvent,
} from "@/lib/observability/client-event";
import { appLog } from "@/lib/observability/log";

export async function POST(request: Request) {
  return apiRoute(async (repository) => {
    const parsed = parseClientObservabilityEvent(await request.json().catch(() => null));
    if (!parsed.ok) {
      return NextResponse.json({ message: parsed.message }, { status: 400 });
    }

    const dashboard = await repository.getDashboard();
    const profileId = dashboard.profile?.id ?? null;

    appLog(
      "client",
      parsed.event.event,
      {
        profileId,
        ...clientObservabilityLogFields(parsed.event),
      },
      "warn",
    );

    recordAuditEventFireAndForget({
      request,
      profileId,
      action: "client_error",
      payload: {
        event: parsed.event.event,
        surface: parsed.event.surface,
        stage: parsed.event.stage,
        message: parsed.event.message,
        avatarTrack: parsed.event.avatarTrack,
        voiceProvider: parsed.event.voiceProvider,
        hasVoiceAudioAsset: parsed.event.hasVoiceAudioAsset,
        hasVoiceId: parsed.event.hasVoiceId,
        hasElevenLabsVoiceId: parsed.event.hasElevenLabsVoiceId,
      },
    });

    return NextResponse.json({ ok: true });
  });
}
