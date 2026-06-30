"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useProductApp } from "@/components/product/provider";
import {
  IdeologicalSpectrumSlider,
  MaterialUploadField,
  BaseMaterialsReadiness,
  PersonaHeaderIcon,
  PHOTO_REAL_VARIANT_HINT,
  PHOTO_REAL_VARIANT_LABEL,
  PhotoAvatarVariantRow,
  TwinLookMedia,
  parseJsonOrText,
  type AvatarTrack,
  type PrivateTwinLook,
  type ProductionSource,
  defaultAvatarTrack,
} from "@/components/product/persona-shared";
import {
  formatProviderLimitHint,
  readCuradorHeygenPrefs,
  sanitizeProviderFacingMessage,
  shouldInvalidateHeygenVoiceClone,
  writeCuradorHeygenPrefs,
} from "@/lib/curador-heygen-prefs";
import {
  caricatureVariantGeneratingLabel,
  caricatureVariantLabel,
  caricatureAssetMatchesVariant,
  pickLatestCaricatureForVariant,
} from "@/lib/caricature-asset-variant";
import {
  formatTwinLookDisplayName,
  isConsentApproved,
  isTwinLookReadyForVideo,
  isUsableRecordedDigitalTwin,
  resolveAvatarTrainingName,
  trainingPhaseFromTwinLook,
  trainingPhaseMessage,
  twinGroupRequiresConsentLink,
  type HeyGenTrainingPhase,
  type TwinLookDisplayMeta,
} from "@/lib/heygen-twin-display";
import {
  performRemoteTwinGroupDelete,
  resolveActiveTwinGroupId,
} from "@/lib/heygen-avatar-refazer";
import { fetchHeyGenConsentLink } from "@/lib/heygen-consent-client";
import { fetchHeygenApi } from "@/lib/heygen-client-override";
import { isHeygenDigitalTwinEnabled } from "@/lib/feature-flags";
import type { CaricatureVariant } from "@/lib/openai-caricature-prompts";
import { validateTrainingVideoFile } from "@/lib/training-video-upload";
import type { ProfileTrainingAsset } from "@/lib/types";

type TrainingBannerState =
  | "hidden"
  | "started"
  | "awaiting_consent"
  | "processing"
  | "ready"
  | "failed"
  | "completed";

export function CuradorPageV2({
  scope = "full",
  onTwinStatusChange,
}: {
  scope?: "full" | "avatar";
  onTwinStatusChange?: () => void;
} = {}) {
  const router = useRouter();
  const digitalTwinEnabled = isHeygenDigitalTwinEnabled();
  const uploadInputId = useId();
  const [isTraining, setIsTraining] = useState(false);
  const [trainingError, setTrainingError] = useState<string | null>(null);
  const [trainingInfo, setTrainingInfo] = useState<string | null>(null);
  const [heygenAvatarId, setHeygenAvatarId] = useState<string>("");
  const [heygenAvatarGroupId, setHeygenAvatarGroupId] = useState<string>("");
  const [heygenVoiceId, setHeygenVoiceId] = useState<string>("");
  const [heygenConsentUrl, setHeygenConsentUrl] = useState<string>("");
  const [twinConsentPending, setTwinConsentPending] = useState(false);
  const [productionSource, setProductionSource] = useState<ProductionSource>("train_new");
  const restoredHeygenPrefsRef = useRef(false);
  const [trainingStarted, setTrainingStarted] = useState(false);
  const [trainingBannerState, setTrainingBannerState] =
    useState<TrainingBannerState>("hidden");
  const [isGeneratingCaricature, setIsGeneratingCaricature] = useState(false);
  const [caricatureGenerateStep, setCaricatureGenerateStep] = useState<
    "idle" | "editorial" | "mascot_3d"
  >("idle");
  const [caricatureError, setCaricatureError] = useState<string | null>(null);
  const [caricatureInfo, setCaricatureInfo] = useState<string | null>(null);
  const [isLoadingLooks, setIsLoadingLooks] = useState(false);
  const [isDeletingTwinGroup, setIsDeletingTwinGroup] = useState(false);
  const [twinRefazerError, setTwinRefazerError] = useState<string | null>(null);
  const [twinRefazerInfo, setTwinRefazerInfo] = useState<string | null>(null);
  const [caricatureRefazerError, setCaricatureRefazerError] = useState<string | null>(null);
  const [caricatureRefazerInfo, setCaricatureRefazerInfo] = useState<string | null>(null);
  const [looksError, setLooksError] = useState<string | null>(null);
  const autoLoadedLooksRef = useRef(false);
  const [privateTwinLooks, setPrivateTwinLooks] = useState<PrivateTwinLook[]>([]);

  const twinPollActiveRef = useRef(false);
  const autoSyncTwinOnLoadRef = useRef(false);
  const [isPollingTwinTraining, setIsPollingTwinTraining] = useState(false);
  const [materialUploadErrors, setMaterialUploadErrors] = useState<
    Partial<Record<"voice_audio" | "avatar_image" | "dataset", string | null>>
  >({});

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
    removeTrainingAssetsById,
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
  const illustratedReadyCount =
    Number(Boolean(editorialCaricature)) + Number(Boolean(mascotCaricature));
  const canGenerateCaricature = Boolean(avatarImageAssets[0]);
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
  const activeTwinConsentStatus =
    productionTwinLook?.consentStatus ?? linkedTwinLook?.consentStatus;
  const activeTwinGroupStatus =
    productionTwinLook?.groupStatus ?? linkedTwinLook?.groupStatus;
  const twinConsentStillRequired =
    twinConsentPending ||
    twinGroupRequiresConsentLink(
      activeTwinConsentStatus,
      activeTwinGroupStatus,
    );
  const twinReadyForVideo =
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
      setTwinConsentPending(false);
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
    if (phase === "ready" || phase === "processing") {
      setHeygenConsentUrl("");
      setTwinConsentPending(false);
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

  function persistHeygenPrefs(overrides?: {
    heygenAvatarId?: string;
    heygenVoiceId?: string;
    heygenVoiceAudioAssetId?: string;
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
      heygenVoiceAudioAssetId:
        overrides?.heygenVoiceAudioAssetId ?? voiceAudioAssets[0]?.id ?? "",
      heygenAvatarGroupId: overrides?.heygenAvatarGroupId ?? heygenAvatarGroupId,
      lastCaricatureAssetId:
        overrides?.lastCaricatureAssetId ?? sortedCaricatureAssets[0]?.id,
      avatarTrack: overrides?.avatarTrack ?? defaultAvatarTrack(),
      productionSource: overrides?.productionSource ?? productionSource,
    });
  }

  function formatCaricatureRequestError(
    response: Response,
    payload: { message?: string },
  ) {
    const message = payload.message?.trim();
    if (response.status === 401) {
      return (
        message ||
        "Sessao expirada ou sem permissao. Faca login novamente e tente gerar a caricatura."
      );
    }
    if (response.status === 503) {
      return sanitizeProviderFacingMessage(
        message || "Serviço de geração de caricatura indisponível. Tente novamente mais tarde.",
      );
    }
    if (message) {
      return sanitizeProviderFacingMessage(message);
    }
    return `Não foi possível gerar a caricatura (${response.status}).`;
  }

  async function requestCaricatureVariant(
    variant: CaricatureVariant,
  ): Promise<{ assetId: string; previewUrl: string | null }> {
    if (!assetReferenceId) {
      throw new Error("Salve o perfil antes de gerar a caricatura.");
    }

    const response = await fetch("/api/openai/caricature", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceAssetId: selectedAvatarImage?.id,
        referenceId: assetReferenceId,
        variant,
      }),
    });
    const payload = await parseJsonOrText<{
      asset?: ProfileTrainingAsset;
      previewUrl?: string;
      message?: string;
    }>(response);

    if (!response.ok) {
      throw new Error(formatCaricatureRequestError(response, payload));
    }

    if (payload.asset) {
      appendTrainingAssets([payload.asset]);
    }

    const assetId = payload.asset?.id?.trim() ?? "";
    if (!assetId) {
      throw new Error("Resposta inválida: caricatura sem identificador.");
    }

    return {
      assetId,
      previewUrl: payload.previewUrl?.trim() || null,
    };
  }

  async function handleGenerateCaricatureVariant(variant: CaricatureVariant) {
    if (!canGenerateCaricature || isTraining || isGeneratingCaricature) {
      return;
    }

    setCaricatureError(null);
    setCaricatureInfo(null);
    setCaricatureRefazerError(null);
    setCaricatureRefazerInfo(null);
    setIsGeneratingCaricature(true);
    setCaricatureGenerateStep(variant);

    try {
      if (!assetReferenceId) {
        throw new Error("Envie a foto do rosto antes de gerar a caricatura.");
      }
      await requestCaricatureVariant(variant);
      setHeygenVoiceId("");
      persistHeygenPrefs({ heygenVoiceId: "", heygenVoiceAudioAssetId: "" });
      setTrainingInfo(null);
      setCaricatureInfo(
        variant === "mascot_3d"
          ? "Mascote 3D gerado. Escolha o modelo no Criativo."
          : "Caricatura gerada. Escolha o modelo no Criativo.",
      );
    } catch (error) {
      setCaricatureError(
        error instanceof Error ? error.message : "Erro ao gerar caricatura.",
      );
    } finally {
      setIsGeneratingCaricature(false);
      setCaricatureGenerateStep("idle");
    }
  }

  async function handleDeleteCaricatureVariant(variant: CaricatureVariant) {
    if (isDeletingTwinGroup || isGeneratingCaricature) {
      return;
    }

    const variantLabel = caricatureVariantLabel(variant);
    const confirmed = window.confirm(
      `Refazer ${variantLabel}?\n\n` +
        "A imagem atual será removida e a voz vinculada será limpa. " +
        "O gêmeo digital e as outras variantes não serão apagados.",
    );
    if (!confirmed) {
      return;
    }

    setCaricatureRefazerError(null);
    setCaricatureRefazerInfo(null);
    setCaricatureError(null);
    setIsDeletingTwinGroup(true);

    try {
      const variantAssetIds = caricatureAssets
        .filter((asset) => caricatureAssetMatchesVariant(asset, variant))
        .map((asset) => asset.id);

      for (const assetId of variantAssetIds) {
        const response = await fetch(
          `/api/profile/training-assets/${encodeURIComponent(assetId)}`,
          { method: "DELETE", credentials: "same-origin" },
        );
        const payload = await parseJsonOrText<{ message?: string }>(response);
        if (!response.ok) {
          throw new Error(payload.message || "Não foi possível remover a caricatura.");
        }
      }

      removeTrainingAssetsById(variantAssetIds);
      setHeygenVoiceId("");
      setCaricatureInfo(null);

      if (profileIdForPrefs) {
        writeCuradorHeygenPrefs(profileIdForPrefs, {
          heygenVoiceId: "",
          heygenVoiceAudioAssetId: "",
          lastCaricatureAssetId: "",
          avatarTrack: "caricature",
          productionSource: "train_new",
        });
      }

      setCaricatureRefazerInfo(
        sanitizeProviderFacingMessage(
          `Pronto para gerar novamente. Clique em "Gerar" em ${variantLabel}.`,
        ),
      );
    } catch (error) {
      setCaricatureRefazerError(
        error instanceof Error ? error.message : "Não foi possível refazer a caricatura.",
      );
    } finally {
      setIsDeletingTwinGroup(false);
    }
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
    mode?: "digital_twin" | "caricature";
  }): Promise<HeyGenTrainPayload> {
    const trainMode = input?.mode ?? "digital_twin";
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
        caricatureAssetId: undefined,
      }),
    });
    const payload = await parseJsonOrText<HeyGenTrainPayload & { message?: string }>(
      response,
    );

    if (!response.ok) {
      throw new Error(payload.message || "Não foi possível treinar o avatar.");
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
        setTwinConsentPending(false);
      }
    } catch {
      // mantem mensagem generica; usuário pode sincronizar de novo
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

    const consentStillRequired =
      payload.needsConsent !== false &&
      twinGroupRequiresConsentLink(
        payload.consentStatus,
        payload.avatarGroupStatus,
      );

    let phase = payload.trainingPhase;
    if (phase === "awaiting_consent" && !consentStillRequired) {
      phase = "processing";
    }

    const nextConsentUrl = consentStillRequired
      ? String(payload.consentUrl ?? "").trim()
      : "";
    setHeygenConsentUrl(nextConsentUrl);
    setTwinConsentPending(consentStillRequired);

    if (phase) {
      if (consentStillRequired && phase === "awaiting_consent") {
        setTrainingInfo(
          trainingPhaseMessage("awaiting_consent", {
            hasConsentUrl: Boolean(nextConsentUrl),
          }),
        );
      } else if (phase === "processing") {
        setTrainingInfo(trainingPhaseMessage("processing"));
      } else if (phase === "ready") {
        setTrainingInfo(trainingPhaseMessage("ready"));
      } else if (phase === "failed") {
        setTrainingInfo(trainingPhaseMessage("failed"));
      } else {
        setTrainingInfo(null);
      }
    } else {
      setTrainingInfo(payload.message?.trim() || null);
    }

    if (payload.trainingPhase) {
      applyTrainingPhase(phase ?? payload.trainingPhase);
      if (phase === "awaiting_consent") {
        void ensureTwinConsentUrl({
          groupId: nextGroupId || heygenAvatarGroupId,
          consentStatus: payload.consentStatus ?? null,
        });
      }
    }

    persistHeygenPrefs({
      heygenAvatarId: nextAvatarId || heygenAvatarId,
      heygenVoiceId: payload.voiceId?.trim() || heygenVoiceId,
      heygenVoiceAudioAssetId: voiceAudioAssets[0]?.id ?? "",
      heygenAvatarGroupId: nextGroupId || heygenAvatarGroupId,
      lastCaricatureAssetId: sortedCaricatureAssets[0]?.id,
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
    const trainMode = options?.mode ?? "digital_twin";
    setTrainingError(null);
    setIsTraining(true);
    setTrainingStarted(true);

    const isTwinSync =
      trainMode === "digital_twin" && Boolean(heygenAvatarGroupId.trim());

    if (!isTwinSync) {
      setHeygenConsentUrl("");
      setTwinConsentPending(false);
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

  async function handleStartRealisticTraining() {
    if (!canStartTwinTraining || isTraining) {
      return;
    }
    setTrainingBannerState("started");
    setTrainingError(null);
    setTwinRefazerError(null);
    setTwinRefazerInfo(null);
    try {
      await handleTrainHeyGen({ mode: "digital_twin" });
      persistHeygenPrefs({ productionSource: "train_new" });
    } catch {
      setTrainingBannerState("hidden");
    }
  }

  function renderCaricatureVariantRow(
    variant: CaricatureVariant,
    hint: string,
    caricature: (typeof editorialCaricature) | (typeof mascotCaricature),
  ) {
    const hasPhoto = Boolean(avatarImageAssets[0]);
    const isReady = Boolean(caricature);
    const isGeneratingThis =
      isGeneratingCaricature && caricatureGenerateStep === variant;

    let statusLabel: string | undefined;
    let statusTone: "ok" | "warn" | "neutral" = "neutral";
    let action: ReactNode;

    if (isReady) {
      statusLabel = "Pronta";
      statusTone = "ok";
      action = (
        <button
          type="button"
          className="persona-btn persona-btn-secondary persona-btn-compact"
          onClick={() => void handleDeleteCaricatureVariant(variant)}
          disabled={isDeletingTwinGroup || isTraining || isGeneratingCaricature}
        >
          {isDeletingTwinGroup ? "Refazendo…" : "Refazer"}
        </button>
      );
    } else if (!hasPhoto) {
      statusLabel = "Falta foto";
      statusTone = "warn";
    } else {
      action = (
        <button
          type="button"
          className="persona-btn persona-btn-secondary persona-btn-compact"
          onClick={() => void handleGenerateCaricatureVariant(variant)}
          disabled={!canGenerateCaricature || isTraining || isGeneratingCaricature}
        >
          {isGeneratingThis ? (
            <span className="persona-loading-row">
              <span className="persona-spinner" aria-hidden="true" />
              {caricatureVariantGeneratingLabel(variant)}
            </span>
          ) : (
            "Gerar"
          )}
        </button>
      );
    }

    return (
      <PhotoAvatarVariantRow
        key={variant}
        label={caricatureVariantLabel(variant)}
        hint={hint}
        statusLabel={statusLabel}
        statusTone={statusTone}
        previewAssetId={caricature?.id ?? avatarImageAssets[0]?.id}
        action={action}
      />
    );
  }

  function renderPhotoAvatarsPrepareBlock() {
    const hasPhoto = Boolean(avatarImageAssets[0]);
    const photoRealStatus = !hasPhoto
      ? { label: "Falta foto", tone: "warn" as const }
      : { label: "Pronta para vídeo", tone: "ok" as const };

    return (
      <div className="persona-prepare-type-card persona-prepare-type-card--caricature">
        <div className="persona-prepare-type-card-header">
          <h3 className="persona-prepare-type-card-title">
            Avatares por foto
            <span className="persona-badge-track persona-badge-track-caricature">Foto</span>
          </h3>
          <p className="persona-prepare-type-card-desc">
            Três estilos a partir da mesma foto de rosto. A escolha do modelo é feita na produção
            do vídeo.
          </p>
        </div>

        <div className="persona-photo-avatar-variant-list persona-top-gap">
          <PhotoAvatarVariantRow
            label={PHOTO_REAL_VARIANT_LABEL}
            hint={PHOTO_REAL_VARIANT_HINT}
            statusLabel={photoRealStatus.label}
            statusTone={photoRealStatus.tone}
            previewAssetId={avatarImageAssets[0]?.id}
          />
          {renderCaricatureVariantRow(
            "editorial",
            "Versão ilustrada editorial",
            editorialCaricature,
          )}
          {renderCaricatureVariantRow("mascot_3d", "Versão mascote 3D", mascotCaricature)}
        </div>

        {caricatureRefazerError ? (
          <>
            <p
              className="persona-twin-purge-banner is-error persona-top-gap"
              role="status"
            >
              {caricatureRefazerError}
            </p>
            {formatProviderLimitHint(caricatureRefazerError) ? (
              <p className="persona-helper-text persona-top-gap">
                {formatProviderLimitHint(caricatureRefazerError)}
              </p>
            ) : null}
          </>
        ) : null}
        {caricatureRefazerInfo ? (
          <p className="persona-twin-purge-banner is-success persona-top-gap" role="status">
            {caricatureRefazerInfo}
          </p>
        ) : null}
        {caricatureError ? (
          <p className="persona-helper-text persona-helper-highlight persona-top-gap">
            {caricatureError}
          </p>
        ) : null}
        {caricatureInfo ? (
          <p className="persona-helper-text persona-top-gap">{caricatureInfo}</p>
        ) : null}
      </div>
    );
  }

  function renderTwinPrepareBlock() {
    return (
      <div className="persona-prepare-type-card persona-prepare-type-card--twin">
        <div className="persona-prepare-type-card-header">
          <h3 className="persona-prepare-type-card-title">
            Gêmeo digital
            <span className="persona-badge-track persona-badge-track-twin">Vídeo realista</span>
          </h3>
          <p className="persona-prepare-type-card-desc">
            Sua aparência em vídeos falados, gerada a partir do vídeo de treino enviado.
          </p>
        </div>
        {hasExistingTwin && selectedTwinLook ? (
          <>
            <div className="persona-prepare-ready-row">
              <div className="persona-prepare-ready-thumb" aria-hidden="true">
                <TwinLookMedia
                  look={selectedTwinLook}
                  className="persona-prepare-thumb-media"
                  compact
                  profile={profileForm}
                  fallbackAssetId={latestTrainingVideo?.id ?? avatarImageAssets[0]?.id}
                  fallbackPreferVideo={Boolean(latestTrainingVideo?.id)}
                />
              </div>
              <div className="persona-prepare-ready-meta">
                <span className="persona-prepare-ready-label">Pronto para vídeos</span>
                <span className="persona-twin-look-caption">
                  {formatTwinLookDisplayName(selectedTwinLook.name, profileForm)}
                </span>
              </div>
              <div className="persona-prepare-ready-actions">
                <button
                  type="button"
                  className="persona-btn persona-btn-secondary persona-btn-compact"
                  onClick={() => void handleDeleteAvatarPerson("realistic")}
                  disabled={isDeletingTwinGroup || isTraining || isGeneratingCaricature}
                >
                  {isDeletingTwinGroup ? "Refazendo…" : "Refazer"}
                </button>
              </div>
            </div>
          </>
        ) : hasAnyTwinOnPlatform ? (
          <div className="persona-prepare-actions-row persona-top-gap">
            <button
              type="button"
              className="persona-btn persona-btn-secondary"
              onClick={() => void handleDeleteAvatarPerson("realistic")}
              disabled={isDeletingTwinGroup || isTraining || isGeneratingCaricature}
            >
              {isDeletingTwinGroup ? "Refazendo gêmeo digital…" : "Refazer gêmeo digital"}
            </button>
          </div>
        ) : (
          renderTrainingStartControl(canStartTwinTraining, handleStartRealisticTraining, {
            twinSyncMode: Boolean(heygenAvatarGroupId.trim()),
          })
        )}
        {heygenConsentUrl && twinConsentStillRequired ? (
          <p className="persona-helper-text persona-helper-highlight persona-top-gap">
            Consentimento necessário:{" "}
            <a href={heygenConsentUrl} target="_blank" rel="noreferrer">
              finalizar criação do gêmeo digital
            </a>
          </p>
        ) : trainingBannerState === "awaiting_consent" && twinConsentStillRequired ? (
          <p className="persona-helper-text persona-top-gap">Treino iniciado.</p>
        ) : null}
        {hasAnyTwinOnPlatform && !twinReadyForVideo ? (
          <div className="persona-top-gap">
            <p className="persona-helper-text persona-helper-highlight">
              {isPollingTwinTraining
                ? "Sincronizando com a plataforma e finalizando o gêmeo digital…"
                : trainingBannerState === "awaiting_consent" && twinConsentStillRequired
                  ? heygenConsentUrl
                    ? "Finalize o consentimento no link acima para continuar."
                    : "Treino iniciado."
                  : trainingBannerState === "processing"
                    ? trainingPhaseMessage("processing")
                    : "O gêmeo ainda não está pronto nesta sessão."}
            </p>
            {!isPollingTwinTraining ? (
              <div className="persona-cta-row persona-top-gap">
                <button
                  type="button"
                  className="persona-btn persona-btn-secondary"
                  onClick={() => {
                    autoSyncTwinOnLoadRef.current = false;
                    void pollHeyGenTwinUntilReady();
                  }}
                  disabled={isTraining || isDeletingTwinGroup}
                >
                  Sincronizar com a plataforma
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
        {twinRefazerError ? (
          <>
            <p className="persona-twin-purge-banner is-error persona-top-gap" role="status">
              {twinRefazerError}
            </p>
            {formatProviderLimitHint(twinRefazerError) ? (
              <p className="persona-helper-text persona-top-gap">
                {formatProviderLimitHint(twinRefazerError)}
              </p>
            ) : null}
          </>
        ) : null}
        {twinRefazerInfo ? (
          <p className="persona-twin-purge-banner is-success persona-top-gap" role="status">
            {twinRefazerInfo}
          </p>
        ) : null}
        {trainingError ? (
          <>
            <p className="persona-helper-text persona-helper-highlight persona-top-gap">
              {trainingError}
            </p>
            {formatProviderLimitHint(trainingError) ? (
              <p className="persona-helper-text">{formatProviderLimitHint(trainingError)}</p>
            ) : null}
          </>
        ) : null}
        {trainingInfo && trainingInfo !== "Treinamento iniciado." ? (
          <p className="persona-helper-text persona-top-gap">{trainingInfo}</p>
        ) : null}
      </div>
    );
  }

  function renderPrepareAvatarsSection() {
    return (
      <div className="persona-prepare-generation-stack">
        {digitalTwinEnabled ? renderTwinPrepareBlock() : null}
        {renderPhotoAvatarsPrepareBlock()}
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
          twinConsentStillRequired ? (
            <p className="persona-script-approved persona-training-phase-hint">
              {trainingPhaseMessage("awaiting_consent", {
                hasConsentUrl: Boolean(heygenConsentUrl.trim()),
              })}
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
    if (!digitalTwinEnabled) {
      return;
    }

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
        throw new Error(looksPayload.message || "Não foi possível listar avatares.");
      }
      if (!groupsResponse.ok) {
        throw new Error(groupsPayload.message || "Não foi possível listar personagens.");
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
            setTwinConsentPending(false);
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
        error instanceof Error ? error.message : "Não foi possível listar avatares.",
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

    setTwinRefazerError(null);
    setTwinRefazerInfo(null);
    setCaricatureRefazerError(null);
    setCaricatureRefazerInfo(null);

    const confirmed = window.confirm(
      isCaricatureTrack
        ? "Refazer a caricatura?\n\n" +
            "As imagens caricatas atuais serão removidas e a voz vinculada será limpa. " +
            "O gêmeo digital não será apagado.\n\n" +
            "Depois você poderá enviar nova foto e áudio e gerar um novo par."
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
        ? "Pronto para gerar novamente. Clique em \"Gerar\" na variante desejada."
        : "Pronto para treinar um novo gêmeo. Envie áudio e vídeo abaixo.";

      if (isCaricatureTrack) {
        const caricatureIds = caricatureAssets.map((asset) => asset.id);
        for (const assetId of caricatureIds) {
          const response = await fetch(
            `/api/profile/training-assets/${encodeURIComponent(assetId)}`,
            { method: "DELETE", credentials: "same-origin" },
          );
          const payload = await parseJsonOrText<{ message?: string }>(response);
          if (!response.ok) {
            throw new Error(payload.message || "Não foi possível remover as caricaturas.");
          }
        }

        removeTrainingAssetsById(caricatureIds);
        setHeygenVoiceId("");
        setCaricatureError(null);
        setCaricatureInfo(null);

        if (profileIdForPrefs) {
          writeCuradorHeygenPrefs(profileIdForPrefs, {
            heygenVoiceId: "",
            heygenVoiceAudioAssetId: "",
            lastCaricatureAssetId: "",
            avatarTrack: "caricature",
            productionSource: "train_new",
          });
        }

        setCaricatureRefazerInfo(sanitizeProviderFacingMessage(successMessage));
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
        setTwinConsentPending(false);
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
        setTwinRefazerInfo(sanitizeProviderFacingMessage(successMessage));
      }
    } catch (error) {
      if (isCaricatureTrack) {
        showUserError(setCaricatureRefazerError, error);
      } else {
        showUserError(setTwinRefazerError, error);
      }
    } finally {
      setIsDeletingTwinGroup(false);
    }
  }

  const selectedAvatarImage = avatarImageAssets[0] ?? null;
  const selectedVoiceAudio = voiceAudioAssets[0] ?? null;
  const selectedTrainingVideo = latestTrainingVideo;

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
      setTwinConsentPending(false);
      return;
    }
    if (isTwinLookReadyForVideo(linkedTwinLook) && trainingBannerState !== "ready") {
      syncTrainingBannerFromTwinLook(linkedTwinLook);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedTwinLook, isPollingTwinTraining, trainingBannerState, productionSource]);

  useEffect(() => {
    if (!onTwinStatusChange || !hasExistingTwin) {
      return;
    }

    onTwinStatusChange();
  }, [hasExistingTwin, onTwinStatusChange]);

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
    if (!digitalTwinEnabled || autoLoadedLooksRef.current) {
      return;
    }
    autoLoadedLooksRef.current = true;
    void loadPrivateDigitalTwinLooks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digitalTwinEnabled]);

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
  }, [profileIdForPrefs, heygenAvatarId, heygenVoiceId, heygenAvatarGroupId, productionSource]);

  async function handleSaveAndContinue() {
    try {
      await saveProfile({ allowDraftDefaults: true, throwOnError: true });
      router.push("/criativo");
    } catch {
      // erro exibido pelo provider
    }
  }

  async function handleMaterialUpload(
    trainingRole: "voice_audio" | "avatar_image" | "dataset",
    file: File,
  ) {
    setMaterialUploadErrors((current) => ({ ...current, [trainingRole]: null }));

    if (trainingRole === "dataset") {
      const validationError = validateTrainingVideoFile(file);
      if (validationError) {
        setMaterialUploadErrors((current) => ({
          ...current,
          dataset: validationError,
        }));
        return;
      }
    }

    try {
      await uploadTrainingAssets([file], trainingRole, { reportError: "throw" });
    } catch (error) {
      setMaterialUploadErrors((current) => ({
        ...current,
        [trainingRole]:
          error instanceof Error
            ? error.message
            : "Não foi possível enviar o arquivo.",
      }));
    }
  }

  return (
    <section className="persona-page agent-theme-curador">
      <div className="persona-container">
        <div className="persona-card">
          <h2 className="sr-only">Curador</h2>

          <div className="persona-section-header">
            <div className="persona-header-icon" aria-hidden="true">
              <PersonaHeaderIcon />
            </div>
            <h2>{scope === "avatar" ? "Avatar e voz" : "Calibragem de Persona"}</h2>
          </div>

          <div className="persona-form-group">
            <label className="persona-label">Materiais base</label>
            <p className="persona-helper-text">
              Comece pelo áudio — ele alimenta os avatares por foto. Depois envie a foto de rosto
              {digitalTwinEnabled ? " ou vídeo conforme o que for gerar" : ""}.
            </p>
            <BaseMaterialsReadiness
              hasVoice={Boolean(selectedVoiceAudio)}
              hasPhoto={Boolean(selectedAvatarImage)}
              hasVideo={Boolean(selectedTrainingVideo)}
              illustratedReadyCount={illustratedReadyCount}
            />
          </div>

          <div className="persona-form-group persona-materials-upload-grid">
            <div className="persona-material-field persona-upload-field-span-full">
              <label className="persona-label" htmlFor={`${uploadInputId}-voice-audio`}>
                Áudio de voz{" "}
                <span className="persona-badge persona-badge--required">Obrigatório</span>
              </label>
              <MaterialUploadField
                id={`${uploadInputId}-voice-audio`}
                variant="featured"
                icon="audio"
                hint="~30 segundos naturais · MP3, WAV ou M4A"
                actionLabel="Enviar áudio"
                accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,.mp3,.wav,.m4a"
                isUploading={isUploadingVoiceAudioAsset}
                asset={selectedVoiceAudio}
                formatBytes={formatBytes}
                error={materialUploadErrors.voice_audio}
                onFile={(file) => void handleMaterialUpload("voice_audio", file)}
              />
            </div>

            <div className="persona-material-field">
              <label className="persona-label" htmlFor={`${uploadInputId}-avatar-image`}>
                Foto do rosto{" "}
                <span className="persona-badge persona-badge--caricature">Avatares por foto</span>
              </label>
              <MaterialUploadField
                id={`${uploadInputId}-avatar-image`}
                variant="standard"
                icon="photo"
                hint="Rosto de frente, bem iluminado · usada na foto real e nas versões ilustradas"
                actionLabel="Enviar foto"
                accept="image/png,image/jpeg,image/webp"
                isUploading={isUploadingAvatarImageAsset}
                asset={selectedAvatarImage}
                formatBytes={formatBytes}
                error={materialUploadErrors.avatar_image}
                onFile={(file) => void handleMaterialUpload("avatar_image", file)}
              />
            </div>

            {digitalTwinEnabled ? (
            <div className="persona-material-field">
              <label className="persona-label" htmlFor={`${uploadInputId}-training-video`}>
                Vídeo de treino{" "}
                <span className="persona-badge persona-badge--twin">Gêmeo digital</span>
              </label>
              <MaterialUploadField
                id={`${uploadInputId}-training-video`}
                variant="standard"
                icon="video"
                hint="30–60s de fala · MP4, MOV ou WebM · até 50 MB"
                actionLabel="Enviar vídeo"
                accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
                isUploading={isUploadingTrainingVideoAsset}
                asset={selectedTrainingVideo}
                formatBytes={formatBytes}
                error={materialUploadErrors.dataset}
                onFile={(file) => void handleMaterialUpload("dataset", file)}
              />
            </div>
            ) : null}
          </div>

          {looksError ? (
            <p className="persona-helper-text persona-helper-highlight">{looksError}</p>
          ) : null}

          {renderPrepareAvatarsSection()}

          {scope === "full" ? (
            <>
              <hr className="persona-divider" />

              <div className="persona-form-group">
                <label className="persona-label">
                  Posicionamento ideológico <span className="persona-badge">Obrigatório</span>
                </label>
                <p className="persona-helper-text">
                  Arraste na linha para calibrar entre esquerda e direita. O centro representa
                  posicionamento moderado.
                </p>
                <IdeologicalSpectrumSlider
                  value={profileForm.spectrum}
                  onChange={(spectrum) =>
                    setProfileForm((current) => ({
                      ...current,
                      spectrum,
                    }))
                  }
                />
              </div>

              <div className="persona-form-group">
                <label className="persona-label">Glossário de expressões</label>
                <p className="persona-helper-text">
                  Inclua características fundamentais da sua expressão, como por exemplo: né, tipo,
                  entendeu, sabe, tá, ok, certo, mano, assim.
                </p>
                <textarea
                  className="persona-input-control persona-top-gap"
                  value={profileForm.glossaryTerms ?? ""}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,
                      glossaryTerms: event.target.value,
                    }))
                  }
                  placeholder="Digite suas expressões, separadas por vírgula..."
                />
              </div>

              <div className="persona-cta-row persona-top-gap">
                <button
                  type="button"
                  className="persona-btn"
                  onClick={() => void handleSaveAndContinue()}
                  disabled={isSavingProfile}
                >
                  {isSavingProfile ? "Salvando…" : "Salvar"}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}

