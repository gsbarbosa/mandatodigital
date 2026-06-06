"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  archetypeOptions,
  voiceToneOptions,
} from "@/lib/constants";
import { useProductApp } from "@/components/product/provider";
import {
  AVATAR_TYPE_BY_TRACK,
  CaricatureAssetPreview,
  MAX_SCRIPT_WORDS,
  PersonaCriativoIcon,
  PersonaTag,
  ProductionTemplateOption,
  TwinLookMedia,
  avatarTypeToTrack,
  buildCuradorContextPayload,
  countWords,
  formatStatus,
  parseJsonOrText,
  productionTemplateLabel,
  selectSingleTagValue,
  type AvatarTrack,
  type PrivateTwinLook,
  type ProductionSource,
  type ProductionTemplate,
} from "@/components/product/persona-shared";
import {
  formatHeyGenPurgeFailureMessage,
  formatProviderLimitHint,
  readCuradorHeygenPrefs,
  sanitizeProviderFacingMessage,
  writeCuradorHeygenPrefs,
} from "@/lib/curador-heygen-prefs";
import { pickLatestCaricatureForVariant } from "@/lib/caricature-asset-variant";
import {
  isConsentApproved,
  isTwinLookReadyForVideo,
  isUsableRecordedDigitalTwin,
  trainingPhaseFromTwinLook,
  trainingPhaseMessage,
  type HeyGenTrainingPhase,
  type TwinLookDisplayMeta,
} from "@/lib/heygen-twin-display";
import { fetchHeygenApi } from "@/lib/heygen-client-override";
import { SentinelContextPreview } from "@/components/product/sentinel-suggestion-row";
import {
  buildSentinelBriefingForCriativo,
  getMockSentinelSuggestionById,
  type MockSentinelSuggestion,
} from "@/lib/sentinel-mock-suggestions";
import type { ProfileTrainingAsset } from "@/lib/types";

type TrainingBannerState =
  | "hidden"
  | "started"
  | "awaiting_consent"
  | "processing"
  | "ready"
  | "failed"
  | "completed";

type CreativeFormState = {
  topic: string;
  personaArchetypes: string[];
  voiceTones: string[];
};

const EMPTY_CREATIVE_FORM: CreativeFormState = {
  topic: "",
  personaArchetypes: [],
  voiceTones: [],
};

function getCriativoGateReason(input: {
  spectrum: string;
  hasVoiceAudio: boolean;
  twinReady: boolean;
  hasCaricaturePair: boolean;
}): string | null {
  if (!input.spectrum.trim()) {
    return "Defina o posicionamento ideológico no Curador.";
  }
  if (!input.hasVoiceAudio) {
    return "Envie o áudio de voz no Curador.";
  }
  if (!input.twinReady && !input.hasCaricaturePair) {
    return "Prepare o gêmeo digital ou as caricaturas no Curador.";
  }
  return null;
}

export function CriativoPageV2() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [creativeForm, setCreativeForm] = useState<CreativeFormState>(EMPTY_CREATIVE_FORM);
  const [sentinelSuggestion, setSentinelSuggestion] =
    useState<MockSentinelSuggestion | null>(null);
  const [isTraining, setIsTraining] = useState(false);
  const [trainingError, setTrainingError] = useState<string | null>(null);
  const [trainingInfo, setTrainingInfo] = useState<string | null>(null);
  const [heygenAvatarId, setHeygenAvatarId] = useState<string>("");
  const [heygenAvatarGroupId, setHeygenAvatarGroupId] = useState<string>("");
  const [heygenVoiceId, setHeygenVoiceId] = useState<string>("");
  const [heygenConsentUrl, setHeygenConsentUrl] = useState<string>("");
  const [selectedCaricatureAssetId, setSelectedCaricatureAssetId] = useState<string>("");
  const [avatarTrack, setAvatarTrack] = useState<AvatarTrack>("realistic");
  const [productionSource, setProductionSource] = useState<ProductionSource>("train_new");
  const restoredHeygenPrefsRef = useRef(false);
  const [trainingStarted, setTrainingStarted] = useState(false);
  const [trainingBannerState, setTrainingBannerState] =
    useState<TrainingBannerState>("hidden");
  const [isGeneratingCaricature, setIsGeneratingCaricature] = useState(false);
  const [caricatureGenerateStep, setCaricatureGenerateStep] = useState<
    "idle" | "editorial" | "mascot_3d"
  >("idle");
  const [caricatureChoicePending, setCaricatureChoicePending] = useState(false);
  const [caricatureError, setCaricatureError] = useState<string | null>(null);
  const [caricatureInfo, setCaricatureInfo] = useState<string | null>(null);
  const [caricaturePreviewUrl, setCaricaturePreviewUrl] = useState<string | null>(null);
  const [isLoadingLooks, setIsLoadingLooks] = useState(false);
  const [isDeletingTwinGroup, setIsDeletingTwinGroup] = useState(false);
  const [deleteTwinError, setDeleteTwinError] = useState<string | null>(null);
  const [deleteTwinInfo, setDeleteTwinInfo] = useState<string | null>(null);
  const [looksError, setLooksError] = useState<string | null>(null);
  const autoLoadedLooksRef = useRef(false);
  const [privateTwinLooks, setPrivateTwinLooks] = useState<PrivateTwinLook[]>([]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [videoStatus, setVideoStatus] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [captionUrl, setCaptionUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [freePrompt, setFreePrompt] = useState<string>("");
  const [useFreePromptAsTranscript, setUseFreePromptAsTranscript] = useState(false);
  const [scriptDraft, setScriptDraft] = useState("");
  const [scriptTopicSnapshot, setScriptTopicSnapshot] = useState("");
  const [scriptApproved, setScriptApproved] = useState(false);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);
  const autoPollStartedRef = useRef(false);
  const twinPollActiveRef = useRef(false);
  const autoSyncTwinOnLoadRef = useRef(false);
  const [isPollingTwinTraining, setIsPollingTwinTraining] = useState(false);
  const [twinPreviewOpen, setTwinPreviewOpen] = useState(false);

  const {
    profile,
    profileForm,
    setProfileForm,
    saveProfile,
    isSavingProfile,
    trainingAssets,
    uploadTrainingAssets,
    isUploadingVoiceAudioAsset,
    isUploadingAvatarImageAsset,
    isUploadingTrainingVideoAsset,
    appendTrainingAssets,
  } = useProductApp();

  const assetReferenceId = profile?.id ?? profileForm.id ?? null;
  const visibleTrainingAssets = useMemo(
    () =>
      assetReferenceId
        ? trainingAssets.filter(
            (asset) =>
              asset.profileId === assetReferenceId ||
              asset.draftProfileId === assetReferenceId,
          )
        : [],
    [assetReferenceId, trainingAssets],
  );

  const avatarImageAssets = useMemo(
    () => visibleTrainingAssets.filter((asset) => asset.trainingRole === "avatar_image"),
    [visibleTrainingAssets],
  );

  const voiceAudioAssets = useMemo(
    () => visibleTrainingAssets.filter((asset) => asset.trainingRole === "voice_audio"),
    [visibleTrainingAssets],
  );

  const caricatureAssets = useMemo(
    () => visibleTrainingAssets.filter((asset) => asset.trainingRole === "avatar_caricature"),
    [visibleTrainingAssets],
  );

  const sortedCaricatureAssets = useMemo(
    () =>
      [...caricatureAssets].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [caricatureAssets],
  );

  const profileIdForPrefs = profile?.id ?? profileForm.id ?? null;

  const trainingVideoAssets = useMemo(
    () =>
      visibleTrainingAssets.filter(
        (asset) =>
          asset.trainingRole === "dataset" &&
          String(asset.mimeType ?? "").toLowerCase().startsWith("video/"),
      ),
    [visibleTrainingAssets],
  );

  const latestTrainingVideo = useMemo(
    () =>
      [...trainingVideoAssets].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )[0] ?? null,
    [trainingVideoAssets],
  );

  const formatBytes = useCallback((bytes: number) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return "";
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(1)} MB`;
  }, []);

  const usableTwinLooks = useMemo(
    () => privateTwinLooks.filter(isUsableRecordedDigitalTwin),
    [privateTwinLooks],
  );
  const hasExistingTwin = !isLoadingLooks && usableTwinLooks.length > 0;
  const hasAnyTwinOnPlatform =
    !isLoadingLooks &&
    (privateTwinLooks.length > 0 ||
      Boolean(heygenAvatarGroupId.trim()) ||
      Boolean(heygenConsentUrl.trim()));
  const hasCaricatureAssets = caricatureAssets.length > 0;
  /** Caricato pronto para produção: voz clonada na plataforma + imagem caricata no perfil. */
  const hasUsableCaricaturePerson =
    Boolean(heygenVoiceId.trim()) && hasCaricatureAssets;
  /** Voz caricatura já clonada na plataforma (único caso em que "Refazer caricatura" faz sentido). */
  const showRefazerCaricatura = Boolean(heygenVoiceId.trim());
  const canTrainRealistic = Boolean(latestTrainingVideo && voiceAudioAssets[0]);
  const canStartTwinTraining = !hasAnyTwinOnPlatform && canTrainRealistic;
  const editorialCaricature = useMemo(
    () => pickLatestCaricatureForVariant(visibleTrainingAssets, "editorial"),
    [visibleTrainingAssets],
  );
  const mascotCaricature = useMemo(
    () => pickLatestCaricatureForVariant(visibleTrainingAssets, "mascot_3d"),
    [visibleTrainingAssets],
  );
  const hasCaricaturePairReady = Boolean(editorialCaricature && mascotCaricature);
  const canGenerateCaricaturePair = Boolean(avatarImageAssets[0]);
  const selectedTwinLook =
    usableTwinLooks.find((look) => look.id === heygenAvatarId) ??
    usableTwinLooks[0] ??
    null;
  const linkedTwinLook = useMemo(() => {
    const preferredId = heygenAvatarId.trim();
    const preferredGroupId = heygenAvatarGroupId.trim();
    return (
      privateTwinLooks.find((look) => look.id === preferredId) ??
      (preferredGroupId
        ? privateTwinLooks.find(
            (look) => String(look.group_id ?? "").trim() === preferredGroupId,
          )
        : null) ??
      selectedTwinLook
    );
  }, [privateTwinLooks, heygenAvatarId, heygenAvatarGroupId, selectedTwinLook]);
  const productionTwinLook = selectedTwinLook ?? linkedTwinLook;
  const twinReadyForVideo =
    avatarTrack !== "realistic" ||
    (productionSource === "use_existing" &&
      Boolean(heygenAvatarId.trim()) &&
      Boolean(productionTwinLook)) ||
    trainingBannerState === "ready" ||
    isTwinLookReadyForVideo(productionTwinLook) ||
    isTwinLookReadyForVideo(linkedTwinLook) ||
    (Boolean(heygenAvatarId.trim()) &&
      isConsentApproved(
        productionTwinLook?.consentStatus ?? linkedTwinLook?.consentStatus,
      ) &&
      trainingBannerState !== "awaiting_consent");

  const activeProductionTemplate = useMemo((): ProductionTemplate => {
    if (avatarTrack === "realistic") {
      return "digital_twin";
    }
    if (mascotCaricature && selectedCaricatureAssetId === mascotCaricature.id) {
      return "caricature_mascot_3d";
    }
    return "caricature_editorial";
  }, [avatarTrack, mascotCaricature, selectedCaricatureAssetId]);

  const digitalTwinTemplateReady =
    Boolean(heygenAvatarId.trim()) && Boolean(productionTwinLook) && twinReadyForVideo;

  const canGenerateVideo =
    avatarTrack === "realistic"
      ? Boolean(heygenAvatarId) && twinReadyForVideo
      : hasCaricaturePairReady &&
        Boolean(selectedCaricatureAssetId.trim()) &&
        Boolean(voiceAudioAssets[0]);

  const scriptWordCount = countWords(scriptDraft);
  const canProduceContent =
    canGenerateVideo &&
    (useFreePromptAsTranscript
      ? freePrompt.trim().length > 0
      : scriptApproved && scriptDraft.trim().length > 0);

  function getGenerateDisabledReason(): string | null {
    if (isGenerating) {
      return null;
    }
    if (isPollingTwinTraining && !twinReadyForVideo) {
      return "Sincronizando com a HeyGen. Aguarde ou clique em Sincronizar com HeyGen.";
    }
    if (avatarTrack === "realistic" && !heygenAvatarId.trim()) {
      return "O gêmeo digital ainda não está disponível. Aguarde o treinamento ou use Refazer gêmeo digital.";
    }
    if (avatarTrack === "realistic" && !twinReadyForVideo) {
      return "O gêmeo selecionado ainda não está liberado para vídeo nesta sessão.";
    }
    if (avatarTrack === "caricature" && !selectedCaricatureAssetId.trim()) {
      return "Selecione uma caricatura para gerar o vídeo.";
    }
    if (avatarTrack === "caricature" && !voiceAudioAssets[0]) {
      return "Envie o áudio de voz no Curador.";
    }
    if (avatarTrack === "caricature" && !hasCaricaturePairReady) {
      return "Gere as caricaturas no Curador.";
    }
    if (avatarTrack === "caricature" && isTraining) {
      return "Preparando a voz na plataforma. Aguarde.";
    }
    if (useFreePromptAsTranscript) {
      return freePrompt.trim() ? null : "Preencha o Prompt livre (modo teste) ou desmarque a opção.";
    }
    if (!scriptDraft.trim()) {
      return "Gere ou escreva um roteiro na seção de aprovação.";
    }
    if (!scriptApproved) {
      return "Clique em Aprovar Roteiro antes de gerar o conteúdo.";
    }
    return null;
  }

  const generateDisabledReason = getGenerateDisabledReason();

  const archetypeHelperText =
    "Selecione no máximo um arquétipo e um tom. Se não escolher, a IA utiliza a identidade comunicacional identificada nas mídias enviadas.";

  function selectAvatarTrack(track: AvatarTrack) {
    const hasExisting =
      track === "realistic" ? hasExistingTwin : hasUsableCaricaturePerson;
    setAvatarTrack(track);
    setProductionSource(hasExisting ? "use_existing" : "train_new");
    setTrainingStarted(false);
    setTrainingBannerState("hidden");
    setProfileForm((current) => ({
      ...current,
      avatarType: AVATAR_TYPE_BY_TRACK[track],
    }));
  }

  function showUserError(setter: (value: string | null) => void, error: unknown) {
    const raw = error instanceof Error ? error.message : "Ocorreu um erro inesperado.";
    setter(sanitizeProviderFacingMessage(raw));
  }

  function syncTrainingBannerFromTwinLook(look: TwinLookDisplayMeta | null) {
    if (!look) {
      return;
    }
    if (isTwinLookReadyForVideo(look)) {
      setTrainingBannerState("ready");
      setHeygenConsentUrl("");
      return;
    }
    const phase = trainingPhaseFromTwinLook(look);
    if (!phase) {
      return;
    }
    applyTrainingPhase(phase);
    if (phase === "ready") {
      setHeygenConsentUrl("");
    }
  }

  function applyTrainingPhase(phase: HeyGenTrainingPhase | "completed") {
    if (phase === "ready") {
      setTrainingBannerState("ready");
      return;
    }
    if (phase === "awaiting_consent") {
      setTrainingBannerState("awaiting_consent");
      return;
    }
    if (phase === "processing") {
      setTrainingBannerState("processing");
      return;
    }
    if (phase === "failed") {
      setTrainingBannerState("failed");
      return;
    }
    setTrainingBannerState("completed");
  }

  function selectProductionTemplate(template: ProductionTemplate) {
    if (template === "digital_twin") {
      selectAvatarTrack("realistic");
      persistHeygenPrefs({ avatarTrack: "realistic" });
      return;
    }

    if (template === "caricature_editorial" && editorialCaricature) {
      selectAvatarTrack("caricature");
      selectCaricatureForVideo(editorialCaricature.id);
      return;
    }

    if (template === "caricature_mascot_3d" && mascotCaricature) {
      selectAvatarTrack("caricature");
      selectCaricatureForVideo(mascotCaricature.id);
    }
  }

  function invalidateScriptApproval() {
    setScriptApproved(false);
  }

  function persistHeygenPrefs(overrides?: {
    heygenAvatarId?: string;
    heygenVoiceId?: string;
    heygenAvatarGroupId?: string;
    lastCaricatureAssetId?: string;
    avatarTrack?: AvatarTrack;
    productionSource?: ProductionSource;
  }) {
    if (!profileIdForPrefs) {
      return;
    }

    writeCuradorHeygenPrefs(profileIdForPrefs, {
      heygenAvatarId: overrides?.heygenAvatarId ?? heygenAvatarId,
      heygenVoiceId: overrides?.heygenVoiceId ?? heygenVoiceId,
      heygenAvatarGroupId: overrides?.heygenAvatarGroupId ?? heygenAvatarGroupId,
      lastCaricatureAssetId:
        overrides?.lastCaricatureAssetId ??
        selectedCaricature?.id ??
        sortedCaricatureAssets[0]?.id,
      avatarTrack: overrides?.avatarTrack ?? avatarTrack,
      productionSource: overrides?.productionSource ?? productionSource,
    });
  }

  async function parseJsonOrText<T>(response: Response): Promise<T> {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      return (await response.json()) as T;
    }
    return { message: await response.text() } as T;
  }

  async function pollVideo(id: string) {
    const pollIntervalMs = 5000;
    const maxAttempts = 180;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const response = await fetchHeygenApi(`/api/heygen/videos/${encodeURIComponent(id)}`);
      const payload = await parseJsonOrText<{
        status?: string;
        videoUrl?: string;
        captionUrl?: string;
        errorMessage?: string;
        message?: string;
      }>(response);

      if (!response.ok) {
        throw new Error(payload.message || "Nao foi possivel consultar o status do video.");
      }

      setVideoStatus(payload.status ?? null);
      setVideoUrl(payload.videoUrl?.trim() || null);
      setCaptionUrl(payload.captionUrl?.trim() || null);

      if (payload.status === "failed") {
        throw new Error(
          sanitizeProviderFacingMessage(
            payload.errorMessage || "A geracao do video falhou.",
          ),
        );
      }

      if (payload.status === "completed" && payload.videoUrl?.trim()) {
        return {
          status: payload.status,
          videoUrl: payload.videoUrl.trim(),
          captionUrl: payload.captionUrl?.trim() || "",
        };
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error("O video ainda esta em processamento. Atualize a pagina em alguns minutos.");
  }

  async function persistCreativeProject(input: {
    heygenVideoId: string;
    videoUrl: string;
    captionUrl: string;
    status: "ready" | "failed";
    errorMessage?: string;
  }) {
    const response = await fetch("/api/creative-projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: creativeForm.topic,
        personaArchetypes: creativeForm.personaArchetypes,
        voiceTones: creativeForm.voiceTones,
        scriptDraft,
        scriptApproved,
        freePrompt,
        useFreePrompt: useFreePromptAsTranscript,
        avatarTrack,
        caricatureAssetId: selectedCaricatureAssetId,
        heygenVideoId: input.heygenVideoId,
        videoUrl: input.videoUrl,
        captionUrl: input.captionUrl,
        status: input.status,
        errorMessage: input.errorMessage ?? "",
      }),
    });

    const payload = await parseJsonOrText<{ message?: string }>(response);
    if (!response.ok) {
      throw new Error(payload.message || "Nao foi possivel salvar o criativo.");
    }
  }

  async function handleGenerateScript() {
    setScriptError(null);
    const topic = creativeForm.topic.trim();
    if (!topic) {
      setScriptError("Informe o tema do video antes de gerar o roteiro.");
      return;
    }

    setIsGeneratingScript(true);
    invalidateScriptApproval();

    try {
      const response = await fetchHeygenApi("/api/heygen/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          curadorContext: {
            ...buildCuradorContextPayload({
              spectrum: profileForm.spectrum,
              glossaryTerms: profileForm.glossaryTerms,
              personaArchetypes: creativeForm.personaArchetypes,
              voiceTones: creativeForm.voiceTones,
              avatarType: profileForm.avatarType,
            }),
            ...(sentinelSuggestion
              ? { sentinelBriefing: buildSentinelBriefingForCriativo(sentinelSuggestion) }
              : {}),
          },
        }),
      });
      const payload = await parseJsonOrText<{ transcript?: string; message?: string }>(response);

      if (!response.ok) {
        throw new Error(payload.message || "Nao foi possivel gerar o roteiro.");
      }

      const transcript = payload.transcript?.trim() ?? "";
      if (!transcript) {
        throw new Error("A IA nao retornou um roteiro valido.");
      }

      setScriptDraft(transcript);
      setScriptTopicSnapshot(topic);
    } catch (error) {
      setScriptError(error instanceof Error ? error.message : "Erro ao gerar roteiro.");
    } finally {
      setIsGeneratingScript(false);
    }
  }

  function handleApproveScript() {
    setScriptError(null);
    const draft = scriptDraft.trim();
    if (!draft) {
      setScriptError("Gere ou escreva um roteiro antes de aprovar.");
      return;
    }
    if (countWords(draft) > MAX_SCRIPT_WORDS) {
      setScriptError(`O roteiro deve ter no maximo ${MAX_SCRIPT_WORDS} palavras (~1 minuto).`);
      return;
    }
    if (scriptTopicSnapshot !== creativeForm.topic.trim()) {
      setScriptError("O tema mudou. Gere o roteiro novamente antes de aprovar.");
      return;
    }
    setScriptApproved(true);
  }

  function selectCaricatureForVideo(assetId: string, previewUrl?: string | null) {
    setSelectedCaricatureAssetId(assetId);
    setCaricatureChoicePending(false);
    if (previewUrl) {
      setCaricaturePreviewUrl(previewUrl);
    }
    persistHeygenPrefs({ lastCaricatureAssetId: assetId, avatarTrack: "caricature" });
  }

  type HeyGenTrainPayload = {
    avatarId?: string;
    avatarGroupId?: string | null;
    voiceId?: string;
    consentUrl?: string | null;
    consentStatus?: string | null;
    avatarGroupStatus?: string | null;
    trainingPhase?: HeyGenTrainingPhase;
    message?: string;
  };

  async function requestHeyGenTrain(input?: {
    action?: "create" | "sync";
    persistProfile?: boolean;
    mode?: "digital_twin" | "caricature";
  }): Promise<HeyGenTrainPayload> {
    const trainMode = input?.mode ?? (avatarTrack === "realistic" ? "digital_twin" : "caricature");
    const trainAction =
      input?.action ??
      (trainMode === "digital_twin" && heygenAvatarGroupId.trim() ? "sync" : "create");
    const isTwinSync = trainAction === "sync" && trainMode === "digital_twin";

    if (input?.persistProfile !== false) {
      await saveProfile({ allowDraftDefaults: true, silent: true });
    }

    const response = await fetchHeygenApi("/api/heygen/train", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        avatarName: profileForm.fullName || "Mandato Digital Avatar",
        mode: trainMode,
        action: trainAction,
        avatarGroupId: isTwinSync ? heygenAvatarGroupId : undefined,
        avatarLookId: isTwinSync ? heygenAvatarId : undefined,
        voiceId: heygenVoiceId.trim() || undefined,
        caricatureAssetId:
          trainMode === "caricature" ? selectedCaricatureAssetId : undefined,
      }),
    });
    const payload = await parseJsonOrText<HeyGenTrainPayload & { message?: string }>(
      response,
    );

    if (!response.ok) {
      throw new Error(payload.message || "Nao foi possivel treinar o avatar.");
    }

    return payload;
  }

  function applyHeyGenTrainPayload(payload: HeyGenTrainPayload) {
    const nextAvatarId = payload.avatarId?.trim() || "";
    const nextGroupId = String(payload.avatarGroupId ?? "").trim();
    if (nextAvatarId) {
      setHeygenAvatarId(nextAvatarId);
    }
    if (nextGroupId) {
      setHeygenAvatarGroupId(nextGroupId);
    }
    setHeygenVoiceId(payload.voiceId?.trim() || heygenVoiceId);
    setHeygenConsentUrl(String(payload.consentUrl ?? "").trim());
    setTrainingInfo(payload.message?.trim() || null);

    if (payload.trainingPhase) {
      applyTrainingPhase(payload.trainingPhase);
    }

    persistHeygenPrefs({
      heygenAvatarId: nextAvatarId || heygenAvatarId,
      heygenVoiceId: payload.voiceId?.trim() || heygenVoiceId,
      heygenAvatarGroupId: nextGroupId || heygenAvatarGroupId,
      lastCaricatureAssetId: selectedCaricatureAssetId || sortedCaricatureAssets[0]?.id,
    });

    return { nextAvatarId, nextGroupId };
  }

  function shouldAutoPollTwinTraining(phase?: HeyGenTrainingPhase) {
    return (
      Boolean(heygenAvatarGroupId.trim()) &&
      phase === "processing" &&
      !isTwinLookReadyForVideo(linkedTwinLook)
    );
  }

  async function pollHeyGenTwinUntilReady() {
    if (twinPollActiveRef.current) {
      return;
    }
    if (!heygenAvatarGroupId.trim()) {
      return;
    }

    twinPollActiveRef.current = true;
    setIsPollingTwinTraining(true);
    setTrainingError(null);

    const pollIntervalMs = 5000;
    const maxAttempts = 120;

    try {
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const payload = await requestHeyGenTrain({
          action: "sync",
          persistProfile: false,
          mode: "digital_twin",
        });
        const { nextAvatarId, nextGroupId } = applyHeyGenTrainPayload(payload);
        const phase = payload.trainingPhase;

        if (phase === "ready") {
          setTrainingBannerState("ready");
          await loadPrivateDigitalTwinLooks({
            preferredAvatarId: nextAvatarId || heygenAvatarId,
            preferredGroupId: nextGroupId || heygenAvatarGroupId,
          });
          return;
        }

        if (
          isTwinLookReadyForVideo(
            {
              id: nextAvatarId || heygenAvatarId,
              consentStatus: payload.consentStatus,
              groupStatus: payload.avatarGroupStatus,
            },
            {
              consentStatus: payload.consentStatus,
              groupStatus: payload.avatarGroupStatus,
            },
          )
        ) {
          setTrainingBannerState("ready");
          await loadPrivateDigitalTwinLooks({
            preferredAvatarId: nextAvatarId || heygenAvatarId,
            preferredGroupId: nextGroupId || heygenAvatarGroupId,
          });
          return;
        }

        if (phase === "failed") {
          throw new Error(trainingPhaseMessage("failed"));
        }

        if (attempt < maxAttempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        }
      }

      throw new Error(
        "O treinamento do gêmeo ainda está em processamento. Aguarde alguns minutos e atualize a página.",
      );
    } catch (error) {
      showUserError(setTrainingError, error);
      await loadPrivateDigitalTwinLooks({
        preferredAvatarId: heygenAvatarId,
        preferredGroupId: heygenAvatarGroupId,
      });
    } finally {
      twinPollActiveRef.current = false;
      setIsPollingTwinTraining(false);
    }
  }

  async function handleTrainHeyGen(options?: {
    mode?: "digital_twin" | "caricature";
  }): Promise<string | undefined> {
    const trainMode = options?.mode ?? (avatarTrack === "realistic" ? "digital_twin" : "caricature");
    setTrainingError(null);
    setIsTraining(true);
    setTrainingStarted(true);

    const isTwinSync =
      trainMode === "digital_twin" && Boolean(heygenAvatarGroupId.trim());

    if (!isTwinSync) {
      setHeygenConsentUrl("");
    }

    try {
      const payload = await requestHeyGenTrain({
        action: isTwinSync ? "sync" : "create",
        mode: trainMode,
      });
      const { nextAvatarId, nextGroupId } = applyHeyGenTrainPayload(payload);

      if (trainMode === "digital_twin") {
        await loadPrivateDigitalTwinLooks({
          preferredAvatarId: nextAvatarId || heygenAvatarId,
          preferredGroupId: nextGroupId || heygenAvatarGroupId,
        });
      }

      if (trainMode === "digital_twin" && shouldAutoPollTwinTraining(payload.trainingPhase)) {
        void pollHeyGenTwinUntilReady();
      }

      return payload.voiceId?.trim() || undefined;
    } catch (error) {
      setTrainingStarted(false);
      showUserError(setTrainingError, error);
      throw error;
    } finally {
      setIsTraining(false);
    }
  }


  function renderProductionTemplateSelector() {
    return (
      <div className="persona-form-group">
        <label className="persona-label">Modelo para este vídeo</label>
        <p className="persona-helper-text">
          Escolha qual template usar na geração do conteúdo.
        </p>
        <div
          className="persona-production-template-grid persona-top-gap"
          role="radiogroup"
          aria-label="Template para gerar o vídeo"
        >
          <ProductionTemplateOption
            label={productionTemplateLabel("digital_twin")}
            isSelected={activeProductionTemplate === "digital_twin"}
            isAvailable={digitalTwinTemplateReady}
            unavailableHint="Gere o gêmeo no Curador"
            onSelect={() => selectProductionTemplate("digital_twin")}
            preview={
              productionTwinLook ? (
                <TwinLookMedia look={productionTwinLook} />
              ) : (
                <span className="persona-twin-preview-placeholder" />
              )
            }
          />
          <ProductionTemplateOption
            label={productionTemplateLabel("caricature_editorial")}
            isSelected={activeProductionTemplate === "caricature_editorial"}
            isAvailable={Boolean(editorialCaricature)}
            unavailableHint="Gere no Curador"
            onSelect={() => selectProductionTemplate("caricature_editorial")}
            preview={
              editorialCaricature ? (
                <CaricatureAssetPreview assetId={editorialCaricature.id} />
              ) : (
                <span className="persona-twin-preview-placeholder" />
              )
            }
          />
          <ProductionTemplateOption
            label={productionTemplateLabel("caricature_mascot_3d")}
            isSelected={activeProductionTemplate === "caricature_mascot_3d"}
            isAvailable={Boolean(mascotCaricature)}
            unavailableHint="Gere no Curador"
            onSelect={() => selectProductionTemplate("caricature_mascot_3d")}
            preview={
              mascotCaricature ? (
                <CaricatureAssetPreview assetId={mascotCaricature.id} />
              ) : (
                <span className="persona-twin-preview-placeholder" />
              )
            }
          />
        </div>
      </div>
    );
  }

  function renderTrainingStartControl(
    canStart: boolean,
    onStart: () => Promise<void>,
    options?: { twinSyncMode?: boolean },
  ) {
    const trainButtonLabel = options?.twinSyncMode
      ? "Atualizar status do gêmeo"
      : "Gerar gêmeo digital";

    return (
      <div className="persona-cta-block persona-top-gap">
        <div className="persona-cta-row">
          <button
            type="button"
            className="persona-btn persona-btn-large"
            onClick={() => void onStart()}
            disabled={
              !canStart || isTraining || isDeletingTwinGroup || isPollingTwinTraining
            }
          >
            {isTraining || isPollingTwinTraining ? (
              <span className="persona-loading-row">
                <span className="persona-spinner" aria-hidden="true" />
                {isPollingTwinTraining
                  ? "Finalizando gêmeo digital…"
                  : options?.twinSyncMode
                    ? "Atualizando..."
                    : "Treinando..."}
              </span>
            ) : (
              trainButtonLabel
            )}
          </button>
        </div>
        <div className="persona-training-status-banner" aria-live="polite">
          {trainingBannerState === "started" ? (
            <p className="persona-script-approved">Enviando treino para a plataforma…</p>
          ) : null}
          {trainingBannerState === "awaiting_consent" && !isPollingTwinTraining ? (
            <p className="persona-script-approved persona-training-phase-hint">
              {trainingPhaseMessage("awaiting_consent")}
            </p>
          ) : null}
          {isPollingTwinTraining ||
          trainingBannerState === "processing" ? (
            <p className="persona-script-approved persona-training-phase-hint">
              <span className="persona-loading-row">
                {isPollingTwinTraining ? (
                  <span className="persona-spinner" aria-hidden="true" />
                ) : null}
                {trainingPhaseMessage("processing")}
              </span>
            </p>
          ) : null}
          {trainingBannerState === "ready" ? (
            <p className="persona-script-approved">Gêmeo pronto para gerar conteúdo.</p>
          ) : null}
          {trainingBannerState === "failed" ? (
            <p className="persona-helper-text persona-helper-highlight">
              {trainingPhaseMessage("failed")}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  async function fetchHeyGenGroupDetail(groupId: string) {
    const response = await fetchHeygenApi(
      `/api/heygen/avatars/groups/${encodeURIComponent(groupId)}`,
    );
    const payload = await parseJsonOrText<{
      group?: {
        id?: string;
        created_at?: number;
        status?: string | null;
        consent_status?: string | null;
      };
      message?: string;
    }>(response);

    if (!response.ok) {
      return null;
    }

    return payload.group ?? null;
  }

  async function patchTwinLookWithGroupDetail(look: PrivateTwinLook) {
    const groupId = String(look.group_id ?? "").trim();
    if (!groupId) {
      return look;
    }

    const needsDetail =
      look.groupStatus == null ||
      look.consentStatus == null ||
      look.groupCreatedAt == null;
    if (!needsDetail) {
      return look;
    }

    const group = await fetchHeyGenGroupDetail(groupId);
    if (!group) {
      return look;
    }

    return {
      ...look,
      groupCreatedAt: group.created_at ?? look.groupCreatedAt ?? null,
      groupStatus: group.status ?? look.groupStatus ?? null,
      consentStatus: group.consent_status ?? look.consentStatus ?? null,
    };
  }

  async function loadPrivateDigitalTwinLooks(options?: {
    preferredAvatarId?: string;
    preferredGroupId?: string;
  }) {
    setLooksError(null);
    setIsLoadingLooks(true);
    try {
      const [looksResponse, groupsResponse] = await Promise.all([
        fetchHeygenApi("/api/heygen/avatars/looks?ownership=private&avatarType=digital_twin"),
        fetchHeygenApi("/api/heygen/avatars/groups?ownership=private"),
      ]);

      const looksPayload = await parseJsonOrText<{
        looks?: PrivateTwinLook[];
        message?: string;
      }>(looksResponse);
      const groupsPayload = await parseJsonOrText<{
        groups?: Array<{
          id: string;
          created_at?: number;
          status?: string | null;
          consent_status?: string | null;
        }>;
        message?: string;
      }>(groupsResponse);

      if (!looksResponse.ok) {
        throw new Error(looksPayload.message || "Nao foi possivel listar avatares.");
      }
      if (!groupsResponse.ok) {
        throw new Error(groupsPayload.message || "Nao foi possivel listar personagens.");
      }

      const groupsById = new Map(
        (groupsPayload.groups ?? []).map((group) => [group.id, group]),
      );

      const enriched: PrivateTwinLook[] = [...(looksPayload.looks ?? [])]
        .map((look) => {
          const group = groupsById.get(String(look.group_id ?? "").trim());
          return {
            ...look,
            groupCreatedAt: group?.created_at ?? null,
            groupStatus: group?.status ?? null,
            consentStatus: group?.consent_status ?? null,
          };
        })
        .sort(
          (a, b) => (b.groupCreatedAt ?? 0) - (a.groupCreatedAt ?? 0),
        );

      const usableEnriched = enriched.filter(isUsableRecordedDigitalTwin);

      if (enriched.length === 0) {
        setProductionSource("train_new");
      } else {
        setProductionSource("use_existing");
      }

      const preferredAvatarId =
        options?.preferredAvatarId?.trim() ||
        heygenAvatarId.trim() ||
        "";
      const preferredGroupId =
        options?.preferredGroupId?.trim() ||
        heygenAvatarGroupId.trim() ||
        "";

      let resolved: PrivateTwinLook | null =
        enriched.find((look) => look.id === preferredAvatarId) ?? null;

      if (!resolved && preferredGroupId) {
        resolved =
          enriched.find((look) => look.group_id === preferredGroupId) ?? null;
      }

      if (!resolved && usableEnriched.length > 0) {
        resolved = usableEnriched[0] ?? null;
      }

      let finalEnriched: PrivateTwinLook[] = enriched;
      if (resolved) {
        const patchedResolved = await patchTwinLookWithGroupDetail(resolved);
        finalEnriched = enriched.map((look) =>
          look.id === patchedResolved.id ? patchedResolved : look,
        );
        resolved = patchedResolved;
      }

      setPrivateTwinLooks(finalEnriched);

      if (resolved) {
        setHeygenAvatarId(resolved.id);
        if (resolved.group_id) {
          setHeygenAvatarGroupId(String(resolved.group_id));
        }
        persistHeygenPrefs({
          heygenAvatarId: resolved.id,
          heygenAvatarGroupId: String(resolved.group_id ?? ""),
          productionSource: "use_existing",
        });
        if (!isPollingTwinTraining) {
          if (productionSource === "use_existing") {
            setTrainingBannerState("ready");
            setTrainingInfo(null);
            setHeygenConsentUrl("");
          } else {
            syncTrainingBannerFromTwinLook(resolved);
          }
        }
      } else if (enriched.length === 0) {
        setHeygenAvatarId("");
        setHeygenAvatarGroupId("");
      } else if (
        heygenAvatarId &&
        !enriched.some((look) => look.id === heygenAvatarId)
      ) {
        setHeygenAvatarId("");
      }
    } catch (error) {
      setLooksError(
        error instanceof Error ? error.message : "Nao foi possivel listar avatares.",
      );
    } finally {
      setIsLoadingLooks(false);
    }
  }

  async function handleDeleteAvatarPerson(track: AvatarTrack) {
    if (isDeletingTwinGroup) {
      return;
    }

    const isCaricatureTrack = track === "caricature";

    setDeleteTwinError(null);
    setDeleteTwinInfo(null);

    const confirmed = window.confirm(
      isCaricatureTrack
        ? "Refazer a caricatura?\n\n" +
            "O personagem atual na plataforma será apagado permanentemente e não poderá ser recuperado.\n\n" +
            "Depois você poderá enviar nova foto e áudio para treinar."
        : "Refazer o gêmeo digital?\n\n" +
            "O gêmeo atual será apagado permanentemente e não poderá ser recuperado.\n\n" +
            "Depois você poderá enviar novo áudio e vídeo para treinar.",
    );
    if (!confirmed) {
      return;
    }

    const hadLinkedVoice = Boolean(heygenVoiceId.trim());

    setIsDeletingTwinGroup(true);
    try {
      const response = await fetchHeygenApi("/api/heygen/avatars/groups/purge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      const payload = await parseJsonOrText<{
        message?: string;
        deleted?: string[];
        errors?: Array<{ groupId: string; message: string }>;
      }>(response);

      if (!response.ok) {
        throw new Error(
          formatHeyGenPurgeFailureMessage(
            payload.errors,
            payload.message || "Nao foi possivel remover os personagens.",
          ),
        );
      }

      setHeygenAvatarId("");
      setHeygenAvatarGroupId("");
      setHeygenVoiceId("");
      setHeygenConsentUrl("");
      setTwinPreviewOpen(false);
      setPrivateTwinLooks([]);
      setTrainingStarted(false);
      setTrainingBannerState("hidden");
      setProductionSource("train_new");
      setTrainingError(null);
      setTrainingInfo(null);
      setCaricatureError(null);
      setCaricatureInfo(null);

      if (isCaricatureTrack) {
        setSelectedCaricatureAssetId("");
        setCaricaturePreviewUrl(null);
      }

      if (profileIdForPrefs) {
        writeCuradorHeygenPrefs(profileIdForPrefs, {
          heygenAvatarId: "",
          heygenVoiceId: "",
          heygenAvatarGroupId: "",
          lastCaricatureAssetId: isCaricatureTrack ? "" : undefined,
          avatarTrack: isCaricatureTrack ? "caricature" : "realistic",
          productionSource: "train_new",
        });
      }

      const deletedCount = payload.deleted?.length ?? 0;
      const purgeErrors = payload.errors?.length ?? 0;
      let successMessage =
        payload.message?.trim() ||
        (isCaricatureTrack
          ? "Pronto para treinar uma nova caricatura. Envie foto e áudio abaixo."
          : "Pronto para treinar um novo gêmeo. Envie áudio e vídeo abaixo.");

      if (purgeErrors > 0 && deletedCount === 0) {
        throw new Error(
          formatHeyGenPurgeFailureMessage(
            payload.errors,
            isCaricatureTrack
              ? "Não foi possível refazer a caricatura."
              : "Não foi possível refazer o gêmeo digital.",
          ),
        );
      }

      if (isCaricatureTrack && hadLinkedVoice && deletedCount === 0) {
        successMessage =
          "Pronto para treinar uma nova caricatura. Envie foto e áudio abaixo.";
      }

      setDeleteTwinInfo(sanitizeProviderFacingMessage(successMessage));

      if (!isCaricatureTrack) {
        await loadPrivateDigitalTwinLooks();
      }
    } catch (error) {
      showUserError(setDeleteTwinError, error);
    } finally {
      setIsDeletingTwinGroup(false);
    }
  }

  async function handleGenerate() {
    setVideoError(null);
    setVideoStatus(null);
    setVideoUrl(null);
    setCaptionUrl(null);
    setVideoId(null);
    setIsGenerating(true);
    autoPollStartedRef.current = false;
    let startedVideoId: string | null = null;

    try {
      const topic = creativeForm.topic.trim();
      const free = freePrompt.trim();
      if (useFreePromptAsTranscript && !free) {
        throw new Error("Escreva o roteiro completo no Prompt livre para gerar em modo teste.");
      }
      if (!useFreePromptAsTranscript && !scriptApproved) {
        throw new Error("Aprove o roteiro antes de produzir o conteudo.");
      }
      if (!useFreePromptAsTranscript && !scriptDraft.trim()) {
        throw new Error("Gere e aprove um roteiro antes de produzir o conteudo.");
      }
      if (avatarTrack === "realistic" && !heygenAvatarId) {
        throw new Error(
          "Selecione um gemeo digital existente ou treine um novo antes de produzir o conteudo.",
        );
      }
      let resolvedVoiceId = heygenVoiceId;
      if (avatarTrack === "caricature" && !resolvedVoiceId) {
        if (!selectedCaricatureAssetId.trim()) {
          throw new Error("Selecione um modelo de caricatura para gerar o vídeo.");
        }
        resolvedVoiceId = (await handleTrainHeyGen({ mode: "caricature" })) ?? "";
        if (!resolvedVoiceId) {
          throw new Error(
            "Não foi possível preparar a voz na plataforma. Verifique o áudio enviado.",
          );
        }
      }

      const response = await fetchHeygenApi("/api/heygen/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: useFreePromptAsTranscript ? undefined : topic || scriptTopicSnapshot,
          avatarId: avatarTrack === "realistic" ? heygenAvatarId : undefined,
          voiceId: resolvedVoiceId || undefined,
          generateMode: avatarTrack === "caricature" ? "caricature" : "avatar",
          caricatureAssetId:
            avatarTrack === "caricature" ? selectedCaricatureAssetId : undefined,
          name: useFreePromptAsTranscript
            ? `Criativo - prompt livre - ${profileForm.fullName || "Politico"}`
            : `Criativo - ${profileForm.fullName || "Politico"} - ${topic || scriptTopicSnapshot}`,
          transcript: useFreePromptAsTranscript ? free : scriptDraft.trim(),
          freePrompt: useFreePromptAsTranscript ? undefined : free || undefined,
        }),
      });

      const payload = await parseJsonOrText<{ videoId?: string; message?: string }>(
        response,
      );
      if (!response.ok) {
        throw new Error(payload.message || "Nao foi possivel gerar o video.");
      }

      const id = payload.videoId?.trim();
      if (!id) {
        throw new Error("Resposta invalida: videoId ausente.");
      }

      startedVideoId = id;
      setVideoId(id);
      setVideoStatus("pending");
      const result = await pollVideo(id);
      await persistCreativeProject({
        heygenVideoId: id,
        videoUrl: result.videoUrl,
        captionUrl: result.captionUrl,
        status: "ready",
      });
      router.push("/criativo");
    } catch (error) {
      if (startedVideoId) {
        try {
          await persistCreativeProject({
            heygenVideoId: startedVideoId,
            videoUrl: "",
            captionUrl: "",
            status: "failed",
            errorMessage:
              error instanceof Error ? error.message : "A geracao do video falhou.",
          });
        } catch {
          // mantem erro original na tela
        }
      }
      showUserError(setVideoError, error);
    } finally {
      setIsGenerating(false);
    }
  }

  const selectedAvatarImage = avatarImageAssets[0] ?? null;
  const selectedCaricature =
    sortedCaricatureAssets.find((asset) => asset.id === selectedCaricatureAssetId) ??
    sortedCaricatureAssets[0] ??
    null;
  const selectedVoiceAudio = voiceAudioAssets[0] ?? null;
  const selectedTrainingVideo = latestTrainingVideo;

  useEffect(() => {
    if (!videoId || autoPollStartedRef.current || isGenerating) {
      return;
    }
    autoPollStartedRef.current = true;
    void pollVideo(videoId).catch((error) => {
      showUserError(setVideoError, error);
    });
  }, [videoId, isGenerating]);

  useEffect(() => {
    if (!heygenAvatarGroupId.trim()) {
      return;
    }
    if (trainingBannerState !== "awaiting_consent" && trainingBannerState !== "processing") {
      return;
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        void pollHeyGenTwinUntilReady();
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heygenAvatarGroupId, trainingBannerState]);

  useEffect(() => {
    if (
      !heygenAvatarGroupId.trim() ||
      isLoadingLooks ||
      trainingBannerState !== "hidden" ||
      isPollingTwinTraining
    ) {
      return;
    }

    const linkedLook =
      privateTwinLooks.find(
        (look) => String(look.group_id ?? "").trim() === heygenAvatarGroupId.trim(),
      ) ??
      privateTwinLooks.find((look) => look.id === heygenAvatarId) ??
      null;

    if (!linkedLook || isTwinLookReadyForVideo(linkedLook)) {
      if (linkedLook && isTwinLookReadyForVideo(linkedLook)) {
        syncTrainingBannerFromTwinLook(linkedLook);
      }
      return;
    }

    const phase = trainingPhaseFromTwinLook(linkedLook);
    if (!phase || phase === "failed") {
      return;
    }

    setTrainingStarted(true);
    syncTrainingBannerFromTwinLook(linkedLook);

    if (phase === "processing" || phase === "awaiting_consent") {
      void pollHeyGenTwinUntilReady();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    heygenAvatarGroupId,
    heygenAvatarId,
    isLoadingLooks,
    privateTwinLooks,
    trainingBannerState,
    isPollingTwinTraining,
  ]);

  useEffect(() => {
    if (isPollingTwinTraining || !linkedTwinLook) {
      return;
    }
    if (productionSource === "use_existing" && trainingBannerState !== "ready") {
      setTrainingBannerState("ready");
      setTrainingInfo(null);
      setHeygenConsentUrl("");
      return;
    }
    if (isTwinLookReadyForVideo(linkedTwinLook) && trainingBannerState !== "ready") {
      syncTrainingBannerFromTwinLook(linkedTwinLook);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedTwinLook, isPollingTwinTraining, trainingBannerState, productionSource]);

  useEffect(() => {
    if (
      !heygenAvatarId.trim() ||
      twinReadyForVideo ||
      isPollingTwinTraining ||
      isTraining ||
      isLoadingLooks ||
      autoSyncTwinOnLoadRef.current
    ) {
      return;
    }

    autoSyncTwinOnLoadRef.current = true;

    if (isTwinLookReadyForVideo(linkedTwinLook)) {
      syncTrainingBannerFromTwinLook(linkedTwinLook);
      return;
    }

    const groupId =
      heygenAvatarGroupId.trim() || String(linkedTwinLook?.group_id ?? "").trim();
    if (groupId) {
      if (!heygenAvatarGroupId.trim()) {
        setHeygenAvatarGroupId(groupId);
      }
      void pollHeyGenTwinUntilReady();
      return;
    }

    void loadPrivateDigitalTwinLooks({
      preferredAvatarId: heygenAvatarId,
      preferredGroupId: heygenAvatarGroupId,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    heygenAvatarId,
    heygenAvatarGroupId,
    linkedTwinLook,
    twinReadyForVideo,
    isPollingTwinTraining,
    isTraining,
    isLoadingLooks,
  ]);

  useEffect(() => {
    if (profile?.avatarType) {
      setAvatarTrack(avatarTypeToTrack(profile.avatarType));
    }
  }, [profile?.avatarType]);

  useEffect(() => {
    if (autoLoadedLooksRef.current) {
      return;
    }
    autoLoadedLooksRef.current = true;
    void loadPrivateDigitalTwinLooks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!profileIdForPrefs || restoredHeygenPrefsRef.current) {
      return;
    }
    restoredHeygenPrefsRef.current = true;
    const prefs = readCuradorHeygenPrefs(profileIdForPrefs);
    if (prefs.heygenAvatarId) {
      setHeygenAvatarId(prefs.heygenAvatarId);
    }
    if (prefs.heygenVoiceId) {
      setHeygenVoiceId(prefs.heygenVoiceId);
    }
    if (prefs.heygenAvatarGroupId) {
      setHeygenAvatarGroupId(prefs.heygenAvatarGroupId);
    }
    if (prefs.lastCaricatureAssetId) {
      setSelectedCaricatureAssetId(prefs.lastCaricatureAssetId);
    }
    if (prefs.avatarTrack) {
      setAvatarTrack(prefs.avatarTrack);
    }
    const hasPriorTwinTraining = Boolean(
      prefs.heygenAvatarGroupId?.trim() && prefs.heygenAvatarId?.trim(),
    );
    if (hasPriorTwinTraining || prefs.productionSource === "use_existing") {
      setProductionSource("use_existing");
    } else if (prefs.productionSource === "train_new") {
      setProductionSource("train_new");
    }
  }, [profileIdForPrefs]);

  useEffect(() => {
    if (isLoadingLooks) {
      return;
    }
    const next: ProductionSource = hasAnyTwinOnPlatform ? "use_existing" : "train_new";
    if (productionSource !== next) {
      setProductionSource(next);
    }
  }, [isLoadingLooks, hasAnyTwinOnPlatform, productionSource]);

  useEffect(() => {
    if (avatarTrack !== "caricature" || !hasCaricaturePairReady) {
      return;
    }
    const stillValid = sortedCaricatureAssets.some(
      (asset) => asset.id === selectedCaricatureAssetId,
    );
    if (!stillValid && editorialCaricature) {
      selectCaricatureForVideo(editorialCaricature.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatarTrack, hasCaricaturePairReady, sortedCaricatureAssets, selectedCaricatureAssetId]);

  useEffect(() => {
    if (usableTwinLooks.length === 0 || !hasAnyTwinOnPlatform) {
      return;
    }
    setHeygenAvatarId((current) => current || usableTwinLooks[0].id);
  }, [usableTwinLooks, hasAnyTwinOnPlatform]);

  useEffect(() => {
    if (!profileIdForPrefs) {
      return;
    }
    persistHeygenPrefs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    profileIdForPrefs,
    heygenAvatarId,
    heygenVoiceId,
    heygenAvatarGroupId,
    selectedCaricature?.id,
    avatarTrack,
    productionSource,
  ]);

  useEffect(() => {
    const topic = creativeForm.topic.trim();
    if (scriptTopicSnapshot && topic !== scriptTopicSnapshot) {
      invalidateScriptApproval();
    }
  }, [creativeForm.topic, scriptTopicSnapshot]);

  useEffect(() => {
    if (!selectedCaricature?.id) {
      setCaricaturePreviewUrl(null);
      return;
    }

    setCaricaturePreviewUrl(null);
    let cancelled = false;
    void fetch(
      `/api/profile/training-assets/${encodeURIComponent(selectedCaricature.id)}/preview-url`,
    )
      .then(async (response) => {
        const payload = (await response.json()) as { previewUrl?: string };
        if (!response.ok || cancelled) {
          return;
        }
        const url = payload.previewUrl?.trim();
        if (url) {
          setCaricaturePreviewUrl(url);
        }
      })
      .catch(() => {
        // ignore preview failures
      });

    return () => {
      cancelled = true;
    };
  }, [selectedCaricature?.id]);

  useEffect(() => {
    const suggestionId = searchParams.get("sugestao")?.trim();
    if (!suggestionId) {
      router.replace("/criativo");
      return;
    }

    const suggestion = getMockSentinelSuggestionById(suggestionId);
    if (!suggestion) {
      router.replace("/criativo");
      return;
    }

    setSentinelSuggestion(suggestion);
    setCreativeForm((current) => ({
      ...current,
      topic: suggestion.topic,
    }));
    invalidateScriptApproval();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, router]);

  const criativoGateReason = getCriativoGateReason({
    spectrum: profileForm.spectrum,
    hasVoiceAudio: Boolean(voiceAudioAssets[0]),
    twinReady: hasExistingTwin && twinReadyForVideo,
    hasCaricaturePair: hasCaricaturePairReady,
  });

  return (
    <section className="persona-page">
      <div className="persona-container">
        <div className="persona-card">
          <h2 className="sr-only">Criativo</h2>

          <div className="persona-section-header">
            <div className="persona-header-icon" aria-hidden="true">
              <PersonaCriativoIcon />
            </div>
            <h2>Novo criativo</h2>
            <p>Defina o enquadramento desta peça, gere o roteiro e produza o vídeo.</p>
          </div>

          <div className="persona-cta-row">
            <Link href="/criativo" className="persona-btn persona-btn-secondary">
              Voltar para a listagem
            </Link>
          </div>

          {sentinelSuggestion ? (
            <div className="persona-sentinel-context-banner">
              <strong>Tema sugerido pelo Sentinela</strong>
              <SentinelContextPreview suggestion={sentinelSuggestion} />
            </div>
          ) : null}

          {criativoGateReason ? (
            <div className="persona-form-group">
              <p className="persona-helper-text persona-helper-highlight">{criativoGateReason}</p>
              <div className="persona-cta-row persona-top-gap">
                <Link href="/curador" className="persona-btn">
                  Ir para o Curador
                </Link>
              </div>
            </div>
          ) : null}

          {!criativoGateReason ? (
          <>
          <div className="persona-form-group persona-form-panel persona-selection-panel">
            <p className="persona-helper-text persona-selection-intro">{archetypeHelperText}</p>

            <div className="persona-selection-block">
              <label className="persona-label persona-selection-label">Arquétipo</label>
              <div className="persona-tag-list is-archetype-grid">
                {archetypeOptions.map((option) => (
                  <PersonaTag
                    key={option}
                    active={creativeForm.personaArchetypes.includes(option)}
                    onClick={() =>
                      setCreativeForm((current) => ({
                        ...current,
                        personaArchetypes: selectSingleTagValue(
                          current.personaArchetypes,
                          option,
                        ),
                      }))
                    }
                  >
                    {option}
                  </PersonaTag>
                ))}
              </div>
            </div>

            <div className="persona-selection-block">
              <label className="persona-label persona-selection-label">Tom de linguagem</label>
              <div className="persona-tag-list is-tone-grid">
                {voiceToneOptions.map((tone) => (
                  <PersonaTag
                    key={tone}
                    active={creativeForm.voiceTones.includes(tone)}
                    onClick={() =>
                      setCreativeForm((current) => ({
                        ...current,
                        voiceTones: selectSingleTagValue(current.voiceTones, tone),
                      }))
                    }
                  >
                    {tone}
                  </PersonaTag>
                ))}
              </div>
            </div>
          </div>

          <div className="persona-form-group persona-form-panel persona-script-flow">
            <div className="persona-script-block">
              <label className="persona-label persona-selection-label">Tema do vídeo</label>
              <textarea
                className="persona-input-control"
                value={creativeForm.topic}
                onChange={(event) => {
                  invalidateScriptApproval();
                  setCreativeForm((current) => ({
                    ...current,
                    topic: event.target.value,
                  }));
                }}
                rows={2}
              />
              {!useFreePromptAsTranscript ? (
                <div className="persona-script-actions">
                  <button
                    type="button"
                    className="persona-btn"
                    onClick={() => void handleGenerateScript()}
                    disabled={isGeneratingScript || !creativeForm.topic.trim()}
                  >
                    {isGeneratingScript ? (
                      <span className="persona-loading-row">
                        <span className="persona-spinner" aria-hidden="true" />
                        Gerando roteiro...
                      </span>
                    ) : (
                      "Gerar roteiro"
                    )}
                  </button>
                </div>
              ) : null}
            </div>

            {!useFreePromptAsTranscript ? (
              <div className="persona-script-block">
                <label className="persona-label persona-selection-label">Aprovação do roteiro</label>
                <p className="persona-helper-text">
                  Veja o roteiro do vídeo que será produzido. Altere-o conforme necessário. Máximo
                  de {MAX_SCRIPT_WORDS} palavras (ou ~1 minuto).
                </p>
                <textarea
                  className="persona-input-control persona-top-gap"
                  value={scriptDraft}
                  onChange={(event) => {
                    invalidateScriptApproval();
                    setScriptDraft(event.target.value);
                  }}
                  rows={6}
                  placeholder="Clique em Gerar roteiro após preencher o tema..."
                />
                {scriptError ? (
                  <p className="persona-helper-text persona-helper-highlight persona-script-error">
                    {scriptError}
                  </p>
                ) : null}
                <div className="persona-script-footer">
                  <p
                    className={
                      scriptWordCount > MAX_SCRIPT_WORDS
                        ? "persona-script-meta is-warning"
                        : "persona-script-meta"
                    }
                  >
                    {scriptWordCount}/{MAX_SCRIPT_WORDS} palavras
                  </p>
                  <button
                    type="button"
                    className="persona-btn"
                    onClick={handleApproveScript}
                    disabled={!scriptDraft.trim() || scriptWordCount > MAX_SCRIPT_WORDS}
                  >
                    Aprovar roteiro
                  </button>
                </div>
                {scriptApproved ? (
                  <p className="persona-script-approved">
                    Roteiro aprovado. Você já pode produzir o conteúdo.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="persona-form-group">
            <label className="persona-label">Prompt livre (teste)</label>
            <textarea
              className="persona-input-control"
              value={freePrompt}
              onChange={(event) => setFreePrompt(event.target.value)}
              rows={4}
              placeholder="Use 1-2 frases curtas. Ex: 'tom confiante. frases curtas. finalize com CTA.'"
            />
            <div className="persona-checkbox-row">
              <label className="persona-checkbox">
                <input
                  type="checkbox"
                  checked={useFreePromptAsTranscript}
                  onChange={(event) => {
                    setUseFreePromptAsTranscript(event.target.checked);
                    if (event.target.checked) {
                      invalidateScriptApproval();
                    }
                  }}
                />
                Usar o Prompt livre como roteiro completo (ignorar o sistema)
              </label>
            </div>
            {useFreePromptAsTranscript && (
              <p className="persona-helper-text">
                Modo teste: o Prompt livre vira o texto falado completo e dispensa aprovacao do
                roteiro.
              </p>
            )}
          </div>

          <div className="persona-section-header persona-top-gap">
            <h2>Produzir vídeo</h2>
          </div>

          {renderProductionTemplateSelector()}

          <div className="persona-production-actions">
            <div className="persona-generate-row">
              <button
                type="button"
                className="persona-btn persona-btn-large"
                onClick={() => void handleGenerate()}
                disabled={
                  isGenerating ||
                  (isPollingTwinTraining && !twinReadyForVideo) ||
                  !canProduceContent ||
                  (avatarTrack === "caricature" && isTraining)
                }
              >
                {isGenerating ? (
                  <span className="persona-loading-row">
                    <span className="persona-spinner" aria-hidden="true" />
                    Gerando...
                  </span>
                ) : (
                  "Gerar Conteúdo a partir do Avatar selecionado"
                )}
              </button>
              {generateDisabledReason && !isGenerating ? (
                <p className="persona-helper-text persona-helper-highlight persona-top-gap">
                  {generateDisabledReason}
                </p>
              ) : null}
              {isGenerating && <div className="persona-progress" />}
            </div>
          </div>

          {videoError ? (
            <>
              <p className="persona-helper-text persona-helper-highlight">{videoError}</p>
              {formatProviderLimitHint(videoError) ? (
                <p className="persona-helper-text">{formatProviderLimitHint(videoError)}</p>
              ) : null}
            </>
          ) : (
            <>
              {(videoStatus || videoId) && (
                <p className="persona-helper-text">
                  Status: {formatStatus(videoStatus)} {videoId ? `| Job: ${videoId}` : ""}
                </p>
              )}
              {videoUrl && (
                <div className="persona-video-ready-row">
                  <a
                    href={videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="persona-btn persona-btn-large"
                  >
                    Ver vídeo
                  </a>
                </div>
              )}
              {captionUrl && (
                <p className="persona-helper-text">
                  Legendas:{" "}
                  <a href={captionUrl} target="_blank" rel="noreferrer">
                    abrir
                  </a>
                </p>
              )}
            </>
          )}
          </>
          ) : null}
        </div>
      </div>
    </section>
  );
}

