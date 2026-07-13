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
import { PautaContextCard } from "@/components/product/pauta-context-card";
import { ThemeTagPill } from "@/components/product/theme-tag";
import { useProductApp } from "@/components/product/provider";
import {
  AVATAR_TYPE_BY_TRACK,
  CaricatureAssetPreview,
  MAX_SCRIPT_WORDS,
  ProductionTemplateEmptyPreview,
  ProductionTemplateOption,
  ProductionTemplatePendingPreview,
  TrainingAssetMediaPreview,
  TwinLookMedia,
  avatarTypeToTrack,
  buildCuradorContextPayload,
  countWords,
  formatStatus,
  parseJsonOrText,
  productionTemplateDescription,
  productionTemplateLabel,
  productionTemplateTier,
  selectSingleTagValue,
  type AvatarTrack,
  type PrivateTwinLook,
  type ProductionSource,
  type ProductionTemplate,
} from "@/components/product/persona-shared";
import {
  formatProviderLimitHint,
  readCuradorHeygenPrefs,
  sanitizeProviderFacingMessage,
  shouldInvalidateHeygenVoiceClone,
  writeCuradorHeygenPrefs,
} from "@/lib/curador-heygen-prefs";
import { pickLatestCaricatureForVariant } from "@/lib/caricature-asset-variant";
import {
  isConsentApproved,
  isTwinLookReadyForVideo,
  isUsableRecordedDigitalTwin,
  resolveAvatarTrainingName,
  trainingPhaseFromTwinLook,
  trainingPhaseMessage,
  type HeyGenTrainingPhase,
  type TwinLookDisplayMeta,
} from "@/lib/heygen-twin-display";
import {
  performRemoteTwinGroupDelete,
  resolveActiveTwinGroupId,
} from "@/lib/heygen-avatar-refazer";
import { resolveCreativeProjectTopicForSave } from "@/lib/creative-project-display";
import { buildCreativeAiMetadata, withTseCaptionTag } from "@/lib/creative-ai-metadata";
import { ExportComplianceModal } from "@/components/product/export-compliance-modal";
import {
  avatarSlugFromProductionTemplate,
  avatarSlugFromSearchParam,
  productionTemplateFromAvatarSlug,
  type AvatarTipoSlug,
} from "@/lib/avatar-tipos";
import { fetchHeyGenConsentLink } from "@/lib/heygen-consent-client";
import { fetchHeygenApi } from "@/lib/heygen-client-override";
import {
  SCRIPT_EDIT_CONSENT_TEXT,
  SCRIPT_MANUAL_REVIEW_CONSENT_TEXT,
  useScriptFactCheck,
} from "@/components/product/use-script-fact-check";
import { isFactCheckHeuristicFallback } from "@/lib/auditor/types";
import type { ProfileTrainingAsset } from "@/lib/types";
import type { MockSentinelSuggestion } from "@/lib/sentinel-mock-suggestions";

const CRIATIVO_PANEL_CLASS =
  "rounded-[1.75rem] border border-slate-800 bg-gradient-to-b from-slate-900/50 to-slate-900/20 backdrop-blur-xl p-6 md:p-8 shadow-xl mb-8";
const CRIATIVO_LABEL_CLASS = "block text-sm font-semibold text-white mb-2";
const CRIATIVO_HELPER_CLASS = "text-sm text-slate-400 leading-relaxed";
const CRIATIVO_PRIMARY_BTN_CLASS =
  "inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-all shadow-[0_0_15px_rgba(6,182,212,0.2)] hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed";
const CRIATIVO_SECONDARY_BTN_CLASS =
  "inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed";
const CRIATIVO_INPUT_CLASS =
  "w-full bg-[#0E1321] border border-slate-700 text-slate-200 text-sm rounded-xl px-3 py-3 outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 resize-y min-h-[120px]";

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
  hasPhotoAvatar: boolean;
  hasCaricaturePair: boolean;
}): string | null {
  if (!input.spectrum.trim()) {
    return "Defina o posicionamento ideológico no Curador.";
  }
  if (!input.hasVoiceAudio) {
    return "Envie o áudio de voz no Curador.";
  }
  if (!input.hasPhotoAvatar && !input.hasCaricaturePair) {
    return "Envie a foto e/ou gere as caricaturas no Curador.";
  }
  return null;
}

export type CriativoPageMode = "padrao" | "independente";

export function CriativoPageV2({ mode = "padrao" }: { mode?: CriativoPageMode } = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [creativeForm, setCreativeForm] = useState<CreativeFormState>(EMPTY_CREATIVE_FORM);
  const [isTraining, setIsTraining] = useState(false);
  const [trainingError, setTrainingError] = useState<string | null>(null);
  const [trainingInfo, setTrainingInfo] = useState<string | null>(null);
  const [heygenAvatarId, setHeygenAvatarId] = useState<string>("");
  const [heygenAvatarGroupId, setHeygenAvatarGroupId] = useState<string>("");
  const [heygenVoiceId, setHeygenVoiceId] = useState<string>("");
  const [heygenConsentUrl, setHeygenConsentUrl] = useState<string>("");
  const [selectedCaricatureAssetId, setSelectedCaricatureAssetId] = useState<string>("");
  const [avatarTrack, setAvatarTrack] = useState<AvatarTrack>("photo_real");
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
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [freePrompt, setFreePrompt] = useState<string>("");
  const [useFreePromptAsTranscript, setUseFreePromptAsTranscript] = useState(
    mode === "independente",
  );
  const pendingAvatarSlugRef = useRef<AvatarTipoSlug | null>(null);
  const [sentinelSuggestion, setSentinelSuggestion] = useState<MockSentinelSuggestion | null>(
    null,
  );
  const [sentinelLoadError, setSentinelLoadError] = useState<string | null>(null);
  const [isLoadingSentinelSuggestion, setIsLoadingSentinelSuggestion] = useState(false);
  const [scriptDraft, setScriptDraft] = useState("");
  const [scriptTopicSnapshot, setScriptTopicSnapshot] = useState("");
  const [scriptApproved, setScriptApproved] = useState(false);
  const {
    isFactChecking,
    factCheckResult,
    scriptEditedAfterApproval,
    scriptEditConsent,
    setScriptEditConsent,
    manualReviewConsentRequired,
    manualReviewConsent,
    setManualReviewConsent,
    markScriptEditedAfterApproval,
    resetFactCheckState,
    approveWithFactCheck,
  } = useScriptFactCheck();
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
  const hasAnyCaricatureReady = Boolean(editorialCaricature || mascotCaricature);
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
    if (avatarTrack === "photo_real" || avatarTrack === "realistic") {
      return "photo_real";
    }
    if (avatarTrack === "caricature") {
      if (mascotCaricature && selectedCaricatureAssetId === mascotCaricature.id) {
        return "caricature_mascot_3d";
      }
      if (editorialCaricature && selectedCaricatureAssetId === editorialCaricature.id) {
        return "caricature_editorial";
      }
      if (profileIdForPrefs) {
        const slug = readCuradorHeygenPrefs(profileIdForPrefs).lastAvatarTipoSlug;
        if (slug === "3d") {
          return "caricature_mascot_3d";
        }
        if (slug === "caricato") {
          return "caricature_editorial";
        }
      }
      return "caricature_editorial";
    }
    return "photo_real";
  }, [
    avatarTrack,
    mascotCaricature,
    editorialCaricature,
    selectedCaricatureAssetId,
    profileIdForPrefs,
  ]);

  const digitalTwinTemplateReady =
    Boolean(heygenAvatarId.trim()) && Boolean(productionTwinLook) && twinReadyForVideo;

  const photoRealTemplateReady =
    Boolean(avatarImageAssets[0]) && Boolean(voiceAudioAssets[0]);

  const canGenerateVideo =
    avatarTrack === "photo_real"
      ? photoRealTemplateReady
      : avatarTrack === "caricature"
        ? Boolean(selectedCaricatureAssetId.trim()) && Boolean(voiceAudioAssets[0])
        : photoRealTemplateReady;

  const scriptWordCount = countWords(scriptDraft);
  const freePromptWordCount = countWords(freePrompt);
  const scriptClearedForProduction =
    scriptApproved &&
    scriptDraft.trim().length > 0 &&
    (!manualReviewConsentRequired || manualReviewConsent) &&
    (!scriptEditedAfterApproval || scriptEditConsent);
  const canProduceContent =
    canGenerateVideo &&
    (useFreePromptAsTranscript ? freePrompt.trim().length > 0 : scriptClearedForProduction);

  function getGenerateDisabledReason(): string | null {
    if (isGenerating) {
      return null;
    }
    if (isPollingTwinTraining && !twinReadyForVideo) {
      return "Sincronizando com a plataforma. Aguarde a conclusão do treinamento no Curador.";
    }
    if (avatarTrack === "photo_real" && !avatarImageAssets[0]) {
      return "Envie a foto do rosto no Curador.";
    }
    if (avatarTrack === "photo_real" && !voiceAudioAssets[0]) {
      return "Envie o áudio de voz no Curador.";
    }
    if (avatarTrack === "photo_real" && isTraining) {
      return "Preparando a voz na plataforma. Aguarde.";
    }
    if (avatarTrack === "caricature" && !selectedCaricatureAssetId.trim()) {
      return "Selecione uma caricatura para gerar o vídeo.";
    }
    if (avatarTrack === "caricature" && !voiceAudioAssets[0]) {
      return "Envie o áudio de voz no Curador.";
    }
    if (avatarTrack === "caricature" && !hasAnyCaricatureReady) {
      return "Gere ao menos uma caricatura no Curador.";
    }
    if (avatarTrack === "caricature" && isTraining) {
      return "Preparando a voz na plataforma. Aguarde.";
    }
    if (manualReviewConsentRequired && !manualReviewConsent) {
      return "Confirme a revisão manual do roteiro antes de produzir o conteúdo.";
    }
    if (scriptEditedAfterApproval && !scriptEditConsent) {
      return "Confirme o termo de responsabilidade após editar o roteiro aprovado.";
    }
    return null;
  }

  const generateDisabledReason = getGenerateDisabledReason();

  function renderArchetypeIntro() {
    return (
      <div className="mb-3">
        <p className={CRIATIVO_LABEL_CLASS}>Selecione no máximo um arquétipo e um tom.</p>
        <p className={`${CRIATIVO_HELPER_CLASS} mt-1`}>
          Por padrão, a IA utiliza a identidade comunicacional identificada nas mídias enviadas
          (caso não faça nenhuma seleção).
        </p>
      </div>
    );
  }

  function selectAvatarTrack(track: AvatarTrack) {
    const hasExisting =
      track === "realistic"
        ? hasExistingTwin
        : track === "photo_real"
          ? Boolean(avatarImageAssets[0])
          : hasUsableCaricaturePerson;
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
    let phase = trainingPhaseFromTwinLook(look);
    if (!phase) {
      return;
    }
    if (phase === "awaiting_consent" && isConsentApproved(look.consentStatus)) {
      phase = "processing";
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
      return;
    }

    const slug = avatarSlugFromProductionTemplate(template);

    if (template === "photo_real") {
      selectAvatarTrack("photo_real");
      persistHeygenPrefs({
        avatarTrack: "photo_real",
        lastAvatarTipoSlug: slug ?? "foto-real",
      });
      return;
    }

    if (template === "caricature_editorial") {
      selectAvatarTrack("caricature");
      if (editorialCaricature) {
        selectCaricatureForVideo(editorialCaricature.id);
      }
      persistHeygenPrefs({
        avatarTrack: "caricature",
        lastCaricatureAssetId: editorialCaricature?.id,
        lastAvatarTipoSlug: slug ?? "caricato",
      });
      return;
    }

    if (template === "caricature_mascot_3d") {
      selectAvatarTrack("caricature");
      if (mascotCaricature) {
        selectCaricatureForVideo(mascotCaricature.id);
      }
      persistHeygenPrefs({
        avatarTrack: "caricature",
        lastCaricatureAssetId: mascotCaricature?.id,
        lastAvatarTipoSlug: slug ?? "3d",
      });
    }
  }

  function applyAvatarTipoSlug(slug: AvatarTipoSlug) {
    selectProductionTemplate(productionTemplateFromAvatarSlug(slug));
  }

  function invalidateScriptApproval() {
    markScriptEditedAfterApproval();
    setScriptApproved(false);
  }

  function persistHeygenPrefs(overrides?: {
    heygenAvatarId?: string;
    heygenVoiceId?: string;
    heygenVoiceAudioAssetId?: string;
    heygenAvatarGroupId?: string;
    lastCaricatureAssetId?: string;
    avatarTrack?: AvatarTrack;
    productionSource?: ProductionSource;
    lastAvatarTipoSlug?: AvatarTipoSlug;
  }) {
    if (!profileIdForPrefs) {
      return;
    }

    writeCuradorHeygenPrefs(profileIdForPrefs, {
      heygenAvatarId: overrides?.heygenAvatarId ?? heygenAvatarId,
      heygenVoiceId: overrides?.heygenVoiceId ?? heygenVoiceId,
      heygenVoiceAudioAssetId:
        overrides?.heygenVoiceAudioAssetId ?? voiceAudioAssets[0]?.id ?? "",
      heygenAvatarGroupId: overrides?.heygenAvatarGroupId ?? heygenAvatarGroupId,
      lastCaricatureAssetId:
        overrides?.lastCaricatureAssetId ??
        selectedCaricature?.id ??
        sortedCaricatureAssets[0]?.id,
      avatarTrack: overrides?.avatarTrack ?? avatarTrack,
      productionSource: overrides?.productionSource ?? productionSource,
      lastAvatarTipoSlug:
        overrides?.lastAvatarTipoSlug ??
        readCuradorHeygenPrefs(profileIdForPrefs).lastAvatarTipoSlug,
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

  async function sealVideoIfPossible(input: {
    heygenVideoId: string;
    videoUrl: string;
  }) {
    try {
      const response = await fetch("/api/media/seal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrl: input.videoUrl,
          mediaId: input.heygenVideoId,
        }),
      });
      const payload = await parseJsonOrText<{
        sealedUrl?: string;
        message?: string;
      }>(response);
      if (!response.ok || !payload.sealedUrl?.trim()) {
        return { videoUrl: input.videoUrl, sealed: false };
      }
      return { videoUrl: payload.sealedUrl.trim(), sealed: true };
    } catch {
      return { videoUrl: input.videoUrl, sealed: false };
    }
  }

  async function persistCreativeProject(input: {
    heygenVideoId: string;
    videoUrl: string;
    captionUrl: string;
    status: "ready" | "failed";
    errorMessage?: string;
    sealed?: boolean;
  }) {
    const response = await fetch("/api/creative-projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: resolveCreativeProjectTopicForSave({
          topic: creativeForm.topic,
          useFreePrompt: useFreePromptAsTranscript,
        }),
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
        metadata: buildCreativeAiMetadata({
          factCheckVerdict: factCheckResult?.verdict,
          usedFreePrompt: useFreePromptAsTranscript,
          technologies: ["HeyGen"],
          sealed: input.sealed,
        }),
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
    resetFactCheckState();
    invalidateScriptApproval();

    try {
      const response = await fetchHeygenApi("/api/heygen/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
            curadorContext: buildCuradorContextPayload({
              spectrum: profileForm.spectrum,
              glossaryTerms: profileForm.glossaryTerms,
              personaArchetypes: creativeForm.personaArchetypes,
              voiceTones: creativeForm.voiceTones,
              avatarType: profileForm.avatarType,
            }),
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

  async function handleApproveScript() {
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

    const factCheck = await approveWithFactCheck({
      script: draft,
      topic: creativeForm.topic.trim(),
      suggestion: sentinelSuggestion,
      useFreePrompt: useFreePromptAsTranscript,
    });

    if (!factCheck.ok) {
      setScriptError(factCheck.message || "Validacao factual reprovou o roteiro.");
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
    needsConsent?: boolean;
    avatarGroupStatus?: string | null;
    trainingPhase?: HeyGenTrainingPhase;
    message?: string;
  };

  async function requestHeyGenTrain(input?: {
    action?: "create" | "sync";
    persistProfile?: boolean;
    mode?: "digital_twin" | "caricature" | "photo_real";
  }): Promise<HeyGenTrainPayload> {
    const trainMode =
      input?.mode ??
      (avatarTrack === "realistic"
        ? "digital_twin"
        : avatarTrack === "photo_real"
          ? "photo_real"
          : "caricature");
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
        avatarName: resolveAvatarTrainingName({
          fullName: profileForm.fullName,
          role: profileForm.role,
          city: profileForm.city,
        }),
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

  async function ensureTwinConsentUrl(input?: {
    groupId?: string;
    consentStatus?: string | null;
  }) {
    const groupId = String(input?.groupId ?? heygenAvatarGroupId).trim();
    if (!groupId || heygenConsentUrl.trim()) {
      return;
    }

    try {
      const payload = await fetchHeyGenConsentLink({
        groupId,
        consentStatus:
          input?.consentStatus ??
          linkedTwinLook?.consentStatus ??
          productionTwinLook?.consentStatus ??
          null,
      });

      const nextUrl = String(payload.consentUrl ?? "").trim();
      if (nextUrl) {
        setHeygenConsentUrl(nextUrl);
      }

      if (!payload.needsConsent && isConsentApproved(payload.consentStatus)) {
        setTrainingBannerState("processing");
      }
    } catch {
      // mantem mensagem generica
    }
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
      const consentStillRequired =
        payload.needsConsent !== false &&
        !isConsentApproved(payload.consentStatus);
      let phase = payload.trainingPhase;
      if (phase === "awaiting_consent" && !consentStillRequired) {
        phase = "processing";
      }

      applyTrainingPhase(phase);
      if (phase === "awaiting_consent") {
        void ensureTwinConsentUrl({
          groupId: nextGroupId || heygenAvatarGroupId,
          consentStatus: payload.consentStatus ?? null,
        });
      } else if (!consentStillRequired) {
        setHeygenConsentUrl("");
      }
    }

    persistHeygenPrefs({
      heygenAvatarId: nextAvatarId || heygenAvatarId,
      heygenVoiceId: payload.voiceId?.trim() || heygenVoiceId,
      heygenVoiceAudioAssetId: voiceAudioAssets[0]?.id ?? "",
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
    mode?: "digital_twin" | "caricature" | "photo_real";
  }): Promise<string | undefined> {
    const trainMode =
      options?.mode ??
      (avatarTrack === "realistic"
        ? "digital_twin"
        : avatarTrack === "photo_real"
          ? "photo_real"
          : "caricature");
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
    const sourcePhotoId = avatarImageAssets[0]?.id;

    function renderCaricaturePreview(
      asset: ProfileTrainingAsset | null | undefined,
      pendingMessage: string,
    ) {
      if (asset) {
        return <CaricatureAssetPreview assetId={asset.id} />;
      }
      if (sourcePhotoId) {
        return (
          <ProductionTemplatePendingPreview
            assetId={sourcePhotoId}
            message={pendingMessage}
          />
        );
      }
      return (
        <ProductionTemplateEmptyPreview
          icon="photo"
          message="Envie a foto no Curador"
        />
      );
    }

    return (
      <div className="persona-form-group persona-production-template-section">
        <div className="persona-production-template-header">
          <div>
            <label className={CRIATIVO_LABEL_CLASS}>Avatar do vídeo</label>
            <p className={CRIATIVO_HELPER_CLASS}>
              Caso faça sentido para essa pauta, você pode selecionar outro modelo de avatar.
            </p>
          </div>
        </div>
        <div
          className="persona-production-template-grid persona-top-gap"
          role="radiogroup"
          aria-label="Template para gerar o vídeo"
        >
          <ProductionTemplateOption
            label={productionTemplateLabel("photo_real")}
            description={productionTemplateDescription("photo_real")}
            tier={productionTemplateTier("photo_real")}
            isSelected={activeProductionTemplate === "photo_real"}
            isAvailable={Boolean(avatarImageAssets[0])}
            unavailableHint="Enviar foto no Curador"
            onSelect={() => selectProductionTemplate("photo_real")}
            preview={
              avatarImageAssets[0] ? (
                <TrainingAssetMediaPreview assetId={avatarImageAssets[0].id} />
              ) : (
                <ProductionTemplateEmptyPreview
                  icon="photo"
                  message="Envie a foto no Curador"
                />
              )
            }
          />
          <ProductionTemplateOption
            label={productionTemplateLabel("caricature_editorial")}
            description={productionTemplateDescription("caricature_editorial")}
            tier={productionTemplateTier("caricature_editorial")}
            isSelected={activeProductionTemplate === "caricature_editorial"}
            isAvailable={Boolean(editorialCaricature)}
            unavailableHint="Gerar Caricato no Curador"
            onSelect={() => selectProductionTemplate("caricature_editorial")}
            preview={renderCaricaturePreview(
              editorialCaricature,
              "Gerar Caricato",
            )}
          />
          <ProductionTemplateOption
            label={productionTemplateLabel("caricature_mascot_3d")}
            description={productionTemplateDescription("caricature_mascot_3d")}
            tier={productionTemplateTier("caricature_mascot_3d")}
            isSelected={activeProductionTemplate === "caricature_mascot_3d"}
            isAvailable={Boolean(mascotCaricature)}
            unavailableHint="Gerar Mascote 3D no Curador"
            onSelect={() => selectProductionTemplate("caricature_mascot_3d")}
            preview={renderCaricaturePreview(mascotCaricature, "Gerar Mascote 3D")}
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
      : "Gerar Gêmeo Digital";

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
          {trainingBannerState === "awaiting_consent" &&
          !isPollingTwinTraining &&
          !isConsentApproved(
            productionTwinLook?.consentStatus ?? linkedTwinLook?.consentStatus,
          ) ? (
            <p className="persona-script-approved persona-training-phase-hint">
              {trainingPhaseMessage("awaiting_consent", {
                hasConsentUrl: Boolean(heygenConsentUrl.trim()),
              })}
            </p>
          ) : null}
          {heygenConsentUrl ? (
            <p className="persona-helper-text persona-helper-highlight persona-top-gap">
              Consentimento necessário:{" "}
              <a href={heygenConsentUrl} target="_blank" rel="noreferrer">
                finalizar criação do gêmeo digital
              </a>
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
            "A voz vinculada na plataforma será limpa para um novo treino com foto e áudio. " +
            "O gêmeo digital não será apagado.\n\n" +
            "As imagens caricatas já geradas permanecem salvas no perfil."
        : "Refazer o gêmeo digital?\n\n" +
            "Apenas o gêmeo atual será apagado na plataforma. A voz e as caricaturas não serão removidas.\n\n" +
            "Depois você poderá enviar novo áudio e vídeo para treinar.",
    );
    if (!confirmed) {
      return;
    }

    setIsDeletingTwinGroup(true);
    try {
      let successMessage = isCaricatureTrack
        ? "Pronto para gerar novamente. Clique em \"Gerar\" na variante desejada no Curador."
        : "Pronto para treinar um novo gêmeo. Envie áudio e vídeo abaixo.";

      if (isCaricatureTrack) {
        setHeygenVoiceId("");
        setCaricatureError(null);
        setCaricatureInfo(null);
        setSelectedCaricatureAssetId("");
        setCaricaturePreviewUrl(null);

        if (profileIdForPrefs) {
          writeCuradorHeygenPrefs(profileIdForPrefs, {
            heygenVoiceId: "",
            lastCaricatureAssetId: "",
            avatarTrack: "caricature",
            productionSource: "train_new",
          });
        }
      } else {
        const twinGroupId = resolveActiveTwinGroupId({
          heygenAvatarGroupId,
          selectedTwinLook,
          linkedTwinLook,
        });

        if (twinGroupId) {
          const payload = await performRemoteTwinGroupDelete(fetchHeygenApi, twinGroupId);
          successMessage =
            payload.message?.trim() ||
            "Pronto para treinar um novo gêmeo. Envie áudio e vídeo abaixo.";
        }

        setHeygenAvatarId("");
        setHeygenAvatarGroupId("");
        setHeygenConsentUrl("");
        setTwinPreviewOpen(false);
        setPrivateTwinLooks([]);
        setTrainingStarted(false);
        setTrainingBannerState("hidden");
        setProductionSource("train_new");
        setTrainingError(null);
        setTrainingInfo(null);

        if (profileIdForPrefs) {
          writeCuradorHeygenPrefs(profileIdForPrefs, {
            heygenAvatarId: "",
            heygenAvatarGroupId: "",
            avatarTrack: "realistic",
            productionSource: "train_new",
          });
        }

        await loadPrivateDigitalTwinLooks();
      }

      setDeleteTwinInfo(sanitizeProviderFacingMessage(successMessage));
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
        throw new Error(
          mode === "independente"
            ? "Escreva o que deseja falar antes de criar o conteúdo."
            : "Escreva o roteiro completo antes de gerar o conteúdo.",
        );
      }
      if (!useFreePromptAsTranscript && !scriptApproved) {
        throw new Error("Aprove o roteiro antes de produzir o conteudo.");
      }
      if (scriptEditedAfterApproval && !scriptEditConsent) {
        throw new Error(
          "Confirme o termo de responsabilidade apos editar o roteiro aprovado.",
        );
      }
      if (manualReviewConsentRequired && !manualReviewConsent) {
        throw new Error(
          "Confirme a revisao manual do roteiro antes de produzir o conteudo.",
        );
      }
      if (!useFreePromptAsTranscript && !scriptDraft.trim()) {
        throw new Error("Gere e aprove um roteiro antes de produzir o conteudo.");
      }
      let resolvedVoiceId = heygenVoiceId;
      if (
        avatarTrack === "caricature" ||
        avatarTrack === "photo_real" ||
        avatarTrack === "realistic"
      ) {
        if (avatarTrack === "caricature" && !selectedCaricatureAssetId.trim()) {
          throw new Error("Selecione um modelo de caricatura para gerar o vídeo.");
        }
        if (
          (avatarTrack === "photo_real" || avatarTrack === "realistic") &&
          !avatarImageAssets[0]
        ) {
          throw new Error("Envie a foto do rosto no Curador.");
        }
        const trainMode =
          avatarTrack === "photo_real" || avatarTrack === "realistic"
            ? "photo_real"
            : "caricature";
        const syncedVoiceId = (await handleTrainHeyGen({ mode: trainMode })) ?? "";
        if (syncedVoiceId) {
          resolvedVoiceId = syncedVoiceId;
        }
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
          voiceId: resolvedVoiceId || undefined,
          generateMode:
            avatarTrack === "caricature"
              ? "caricature"
              : avatarTrack === "photo_real" || avatarTrack === "realistic"
                ? "photo_real"
                : "avatar",
          caricatureAssetId:
            avatarTrack === "caricature" ? selectedCaricatureAssetId : undefined,
          name: useFreePromptAsTranscript
            ? `Criativo - prompt livre - ${profileForm.fullName || "Politico"}`
            : `Criativo - ${profileForm.fullName || "Politico"} - ${topic || scriptTopicSnapshot}`,
          transcript: useFreePromptAsTranscript ? free : scriptDraft.trim(),
          freePrompt: useFreePromptAsTranscript ? undefined : free || undefined,
        }),
      });

      const payload = await parseJsonOrText<{
        videoId?: string;
        voiceId?: string;
        message?: string;
      }>(response);
      if (!response.ok) {
        throw new Error(payload.message || "Nao foi possivel gerar o video.");
      }

      const id = payload.videoId?.trim();
      if (!id) {
        throw new Error("Resposta invalida: videoId ausente.");
      }

      const nextVoiceId = payload.voiceId?.trim();
      if (nextVoiceId) {
        setHeygenVoiceId(nextVoiceId);
        persistHeygenPrefs({
          heygenVoiceId: nextVoiceId,
          heygenVoiceAudioAssetId: voiceAudioAssets[0]?.id ?? "",
        });
      }

      startedVideoId = id;
      setVideoId(id);
      setVideoStatus("pending");
      const result = await pollVideo(id);
      const sealed = await sealVideoIfPossible({
        heygenVideoId: id,
        videoUrl: result.videoUrl,
      });
      setVideoUrl(sealed.videoUrl);
      await persistCreativeProject({
        heygenVideoId: id,
        videoUrl: sealed.videoUrl,
        captionUrl: result.captionUrl,
        status: "ready",
        sealed: sealed.sealed,
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
      const baseMessage =
        error instanceof Error ? error.message : "A geracao do video falhou.";
      if (startedVideoId && baseMessage.toLowerCase().includes("creative_projects")) {
        showUserError(
          setVideoError,
          new Error(
            `O video foi gerado na HeyGen (Job: ${startedVideoId}), mas falhou ao salvar no banco. ${baseMessage}`,
          ),
        );
      } else {
        showUserError(setVideoError, error);
      }
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
    if (trainingBannerState !== "awaiting_consent" || heygenConsentUrl.trim()) {
      return;
    }
    void ensureTwinConsentUrl();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainingBannerState, heygenAvatarGroupId, heygenConsentUrl]);

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
    if (!profile?.avatarType || !profileIdForPrefs) {
      return;
    }
    const prefs = readCuradorHeygenPrefs(profileIdForPrefs);
    if (prefs.lastAvatarTipoSlug) {
      return;
    }
    const track = avatarTypeToTrack(profile.avatarType);
    setAvatarTrack(track === "realistic" ? "photo_real" : track);
  }, [profile?.avatarType, profileIdForPrefs]);

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
    const currentVoiceAudioAssetId = voiceAudioAssets[0]?.id ?? "";
    if (
      prefs.heygenVoiceId &&
      !shouldInvalidateHeygenVoiceClone(prefs, currentVoiceAudioAssetId)
    ) {
      setHeygenVoiceId(prefs.heygenVoiceId);
    }
    if (prefs.heygenAvatarGroupId) {
      setHeygenAvatarGroupId(prefs.heygenAvatarGroupId);
    }
    if (prefs.lastCaricatureAssetId) {
      setSelectedCaricatureAssetId(prefs.lastCaricatureAssetId);
    }
    if (prefs.lastAvatarTipoSlug === "foto-real") {
      setAvatarTrack("photo_real");
    } else if (prefs.lastAvatarTipoSlug === "caricato") {
      setAvatarTrack("caricature");
    } else if (prefs.lastAvatarTipoSlug === "3d") {
      setAvatarTrack("caricature");
    } else if (prefs.avatarTrack) {
      setAvatarTrack(prefs.avatarTrack === "realistic" ? "photo_real" : prefs.avatarTrack);
    }
    const hasPriorTwinTraining = Boolean(
      prefs.heygenAvatarGroupId?.trim() && prefs.heygenAvatarId?.trim(),
    );
    if (hasPriorTwinTraining || prefs.productionSource === "use_existing") {
      setProductionSource("use_existing");
    } else if (prefs.productionSource === "train_new") {
      setProductionSource("train_new");
    }
  }, [profileIdForPrefs, voiceAudioAssets]);

  useEffect(() => {
    if (!profileIdForPrefs) {
      return;
    }

    const currentVoiceAudioAssetId = voiceAudioAssets[0]?.id ?? "";
    const prefs = readCuradorHeygenPrefs(profileIdForPrefs);
    if (!shouldInvalidateHeygenVoiceClone(prefs, currentVoiceAudioAssetId)) {
      return;
    }

    setHeygenVoiceId("");
    writeCuradorHeygenPrefs(profileIdForPrefs, {
      ...prefs,
      heygenVoiceId: "",
      heygenVoiceAudioAssetId: "",
    });
  }, [profileIdForPrefs, voiceAudioAssets]);

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
    if (!profileIdForPrefs || sortedCaricatureAssets.length === 0) {
      return;
    }

    const prefs = readCuradorHeygenPrefs(profileIdForPrefs);
    const savedCaricatureId = prefs.lastCaricatureAssetId?.trim();
    if (
      prefs.heygenVoiceId?.trim() &&
      savedCaricatureId &&
      !sortedCaricatureAssets.some((asset) => asset.id === savedCaricatureId)
    ) {
      setHeygenVoiceId("");
      writeCuradorHeygenPrefs(profileIdForPrefs, {
        ...prefs,
        heygenVoiceId: "",
        heygenVoiceAudioAssetId: "",
        lastCaricatureAssetId: "",
      });
    }
  }, [profileIdForPrefs, sortedCaricatureAssets]);

  useEffect(() => {
    if (avatarTrack !== "caricature" || !hasAnyCaricatureReady) {
      return;
    }
    const stillValid = sortedCaricatureAssets.some(
      (asset) => asset.id === selectedCaricatureAssetId,
    );
    if (!stillValid && editorialCaricature) {
      selectCaricatureForVideo(editorialCaricature.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatarTrack, hasAnyCaricatureReady, sortedCaricatureAssets, selectedCaricatureAssetId]);

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
    if (!profileIdForPrefs) {
      return;
    }

    const avatarParam = avatarSlugFromSearchParam(searchParams.get("avatar"));
    const prefs = readCuradorHeygenPrefs(profileIdForPrefs);
    const slug = avatarParam ?? prefs.lastAvatarTipoSlug ?? null;
    if (!slug) {
      pendingAvatarSlugRef.current = null;
      return;
    }

    pendingAvatarSlugRef.current = slug;
    applyAvatarTipoSlug(slug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileIdForPrefs, searchParams]);

  useEffect(() => {
    const slug = pendingAvatarSlugRef.current;
    if (!slug || slug === "foto-real") {
      return;
    }
    if (slug === "caricato" && editorialCaricature) {
      selectProductionTemplate("caricature_editorial");
      pendingAvatarSlugRef.current = null;
      return;
    }
    if (slug === "3d" && mascotCaricature) {
      selectProductionTemplate("caricature_mascot_3d");
      pendingAvatarSlugRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorialCaricature?.id, mascotCaricature?.id]);

  useEffect(() => {
    if (mode === "independente") {
      return;
    }
    const sugestaoId = searchParams.get("sugestao")?.trim();
    if (!sugestaoId) {
      setSentinelSuggestion(null);
      setSentinelLoadError(null);
      setIsLoadingSentinelSuggestion(false);
      return;
    }

    let cancelled = false;
    setIsLoadingSentinelSuggestion(true);
    setSentinelLoadError(null);

    void (async () => {
      try {
        const response = await fetch(
          `/api/sentinel/suggestions/${encodeURIComponent(sugestaoId)}`,
        );
        const payload = (await response.json()) as {
          suggestion?: MockSentinelSuggestion;
          message?: string;
        };
        if (cancelled) {
          return;
        }
        if (!response.ok || !payload.suggestion) {
          setSentinelSuggestion(null);
          setSentinelLoadError(payload.message || "Não foi possível carregar a pauta selecionada.");
          return;
        }
        setSentinelSuggestion(payload.suggestion);
        const topic = payload.suggestion.topic.trim();
        if (topic) {
          setCreativeForm((current) =>
            current.topic === topic ? current : { ...current, topic },
          );
        }
      } catch {
        if (!cancelled) {
          setSentinelSuggestion(null);
          setSentinelLoadError("Não foi possível carregar a pauta selecionada.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSentinelSuggestion(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mode, searchParams]);

  useEffect(() => {
    if (mode === "independente") {
      return;
    }
    const sugestaoId = searchParams.get("sugestao")?.trim();
    if (sugestaoId) {
      return;
    }
    const tema = searchParams.get("tema")?.trim();
    if (!tema) {
      return;
    }
    setCreativeForm((current) =>
      current.topic === tema ? current : { ...current, topic: tema },
    );
  }, [searchParams, mode]);

  const criativoGateReason = getCriativoGateReason({
    spectrum: profileForm.spectrum,
    hasVoiceAudio: Boolean(voiceAudioAssets[0]),
    hasPhotoAvatar: Boolean(avatarImageAssets[0]),
    hasCaricaturePair: hasAnyCaricatureReady,
  });

  return (
    <>
    <div className="max-w-5xl mx-auto p-8 relative z-10 pb-20">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-64 bg-cyan-500/5 blur-[120px] pointer-events-none rounded-full" />

      <header className={`relative z-10 ${mode === "independente" ? "mb-5" : "mb-8"}`}>
        {mode === "independente" ? (
          <>
            <h1 className="text-2xl font-bold text-white tracking-tight mb-2">
              Criar conteúdo independente
            </h1>
            <p className="text-slate-400 text-sm md:text-base max-w-3xl leading-snug">
              <strong className="text-slate-300 font-medium">
                Use seu avatar para falar o que você quiser publicar.
              </strong>{" "}
              Sem estúdio, sem gravações demoradas, sem ensaios e sem despesas. E o melhor, é você
              falando com a sua voz para o seu público em segundos.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-white tracking-tight mb-2">Nova pauta</h1>
            <p className="text-slate-400 text-sm md:text-base max-w-2xl">
              Defina o enquadramento desta pauta, aprove o roteiro e gere o vídeo.
            </p>
          </>
        )}
      </header>

      {mode === "padrao" ? (
        <div className="mb-6 relative z-10">
          <Link href="/monitoramento" className={CRIATIVO_SECONDARY_BTN_CLASS}>
            Voltar para monitoramento
          </Link>
        </div>
      ) : null}

      {mode === "padrao" && isLoadingSentinelSuggestion ? (
        <div className={`${CRIATIVO_PANEL_CLASS} relative z-10`}>
          <p className={`${CRIATIVO_HELPER_CLASS} text-center py-2`}>Carregando pauta…</p>
        </div>
      ) : null}

      {mode === "padrao" && sentinelLoadError ? (
        <div className={`${CRIATIVO_PANEL_CLASS} relative z-10 mb-8`}>
          <p className="text-sm text-amber-300/90 leading-relaxed">{sentinelLoadError}</p>
        </div>
      ) : null}

      {mode === "padrao" && sentinelSuggestion ? (
        <PautaContextCard suggestion={sentinelSuggestion} />
      ) : null}

      {criativoGateReason ? (
        <div className={`${CRIATIVO_PANEL_CLASS} persona-form-group relative z-10`}>
          <p className="text-sm text-amber-300/90 leading-relaxed">{criativoGateReason}</p>
          <div className="mt-4">
            <Link href="/curador" className={CRIATIVO_PRIMARY_BTN_CLASS}>
              Ir para o Curador
            </Link>
          </div>
        </div>
      ) : null}

      {!criativoGateReason ? (
      <>
      <div className={`${CRIATIVO_PANEL_CLASS} persona-form-group persona-selection-panel relative z-10`}>
        {renderArchetypeIntro()}

        <div className="persona-selection-block">
          <label className={CRIATIVO_LABEL_CLASS}>Arquétipo</label>
              <div className="flex flex-wrap gap-1 persona-top-gap">
                {archetypeOptions.map((option) => (
                  <ThemeTagPill
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
                  </ThemeTagPill>
                ))}
              </div>
            </div>

        <div className="persona-selection-block mt-6">
          <label className={CRIATIVO_LABEL_CLASS}>Tom de linguagem</label>
              <div className="flex flex-wrap gap-1 persona-top-gap">
                {voiceToneOptions.map((tone) => (
                  <ThemeTagPill
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
                  </ThemeTagPill>
                ))}
              </div>
            </div>
          </div>

          {mode === "independente" ? (
            <div className={`${CRIATIVO_PANEL_CLASS} persona-form-group persona-script-flow relative z-10`}>
              <div className="persona-script-block">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <label className={CRIATIVO_LABEL_CLASS}>Digite o que deseja falar</label>
                  <span className="text-xs text-slate-500">
                    Limite de 1 minuto (até {MAX_SCRIPT_WORDS} palavras)
                  </span>
                </div>
                <textarea
                  className={`${CRIATIVO_INPUT_CLASS} mt-3`}
                  value={freePrompt}
                  onChange={(event) => setFreePrompt(event.target.value)}
                  rows={5}
                  placeholder="Escreva aqui a mensagem que deseja que seu avatar fale..."
                />
                <div className="persona-script-footer">
                  <p
                    className={
                      freePromptWordCount > MAX_SCRIPT_WORDS
                        ? "persona-script-meta is-warning"
                        : "persona-script-meta"
                    }
                  >
                    {freePromptWordCount}/{MAX_SCRIPT_WORDS} palavras
                  </p>
                </div>
                <div className="bg-blue-950/20 border border-blue-900/30 rounded-lg py-2.5 px-3.5 flex items-center gap-2 text-[11px] text-cyan-400 mt-2">
                  <svg className="h-4 w-4 shrink-0 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>
                    <strong>Dica de Performance:</strong> publicações virais tendem a ter entre 15
                    e 30 segundos.
                  </span>
                </div>
              </div>
            </div>
          ) : (
          <div className={`${CRIATIVO_PANEL_CLASS} persona-form-group persona-script-flow relative z-10`}>
            <div className="persona-script-block">
              <label className={CRIATIVO_LABEL_CLASS}>Tema do vídeo</label>
              <textarea
                className={`${CRIATIVO_INPUT_CLASS} mt-3`}
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
                    className={CRIATIVO_PRIMARY_BTN_CLASS}
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
                <label className={CRIATIVO_LABEL_CLASS}>Aprovação do roteiro</label>
                <p className={`${CRIATIVO_HELPER_CLASS} mt-1 mb-3`}>
                  Veja o roteiro do vídeo que será produzido. Altere-o conforme necessário. Máximo
                  de {MAX_SCRIPT_WORDS} palavras (ou ~1 minuto).
                </p>
                <div className="bg-blue-950/20 border border-blue-900/30 rounded-lg py-2.5 px-3.5 flex items-start gap-2 text-[11px] text-cyan-400 mt-2">
                  <svg className="h-4 w-4 shrink-0 text-cyan-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>
                    <strong>Aviso:</strong> após a aprovação, nosso Agente Auditor confere cada
                    afirmação do roteiro contra a notícia de origem e as matérias capturadas pelo
                    monitoramento. Roteiros com afirmações contestadas são bloqueados para sua
                    revisão — nada é produzido com informação marcada como falsa.
                  </span>
                </div>
                <textarea
                  className={`${CRIATIVO_INPUT_CLASS} mt-3`}
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
                    className={CRIATIVO_PRIMARY_BTN_CLASS}
                    onClick={() => void handleApproveScript()}
                    disabled={
                      !scriptDraft.trim() ||
                      scriptWordCount > MAX_SCRIPT_WORDS ||
                      isFactChecking
                    }
                  >
                    {isFactChecking ? "Validando fatos..." : "Aprovar roteiro"}
                  </button>
                </div>
                {factCheckResult &&
                factCheckResult.verdict !== "skipped" &&
                !isFactCheckHeuristicFallback(factCheckResult) ? (
                  <p className="persona-helper-text persona-top-gap">
                    Validador: {factCheckResult.verdict} ({factCheckResult.confidence}%) —{" "}
                    {factCheckResult.summary}
                  </p>
                ) : null}
                {manualReviewConsentRequired ? (
                  <div className="persona-checkbox-row persona-top-gap pt-4 border-t border-slate-800/60">
                    <p className={`${CRIATIVO_HELPER_CLASS} mb-3 w-full`}>
                      O validador automático não pôde concluir a checagem factual neste momento.
                      Revise o roteiro com base nas fontes da pauta antes de produzir o vídeo.
                    </p>
                    <label className="persona-checkbox !items-start cursor-pointer">
                      <input
                        id="script-manual-review-consent"
                        type="checkbox"
                        checked={manualReviewConsent}
                        onChange={(event) => setManualReviewConsent(event.target.checked)}
                        className="w-4 h-4 mt-0.5 shrink-0 accent-cyan-500"
                      />
                      <span className="text-xs leading-relaxed">
                        {SCRIPT_MANUAL_REVIEW_CONSENT_TEXT}{" "}
                        <Link href="/compliance" className="text-cyan-400 no-underline hover:underline">
                          Ver Compliance TSE
                        </Link>
                      </span>
                    </label>
                  </div>
                ) : null}
                {scriptEditedAfterApproval ? (
                  <div className="persona-checkbox-row persona-top-gap">
                    <input
                      id="script-edit-consent"
                      type="checkbox"
                      checked={scriptEditConsent}
                      onChange={(event) => setScriptEditConsent(event.target.checked)}
                    />
                    <label htmlFor="script-edit-consent">
                      {SCRIPT_EDIT_CONSENT_TEXT}{" "}
                      <Link href="/compliance" className="text-cyan-400 hover:underline">
                        Ver Compliance TSE
                      </Link>
                    </label>
                  </div>
                ) : null}
                {scriptClearedForProduction ? (
                  <p className="persona-script-approved">
                    Roteiro aprovado. Você já pode produzir o conteúdo.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
          )}

          <div className={`${CRIATIVO_PANEL_CLASS} relative z-10`}>
            <div className="border-b border-slate-800 pb-4 mb-6">
              <h2 className="text-xl font-bold text-white">Produzir vídeo</h2>
            </div>

          {renderProductionTemplateSelector()}

          <div className="persona-production-actions mt-6">
            <div className="persona-generate-row">
              <button
                type="button"
                className={`${CRIATIVO_PRIMARY_BTN_CLASS} px-6 py-3`}
                onClick={() => void handleGenerate()}
                disabled={
                  isGenerating ||
                  (isPollingTwinTraining && !twinReadyForVideo) ||
                  !canProduceContent ||
                  ((avatarTrack === "caricature" || avatarTrack === "photo_real") && isTraining) ||
                  (mode === "independente" &&
                    (!freePrompt.trim() || freePromptWordCount > MAX_SCRIPT_WORDS))
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
                <div className="persona-video-ready-row mt-4">
                  <button
                    type="button"
                    onClick={() => setExportModalOpen(true)}
                    className={`${CRIATIVO_PRIMARY_BTN_CLASS} px-6 py-3`}
                  >
                    Ver vídeo
                  </button>
                </div>
              )}
              {captionUrl && (
                <p className="persona-helper-text">
                  Legendas:{" "}
                  <a href={captionUrl} target="_blank" rel="noreferrer">
                    abrir
                  </a>{" "}
                  ·{" "}
                  <button
                    type="button"
                    className="inline bg-transparent p-0 text-cyan-400 hover:underline"
                    onClick={() =>
                      void navigator.clipboard.writeText(withTseCaptionTag(captionUrl))
                    }
                  >
                    Copiar legenda
                  </button>
                </p>
              )}
            </>
          )}
          </div>
          </>
          ) : null}
    </div>
    {videoUrl && videoId ? (
      <ExportComplianceModal
        open={exportModalOpen}
        mediaId={videoId}
        mediaUrl={videoUrl}
        onClose={() => setExportModalOpen(false)}
        onConfirmed={(url) => {
          window.open(url, "_blank", "noopener,noreferrer");
        }}
      />
    ) : null}
    </>
  );
}

