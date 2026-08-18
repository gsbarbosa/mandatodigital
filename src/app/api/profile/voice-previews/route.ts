import { NextResponse } from "next/server";

import { apiRoute } from "@/lib/auth/api-route";
import { formatElevenLabsError } from "@/lib/elevenlabs";
import {
  getTrainingAssetPublicUrl,
  requireOwnedTrainingAsset,
  resolveAppBaseUrl,
} from "@/lib/training-asset-urls";
import {
  generateVoicePreviews,
  getVoiceSelectionWithFreshUrls,
  selectVoicePreview,
} from "@/lib/voice-preview";

export const maxDuration = 300;

export async function GET() {
  return apiRoute(async (repository) => {
    const dashboard = await repository.getDashboard();
    const profileId = dashboard.profile?.id ?? null;
    if (!profileId) {
      return NextResponse.json({ message: "Perfil não encontrado." }, { status: 400 });
    }

    const selection = await getVoiceSelectionWithFreshUrls(profileId);
    return NextResponse.json({ selection });
  });
}

export async function POST(request: Request) {
  return apiRoute(async (repository) => {
    const body = (await request.json().catch(() => ({}))) as {
      voiceAudioAssetId?: string;
      force?: boolean;
    };
    const voiceAudioAssetId = String(body.voiceAudioAssetId ?? "").trim();
    const force = body.force !== false;

    const dashboard = await repository.getDashboard();
    const profile = dashboard.profile;
    const profileId = profile?.id ?? null;
    if (!profileId) {
      return NextResponse.json({ message: "Perfil não encontrado." }, { status: 400 });
    }

    if (!voiceAudioAssetId) {
      return NextResponse.json(
        { message: "Informe voiceAudioAssetId." },
        { status: 400 },
      );
    }

    const assets = await repository.listTrainingAssetsForReference(profileId);
    const voiceResult = requireOwnedTrainingAsset(assets, {
      id: voiceAudioAssetId,
      role: "voice_audio",
      label: "áudio de voz",
    });
    if (!voiceResult.ok) {
      return NextResponse.json(
        { message: voiceResult.message },
        { status: voiceResult.status },
      );
    }

    const appBaseUrl = resolveAppBaseUrl(request);
    const voiceAudioUrl = await getTrainingAssetPublicUrl(
      voiceResult.asset,
      appBaseUrl,
    );
    const avatarName = String(profile?.fullName ?? "").trim() || "Avatar";

    try {
      const selection = await generateVoicePreviews({
        profileId,
        avatarName,
        voiceAudioAssetId,
        voiceAudioUrl,
        force,
      });
      return NextResponse.json({ selection });
    } catch (error) {
      return NextResponse.json(
        {
          message:
            formatElevenLabsError(error) ||
            "Não foi possível gerar as prévias de voz.",
        },
        { status: 502 },
      );
    }
  });
}

export async function PATCH(request: Request) {
  return apiRoute(async (repository) => {
    const body = (await request.json().catch(() => ({}))) as {
      previewId?: string;
    };
    const previewId = String(body.previewId ?? "").trim();

    const dashboard = await repository.getDashboard();
    const profileId = dashboard.profile?.id ?? null;
    if (!profileId) {
      return NextResponse.json({ message: "Perfil não encontrado." }, { status: 400 });
    }

    if (!previewId) {
      return NextResponse.json({ message: "Informe previewId." }, { status: 400 });
    }

    try {
      const selection = await selectVoicePreview({ profileId, previewId });
      return NextResponse.json({ selection });
    } catch (error) {
      return NextResponse.json(
        {
          message:
            error instanceof Error
              ? error.message
              : "Não foi possível salvar a escolha de voz.",
        },
        { status: 400 },
      );
    }
  });
}
