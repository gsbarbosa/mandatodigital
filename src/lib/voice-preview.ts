import {
  DEFAULT_VOICE_SETTINGS,
  elevenLabsDeleteVoice,
  elevenLabsTextToSpeech,
  formatElevenLabsError,
  type ElevenLabsVoiceSettings,
} from "@/lib/elevenlabs";
import { withElevenLabsIvcSlot } from "@/lib/elevenlabs-ivc-lock";
import { COLLECTIONS, col } from "@/lib/firebase/collections";
import { appLog, appLogError, startTimer } from "@/lib/observability/log";
import {
  buildElevenLabsPersistentVoiceName,
  resolveElevenLabsVoiceId,
} from "@/lib/voice-provider-resolve";
import {
  deleteVoicePreviewAudio,
  refreshVoicePreviewSignedUrl,
  storeVoicePreviewAudio,
} from "@/lib/voice-preview-storage";
import type {
  ProfileVoiceSelection,
  VoicePreviewItem,
} from "@/lib/voice-preview-types";

export type { ProfileVoiceSelection, VoicePreviewItem } from "@/lib/voice-preview-types";

/** Trecho curto e estável para A/B das prévias (mesmo texto em todas). */
export const VOICE_PREVIEW_SCRIPT =
  "Olá! Eu estou gravando este áudio para treinar a minha voz na plataforma Mandato Digital. O nosso objetivo aqui é garantir que a minha comunicação chegue a cada cidadão com clareza, verdade e muita energia.";

export type VoicePreviewVariant = {
  id: string;
  label: string;
  description: string;
  voiceSettings: ElevenLabsVoiceSettings;
};

/** Três estilos sobre o mesmo clone — diferença perceptível sem 3 slots. */
export const VOICE_PREVIEW_VARIANTS: VoicePreviewVariant[] = [
  {
    id: "natural",
    label: "Natural",
    description: "Equilíbrio entre estabilidade e expressividade.",
    voiceSettings: { ...DEFAULT_VOICE_SETTINGS },
  },
  {
    id: "firme",
    label: "Firme",
    description: "Mais estável e consistente — tom de discurso.",
    voiceSettings: {
      stability: 0.72,
      similarity_boost: 0.85,
      style: 0.05,
      use_speaker_boost: true,
    },
  },
  {
    id: "expressiva",
    label: "Expressiva",
    description: "Mais variação de entonação e energia.",
    voiceSettings: {
      stability: 0.28,
      similarity_boost: 0.75,
      style: 0.35,
      use_speaker_boost: true,
    },
  },
];

function selectionRef(profileId: string) {
  return col(COLLECTIONS.profileVoiceSelections).doc(profileId);
}

export async function getProfileVoiceSelection(
  profileId: string,
): Promise<ProfileVoiceSelection | null> {
  const id = profileId.trim();
  if (!id) {
    return null;
  }
  const snap = await selectionRef(id).get();
  if (!snap.exists) {
    return null;
  }
  return snap.data() as ProfileVoiceSelection;
}

/** Seleção ativa só se ainda for do mesmo asset de áudio. */
export async function getActiveVoiceSelectionForAsset(input: {
  profileId: string;
  voiceAudioAssetId: string;
}): Promise<ProfileVoiceSelection | null> {
  const selection = await getProfileVoiceSelection(input.profileId);
  if (!selection) {
    return null;
  }
  if (selection.voiceAudioAssetId !== input.voiceAudioAssetId.trim()) {
    return null;
  }
  if (!selection.elevenLabsVoiceId.trim()) {
    return null;
  }
  return selection;
}

export async function getVoiceSelectionWithFreshUrls(
  profileId: string,
): Promise<ProfileVoiceSelection | null> {
  const selection = await getProfileVoiceSelection(profileId);
  if (!selection) {
    return null;
  }

  const previews = await Promise.all(
    selection.previews.map(async (preview) => {
      const fresh = await refreshVoicePreviewSignedUrl(preview.storagePath);
      return {
        ...preview,
        audioUrl: fresh ?? preview.audioUrl,
      };
    }),
  );

  return { ...selection, previews };
}

async function deletePreviewFiles(previews: VoicePreviewItem[]) {
  await Promise.all(
    previews.map(async (preview) => {
      try {
        await deleteVoicePreviewAudio(preview.storagePath);
      } catch {
        // best-effort
      }
    }),
  );
}

async function deleteVoiceBestEffort(voiceId: string) {
  const id = voiceId.trim();
  if (!id) {
    return;
  }
  try {
    await elevenLabsDeleteVoice(id);
  } catch (error) {
    appLogError("voice", "voice_preview_delete_failed", error, { voiceId: id });
  }
}

/** Reusa prévias só no mesmo asset e quando o caller não pediu retreino. */
export function shouldReuseExistingVoicePreviews(input: {
  existing: ProfileVoiceSelection | null;
  voiceAudioAssetId: string;
  force?: boolean;
}) {
  if (input.force) {
    return false;
  }
  const existing = input.existing;
  if (!existing) {
    return false;
  }
  if (existing.voiceAudioAssetId !== input.voiceAudioAssetId.trim()) {
    return false;
  }
  if (!existing.previews.length || !existing.elevenLabsVoiceId.trim()) {
    return false;
  }
  return true;
}

/** Invalida seleção ao trocar o áudio de origem (libera slot + limpa Storage). */
export async function invalidateProfileVoiceSelection(profileId: string) {
  const existing = await getProfileVoiceSelection(profileId);
  if (!existing) {
    return;
  }
  await deletePreviewFiles(existing.previews);
  await deleteVoiceBestEffort(existing.elevenLabsVoiceId);
  await selectionRef(profileId).delete().catch(() => undefined);
}

export async function generateVoicePreviews(input: {
  profileId: string;
  avatarName: string;
  voiceAudioAssetId: string;
  voiceAudioUrl: string;
  /** Default true: POST de “Gerar prévias” sempre reclona o áudio atual. */
  force?: boolean;
}): Promise<ProfileVoiceSelection> {
  const profileId = input.profileId.trim();
  const voiceAudioAssetId = input.voiceAudioAssetId.trim();
  const voiceAudioUrl = input.voiceAudioUrl.trim();
  const force = input.force !== false;
  if (!profileId || !voiceAudioAssetId || !voiceAudioUrl) {
    throw new Error("Dados incompletos para gerar prévias de voz.");
  }

  const elapsed = startTimer();
  appLog("voice", "voice_preview_generate_started", {
    profileId,
    voiceAudioAssetId,
    force,
  });

  const existing = await getProfileVoiceSelection(profileId);
  if (
    shouldReuseExistingVoicePreviews({ existing, voiceAudioAssetId, force })
  ) {
    const withUrls = await getVoiceSelectionWithFreshUrls(profileId);
    if (withUrls) {
      appLog("voice", "voice_preview_generate_reused", {
        profileId,
        voiceAudioAssetId,
        durationMs: elapsed(),
      });
      return withUrls;
    }
  }

  if (existing) {
    await deletePreviewFiles(existing.previews);
    await deleteVoiceBestEffort(existing.elevenLabsVoiceId);
  }

  try {
    const selection = await withElevenLabsIvcSlot(async () => {
      const voiceName = buildElevenLabsPersistentVoiceName(
        input.avatarName,
        voiceAudioAssetId,
      );
      const resolved = await resolveElevenLabsVoiceId({
        requestedVoiceId: null,
        voiceName,
        audioUrl: voiceAudioUrl,
        forceReclone: true,
      });

      const previews: VoicePreviewItem[] = [];
      for (const variant of VOICE_PREVIEW_VARIANTS) {
        const mp3 = await elevenLabsTextToSpeech({
          voiceId: resolved.voiceId,
          text: VOICE_PREVIEW_SCRIPT,
          voiceSettings: variant.voiceSettings,
        });
        const stored = await storeVoicePreviewAudio({
          profileId,
          voiceAudioAssetId,
          previewId: variant.id,
          buffer: mp3,
        });
        previews.push({
          id: variant.id,
          label: variant.label,
          description: variant.description,
          storagePath: stored.storagePath,
          audioUrl: stored.audioUrl,
          voiceSettings: variant.voiceSettings,
        });
      }

      const now = new Date().toISOString();
      const row: ProfileVoiceSelection = {
        profileId,
        voiceAudioAssetId,
        elevenLabsVoiceId: resolved.voiceId,
        selectedPreviewId: existing?.selectedPreviewId ?? null,
        previews,
        previewScript: VOICE_PREVIEW_SCRIPT,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };

      // Se a prévia selecionada não existe mais na lista, limpa.
      if (
        row.selectedPreviewId &&
        !row.previews.some((p) => p.id === row.selectedPreviewId)
      ) {
        row.selectedPreviewId = null;
      }

      await selectionRef(profileId).set(row);
      return row;
    });

    appLog("voice", "voice_preview_generate_completed", {
      profileId,
      voiceAudioAssetId,
      previewCount: selection.previews.length,
      durationMs: elapsed(),
    });
    return selection;
  } catch (error) {
    appLogError("voice", "voice_preview_generate_failed", error, {
      profileId,
      voiceAudioAssetId,
      durationMs: elapsed(),
      message: formatElevenLabsError(error),
    });
    throw error;
  }
}

export async function selectVoicePreview(input: {
  profileId: string;
  previewId: string;
}): Promise<ProfileVoiceSelection> {
  const profileId = input.profileId.trim();
  const previewId = input.previewId.trim();
  const selection = await getProfileVoiceSelection(profileId);
  if (!selection) {
    throw new Error("Gere as prévias de voz antes de escolher uma opção.");
  }
  if (!selection.previews.some((preview) => preview.id === previewId)) {
    throw new Error("Prévia de voz inválida.");
  }

  const updated: ProfileVoiceSelection = {
    ...selection,
    selectedPreviewId: previewId,
    updatedAt: new Date().toISOString(),
  };
  await selectionRef(profileId).set(updated);

  appLog("voice", "voice_preview_selected", {
    profileId,
    previewId,
    voiceAudioAssetId: selection.voiceAudioAssetId,
  });

  return updated;
}

export function getSelectedVoiceSettings(
  selection: ProfileVoiceSelection | null | undefined,
): ElevenLabsVoiceSettings | null {
  if (!selection?.selectedPreviewId) {
    return null;
  }
  const preview = selection.previews.find(
    (item) => item.id === selection.selectedPreviewId,
  );
  return preview?.voiceSettings ?? null;
}

/** Preferências de voz persistente para geração de vídeo. */
export async function resolvePersistedVoiceForGeneration(input: {
  profileId: string;
  voiceAudioAssetId: string;
  requestedElevenLabsVoiceId?: string | null;
}) {
  const selection = await getActiveVoiceSelectionForAsset({
    profileId: input.profileId,
    voiceAudioAssetId: input.voiceAudioAssetId,
  });
  const persistVoice = Boolean(
    selection?.elevenLabsVoiceId?.trim() && selection.selectedPreviewId,
  );
  return {
    persistVoice,
    requestedElevenLabsVoiceId:
      (persistVoice ? selection!.elevenLabsVoiceId : null) ||
      input.requestedElevenLabsVoiceId?.trim() ||
      null,
    voiceSettings: getSelectedVoiceSettings(selection),
    selectedPreviewId: selection?.selectedPreviewId ?? null,
  };
}
