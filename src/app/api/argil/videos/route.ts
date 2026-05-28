import { NextResponse } from "next/server";

import { buildAvatarVideoTranscript } from "@/lib/avatar-video-script";
import { avatarVideoStorage } from "@/lib/avatar-video-storage";
import { apiRoute } from "@/lib/auth/api-route";
import {
  argilCreateAndRenderVideo,
  getArgilConfig,
  isArgilPlaceholderId,
  isArgilVideoReady,
  mapArgilVideoToGenerationUpdate,
} from "@/lib/argil";
import { resolveAppBaseUrl } from "@/lib/training-asset-urls";
import type { AvatarVideoGenerationStatus } from "@/lib/types";

function toGenerationStatus(status: string): AvatarVideoGenerationStatus {
  const allowed: AvatarVideoGenerationStatus[] = [
    "IDLE",
    "GENERATING_AUDIO",
    "GENERATING_VIDEO",
    "DONE",
    "FAILED",
  ];

  return allowed.includes(status as AvatarVideoGenerationStatus)
    ? (status as AvatarVideoGenerationStatus)
    : "GENERATING_VIDEO";
}

export async function GET() {
  return apiRoute(async (repository) => {
    const dashboard = await repository.getDashboard();
    const profileId = dashboard.profile?.id;

    if (!profileId) {
      return NextResponse.json({ generations: [] });
    }

    const generations = await avatarVideoStorage.listByProfileId(profileId);

    return NextResponse.json({ generations });
  });
}

export async function POST(request: Request) {
  return apiRoute(async (repository) => {
    const body = (await request.json()) as {
      topic?: string;
      transcript?: string;
      name?: string;
    };

    const topic = String(body.topic ?? "").trim();
    const explicitTranscript = String(body.transcript ?? "").trim();
    const name = String(body.name ?? "").trim() || undefined;

    if (!topic) {
      return NextResponse.json({ message: "Informe o tema do video." }, { status: 400 });
    }

    const dashboard = await repository.getDashboard();
    const profileId = dashboard.profile?.id ?? null;
    const profileAvatarId = dashboard.profile?.argilAvatarId?.trim() || undefined;
    const config = getArgilConfig();

    if (!config.dryRun && isArgilPlaceholderId(profileAvatarId)) {
      const trainingStatus = dashboard.profile?.avatarTrainingStatus ?? "";
      const hint =
        trainingStatus === "TRAINING_FAILED"
          ? " O treino do clone IA falhou. Veja a mensagem acima e tente Treinar novamente apos liberar vagas na Argil (app.argil.ai)."
          : " No Curador, envie foto e audio e clique em Treinar clone IA antes de gerar o video.";

      return NextResponse.json(
        { message: `Avatar ainda nao esta pronto.${hint}` },
        { status: 400 },
      );
    }

    const transcript =
      explicitTranscript ||
      (await buildAvatarVideoTranscript({
        topic,
        profile: dashboard.profile,
      }));

    const generation = await avatarVideoStorage.create({
      profileId,
      topic,
      transcript,
      name: name ?? `Avatar - ${topic}`,
      dryRun: config.dryRun,
      status: "IDLE",
    });

    const appBaseUrl = resolveAppBaseUrl(request);
    const callbackUrl = appBaseUrl.startsWith("https://")
      ? `${appBaseUrl}/api/argil/webhooks`
      : undefined;

    try {
      const result = await argilCreateAndRenderVideo({
        topic,
        transcript,
        name: generation.name,
        avatarId: profileAvatarId,
        voiceId: dashboard.profile?.argilVoiceId?.trim() || undefined,
        callbackUrl,
      });

      const videoUpdate = mapArgilVideoToGenerationUpdate(result.video);
      const updated = await avatarVideoStorage.update(generation.id, {
        ...videoUpdate,
        status: toGenerationStatus(videoUpdate.status),
      });

      const finalGeneration =
        result.dryRun && !isArgilVideoReady(updated)
          ? await avatarVideoStorage.update(updated.id, {
              status: "DONE",
              previewUrl: result.video.previewUrl ?? updated.previewUrl,
              videoUrl: "https://example.com/argil-video-dry-run.mp4",
            })
          : updated;

      return NextResponse.json(
        {
          dryRun: result.dryRun,
          generation: finalGeneration,
          video: result.video,
          debug: result.dryRun ? result.request : undefined,
        },
        { status: 201 },
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Nao foi possivel enviar o video para a Argil.";

      const failedGeneration = await avatarVideoStorage.update(generation.id, {
        status: "FAILED",
        errorMessage: message,
      });

      return NextResponse.json({ message, generation: failedGeneration }, { status: 502 });
    }
  });
}
