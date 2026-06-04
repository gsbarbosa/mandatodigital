"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import {
  archetypeOptions,
  spectrumOptions,
  voiceToneOptions,
} from "@/lib/constants";
import { useProductApp } from "@/components/product/provider";
import { parseTextarea } from "@/components/product/shared";
import {
  formatProviderLimitHint,
  readCuradorHeygenPrefs,
  sanitizeProviderFacingMessage,
  writeCuradorHeygenPrefs,
} from "@/lib/curador-heygen-prefs";
import {
  caricatureVariantLabel,
  pickLatestCaricatureForVariant,
} from "@/lib/caricature-asset-variant";
import {
  formatTwinLookCaption,
  trainingPhaseMessage,
  type HeyGenTrainingPhase,
  type TwinLookDisplayMeta,
} from "@/lib/heygen-twin-display";
import type { CaricatureVariant } from "@/lib/openai-caricature-prompts";
import type { ProfileTrainingAsset } from "@/lib/types";

type PrivateTwinLook = TwinLookDisplayMeta & {
  preview_image_url?: string | null;
  preview_video_url?: string | null;
  supported_api_engines?: string[];
};

type TrainingBannerState =
  | "hidden"
  | "started"
  | "awaiting_consent"
  | "processing"
  | "ready"
  | "failed"
  | "completed";

const MAX_SCRIPT_WORDS = 100;

const AVATAR_TYPE_BY_TRACK = {
  realistic: "Meu Gêmeo Digital",
  caricature: "Minha Caricatura",
} as const;

function countWords(text: string) {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function uploadAreaButtonLabel(hasFile: boolean) {
  return hasFile ? "Substituir" : "Adicionar";
}

function avatarTypeToTrack(value: string | undefined): AvatarTrack {
  return value === "Minha Caricatura" ? "caricature" : "realistic";
}

function formatStatus(status: string | null | undefined) {
  switch (status) {
    case "pending":
      return "Aguardando";
    case "processing":
      return "Gerando";
    case "completed":
      return "Concluído";
    case "failed":
      return "Falhou";
    default:
      return status || "Desconhecido";
  }
}

function selectSingleTagValue(values: string[] | undefined, value: string) {
  const current = values ?? [];
  return current.includes(value) ? [] : [value];
}

function buildCuradorContextPayload(profileForm: {
  spectrum: string;
  glossaryTerms?: string;
  personaArchetypes?: string[];
  voiceTones?: string[];
  avatarType: string;
}) {
  return {
    spectrum: profileForm.spectrum,
    glossaryTerms: parseTextarea(profileForm.glossaryTerms ?? ""),
    personaArchetypes: profileForm.personaArchetypes ?? [],
    voiceTones: profileForm.voiceTones ?? [],
    avatarType: profileForm.avatarType,
  };
}

function PersonaTag({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      className={active ? "persona-tag active" : "persona-tag"}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

type AvatarTrack = "realistic" | "caricature";
type ProductionSource = "use_existing" | "train_new";

function PersonaHeaderIcon() {
  return (
    <svg viewBox="0 0 24 24" className="persona-header-icon-svg" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-3.31 0-6 1.79-6 4v1h12v-1c0-2.21-2.69-4-6-4Zm7.78-3.65-1.41-1.41L16 11.31l1.41 1.41 1.41-1.41 1.41 1.41 1.41-1.41-1.41-1.41 1.41-1.41Z"
      />
    </svg>
  );
}

function PersonaEditorialIcon() {
  return (
    <svg viewBox="0 0 24 24" className="persona-header-icon-svg" aria-hidden="true">
      <path
        fill="currentColor"
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm-1 2 5 5h-5V4ZM8 13h8v2H8v-2Zm0 4h5v2H8v-2Z"
      />
    </svg>
  );
}

function TwinLookMedia({
  look,
  className = "persona-caricature-preview-image",
  compact = false,
}: {
  look: PrivateTwinLook;
  className?: string;
  compact?: boolean;
}) {
  const [mediaFailed, setMediaFailed] = useState(false);
  const caption = formatTwinLookCaption(look);
  const imageUrl = look.preview_image_url?.trim();
  const videoUrl = look.preview_video_url?.trim();

  if (mediaFailed || (!imageUrl && !videoUrl)) {
    return (
      <div
        className={
          compact ? "persona-twin-look-meta compact" : "persona-twin-look-meta"
        }
      >
        <span className="persona-twin-look-meta-title">
          {look.name || "Gêmeo Digital"}
        </span>
        <span className="persona-twin-look-meta-date">{caption}</span>
      </div>
    );
  }

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        className={className}
        onError={() => setMediaFailed(true)}
      />
    );
  }

  return (
    <video
      src={videoUrl}
      className={className}
      muted
      playsInline
      loop
      autoPlay
      onError={() => setMediaFailed(true)}
    />
  );
}

function CaricatureVariantOption({
  asset,
  variant,
  isSelected,
  onSelect,
}: {
  asset: ProfileTrainingAsset;
  variant: CaricatureVariant;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(
      `/api/profile/training-assets/${encodeURIComponent(asset.id)}/preview-url`,
    )
      .then(async (response) => {
        const payload = (await response.json()) as { previewUrl?: string };
        if (!response.ok || cancelled) {
          return;
        }
        setPreviewUrl(payload.previewUrl?.trim() || null);
      })
      .catch(() => {
        // ignore
      });
    return () => {
      cancelled = true;
    };
  }, [asset.id]);

  return (
    <button
      type="button"
      className={
        isSelected
          ? "persona-caricature-variant-card active"
          : "persona-caricature-variant-card"
      }
      onClick={onSelect}
    >
      <div className="persona-caricature-variant-thumb" aria-hidden="true">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt=""
            className="persona-caricature-preview-image"
          />
        ) : (
          <span className="persona-twin-preview-placeholder" />
        )}
      </div>
      <strong>{caricatureVariantLabel(variant)}</strong>
      <span>Usar no treinamento</span>
    </button>
  );
}

function CaricatureHistoryListItem({
  asset,
  isSelected,
  onSelect,
}: {
  asset: ProfileTrainingAsset;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(
      `/api/profile/training-assets/${encodeURIComponent(asset.id)}/preview-url`,
    )
      .then(async (response) => {
        const payload = (await response.json()) as { previewUrl?: string };
        if (!response.ok || cancelled) {
          return;
        }
        setThumbUrl(payload.previewUrl?.trim() || null);
      })
      .catch(() => {
        // ignore
      });
    return () => {
      cancelled = true;
    };
  }, [asset.id]);

  return (
    <li
      className={
        isSelected ? "persona-video-history-item active" : "persona-video-history-item"
      }
    >
      <div className="persona-video-history-thumb" aria-hidden="true">
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt=""
            className="persona-video-history-thumb-media"
          />
        ) : (
          <span className="persona-twin-preview-placeholder" />
        )}
      </div>
      <button type="button" className="persona-video-history-select" onClick={onSelect}>
        <strong>{asset.originalFilename || "Caricatura"}</strong>
        <span>{new Date(asset.createdAt).toLocaleString("pt-BR")}</span>
      </button>
    </li>
  );
}

function UploadedFileChip({
  asset,
  formatBytes,
}: {
  asset: ProfileTrainingAsset;
  formatBytes: (bytes: number) => string;
}) {
  return (
    <span className="persona-file-chip">
      {asset.originalFilename}
      {asset.sizeBytes ? ` (${formatBytes(asset.sizeBytes)})` : ""}
    </span>
  );
}

export function CuradorPageV2() {
  const uploadInputId = useId();
  const [isTraining, setIsTraining] = useState(false);
  const [trainingError, setTrainingError] = useState<string | null>(null);
  const [trainingInfo, setTrainingInfo] = useState<string | null>(null);
  const [heygenAvatarId, setHeygenAvatarId] = useState<string>("");
  const [heygenAvatarGroupId, setHeygenAvatarGroupId] = useState<string>("");
  const [heygenVoiceId, setHeygenVoiceId] = useState<string>("");
  const [heygenConsentUrl, setHeygenConsentUrl] = useState<string>("");
  const [selectedCaricatureAssetId, setSelectedCaricatureAssetId] = useState<string>("");
  const [showRecentAvatars, setShowRecentAvatars] = useState(false);
  const [avatarTrack, setAvatarTrack] = useState<AvatarTrack>("realistic");
  const [productionSource, setProductionSource] = useState<ProductionSource>("train_new");
  const restoredHeygenPrefsRef = useRef(false);
  const [trainingStarted, setTrainingStarted] = useState(false);
  const [trainingBannerState, setTrainingBannerState] =
    useState<TrainingBannerState>("hidden");
  const [isGeneratingCaricature, setIsGeneratingCaricature] = useState(false);
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

  const hasExistingTwin = privateTwinLooks.length > 0;
  const hasTwinOnPlatform =
    hasExistingTwin ||
    Boolean(heygenAvatarGroupId.trim()) ||
    Boolean(heygenConsentUrl.trim());
  const hasExistingCaricature = caricatureAssets.length > 0;
  const showTrainingUploads = productionSource === "train_new";
  const canTrainRealistic = Boolean(latestTrainingVideo && voiceAudioAssets[0]);
  const canStartRealisticTraining = showTrainingUploads && canTrainRealistic;
  const editorialCaricature = useMemo(
    () => pickLatestCaricatureForVariant(visibleTrainingAssets, "editorial"),
    [visibleTrainingAssets],
  );
  const mascotCaricature = useMemo(
    () => pickLatestCaricatureForVariant(visibleTrainingAssets, "mascot_3d"),
    [visibleTrainingAssets],
  );
  const canStartCaricatureTraining =
    showTrainingUploads &&
    Boolean(
      avatarImageAssets[0] &&
        voiceAudioAssets[0] &&
        selectedCaricatureAssetId.trim(),
    );
  const isTrainingBusy = isTraining || isGeneratingCaricature;
  const canGenerateCaricaturePair = Boolean(avatarImageAssets[0]);
  const selectedTwinLook =
    privateTwinLooks.find((look) => look.id === heygenAvatarId) ?? null;
  const twinReadyForVideo =
    avatarTrack !== "realistic" ||
    trainingBannerState === "ready" ||
    (productionSource === "use_existing" &&
      (selectedTwinLook?.groupStatus === "completed" ||
        selectedTwinLook?.consentStatus === "completed"));

  const canGenerateVideo =
    avatarTrack === "realistic"
      ? Boolean(heygenAvatarId) && twinReadyForVideo
      : Boolean(heygenVoiceId && selectedCaricatureAssetId.trim());

  const scriptWordCount = countWords(scriptDraft);
  const canProduceContent =
    canGenerateVideo &&
    (useFreePromptAsTranscript
      ? freePrompt.trim().length > 0
      : scriptApproved && scriptDraft.trim().length > 0);

  const archetypeHelperText =
    "Selecione no máximo um arquétipo e um tom. Se não escolher, a IA utiliza a identidade comunicacional identificada nas mídias enviadas.";

  function selectAvatarTrack(track: AvatarTrack) {
    const hasExisting =
      track === "realistic" ? privateTwinLooks.length > 0 : caricatureAssets.length > 0;
    setAvatarTrack(track);
    setProductionSource(hasExisting ? "use_existing" : "train_new");
    setTrainingStarted(false);
    setTrainingBannerState("hidden");
    setProfileForm((current) => ({
      ...current,
      avatarType: AVATAR_TYPE_BY_TRACK[track],
    }));
  }

  function selectProductionSource(source: ProductionSource) {
    if (source === "use_existing" && avatarTrack === "realistic" && !hasExistingTwin) {
      return;
    }
    if (source === "use_existing" && avatarTrack === "caricature" && !hasExistingCaricature) {
      return;
    }
    setProductionSource(source);
    setTrainingStarted(false);
    setTrainingBannerState("hidden");
    setTrainingError(null);
    if (source === "train_new") {
      setHeygenVoiceId("");
      setTrainingInfo(null);
      setCaricatureInfo(null);
      setCaricatureError(null);
    }
    if (source === "use_existing" && avatarTrack === "realistic" && privateTwinLooks[0]) {
      const newest = privateTwinLooks[0];
      setHeygenAvatarId(newest.id);
      if (newest.group_id) {
        setHeygenAvatarGroupId(String(newest.group_id));
      }
    }
    if (source === "use_existing" && avatarTrack === "caricature" && sortedCaricatureAssets[0]) {
      setSelectedCaricatureAssetId(sortedCaricatureAssets[0].id);
      setCaricaturePreviewUrl(null);
    }
  }

  function showUserError(setter: (value: string | null) => void, error: unknown) {
    const raw = error instanceof Error ? error.message : "Ocorreu um erro inesperado.";
    setter(sanitizeProviderFacingMessage(raw));
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

  function renderProductionAvatarPreview() {
    if (avatarTrack === "realistic" && heygenAvatarId && selectedTwinLook) {
      return (
        <div className="persona-production-avatar-preview persona-top-gap">
          <p className="persona-helper-text">Avatar selecionado para gerar o conteúdo</p>
          <div className="persona-caricature-actions-card">
            <TwinLookMedia look={selectedTwinLook} />
            <p className="persona-helper-text">
              {selectedTwinLook.name || "Gêmeo Digital"}
            </p>
            <p className="persona-helper-text persona-twin-look-caption">
              {formatTwinLookCaption(selectedTwinLook)}
            </p>
          </div>
        </div>
      );
    }

    if (avatarTrack === "caricature" && selectedCaricature && caricaturePreviewUrl) {
      return (
        <div className="persona-production-avatar-preview persona-top-gap">
          <p className="persona-helper-text">Avatar selecionado para gerar o conteúdo</p>
          <div className="persona-caricature-actions-card">
            <img
              src={caricaturePreviewUrl}
              alt="Preview da caricatura em uso"
              className="persona-caricature-preview-image"
            />
            <p className="persona-helper-text">{selectedCaricature.originalFilename}</p>
          </div>
        </div>
      );
    }

    return (
      <p className="persona-helper-text persona-helper-highlight persona-top-gap">
        Selecione ou treine um avatar antes de gerar o conteúdo.
      </p>
    );
  }

  function renderProductionSourceButtons(
    useExistingLabel: string,
    trainNewLabel: string,
    hasExisting: boolean,
  ) {
    if (!hasExisting) {
      return (
        <div className="persona-production-subtrack-wrap persona-top-gap">
          <div
            className="persona-production-subtrack persona-production-subtrack-single"
            role="group"
            aria-label="Modo de produção"
          >
            <button
              type="button"
              className="persona-production-subtrack-btn is-active"
              onClick={() => selectProductionSource("train_new")}
            >
              {trainNewLabel}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="persona-production-subtrack-wrap persona-top-gap">
        <div className="persona-production-subtrack" role="group" aria-label="Modo de produção">
          <button
            type="button"
            className={
              productionSource === "use_existing"
                ? "persona-production-subtrack-btn is-active"
                : "persona-production-subtrack-btn"
            }
            onClick={() => selectProductionSource("use_existing")}
          >
            {useExistingLabel}
          </button>
          <button
            type="button"
            className={
              productionSource === "train_new"
                ? "persona-production-subtrack-btn is-active"
                : "persona-production-subtrack-btn"
            }
            onClick={() => selectProductionSource("train_new")}
          >
            {trainNewLabel}
          </button>
        </div>
      </div>
    );
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

  function renderRealisticTwinPurgeStep() {
    if (avatarTrack !== "realistic") {
      return null;
    }

    const showPurgeFeedback = Boolean(deleteTwinInfo || deleteTwinError);
    if (!hasTwinOnPlatform && !showPurgeFeedback) {
      return null;
    }

    return (
      <div className="persona-form-group persona-twin-purge-step">
        {hasTwinOnPlatform ? (
          <>
            <label className="persona-label">Etapa 1 — Gêmeo digital na plataforma</label>
            <p className="persona-helper-text">
              Remova o gêmeo treinado na plataforma antes de enviar áudio e vídeo. Isso não apaga
              os arquivos que você enviar neste formulário — só o personagem remoto.
            </p>
            <button
              type="button"
              className="persona-twin-delete-link persona-twin-delete-link-prominent"
              onClick={() => void handleDeleteTwinGroup()}
              disabled={isDeletingTwinGroup || isTrainingBusy}
            >
              {isDeletingTwinGroup ? "Removendo gêmeo digital…" : "Remover gêmeo digital"}
            </button>
          </>
        ) : null}
        {deleteTwinError ? (
          <p className="persona-twin-purge-banner is-error" role="status">
            {deleteTwinError}
          </p>
        ) : null}
        {deleteTwinInfo ? (
          <p className="persona-twin-purge-banner is-success" role="status">
            {deleteTwinInfo}
          </p>
        ) : null}
      </div>
    );
  }

  function renderRecentAvatarsPanel() {
    const hasTwins = privateTwinLooks.length > 0;
    const hasCaricatures = sortedCaricatureAssets.length > 0;
    const showTwinsSection = avatarTrack === "realistic" && hasTwins;
    const showCaricaturesSection = avatarTrack === "caricature" && hasCaricatures;

    if (!showTwinsSection && !showCaricaturesSection) {
      return null;
    }

    return (
      <div className="persona-form-group">
        <button
          type="button"
          className="persona-recent-avatars-toggle"
          onClick={() => {
            setShowRecentAvatars((current) => !current);
            if (avatarTrack === "realistic" && !hasTwins) {
              void loadPrivateDigitalTwinLooks();
            }
          }}
        >
          {showRecentAvatars ? "Ocultar avatares recentes" : "Ver avatares recentes"}
        </button>
        {productionSource === "use_existing" &&
        ((avatarTrack === "realistic" && heygenAvatarId) ||
          (avatarTrack === "caricature" && selectedCaricature)) ? (
          <p className="persona-last-training-hint">
            Último treinamento em uso
            {avatarTrack === "realistic" && heygenAvatarId
              ? ` · Gêmeo ${heygenAvatarId.slice(0, 8)}…`
              : ""}
            {avatarTrack === "caricature" && selectedCaricature
              ? ` · Caricatura ${selectedCaricature.originalFilename}`
              : ""}
          </p>
        ) : null}
        {showRecentAvatars ? (
          <div className="persona-recent-avatars-panel">
            {showTwinsSection ? (
              <>
                <p className="persona-helper-text">Gêmeos digitais</p>
                <ul className="persona-video-history-list">
                  {privateTwinLooks.map((look) => {
                    const isSelected =
                      avatarTrack === "realistic" && heygenAvatarId === look.id;
                    return (
                      <li
                        key={look.id}
                        className={
                          isSelected
                            ? "persona-video-history-item active"
                            : "persona-video-history-item"
                        }
                      >
                        <div className="persona-video-history-thumb" aria-hidden="true">
                          <TwinLookMedia
                            look={look}
                            className="persona-video-history-thumb-media"
                            compact
                          />
                        </div>
                        <button
                          type="button"
                          className="persona-video-history-select"
                          onClick={() => {
                            const groupId = String(look.group_id ?? "").trim();
                            setAvatarTrack("realistic");
                            setProductionSource("use_existing");
                            setHeygenAvatarId(look.id);
                            setTrainingBannerState(
                              look.groupStatus === "completed" ? "ready" : "processing",
                            );
                            if (groupId) {
                              setHeygenAvatarGroupId(groupId);
                            }
                            persistHeygenPrefs({
                              avatarTrack: "realistic",
                              productionSource: "use_existing",
                              heygenAvatarId: look.id,
                              heygenAvatarGroupId: groupId || heygenAvatarGroupId,
                            });
                          }}
                        >
                          <strong>{look.name || "Gêmeo Digital"}</strong>
                          <span>{formatTwinLookCaption(look)}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : null}
            {showCaricaturesSection ? (
              <>
                <p
                  className={
                    showTwinsSection
                      ? "persona-helper-text persona-top-gap"
                      : "persona-helper-text"
                  }
                >
                  Caricaturas geradas
                </p>
                <ul className="persona-video-history-list">
                  {sortedCaricatureAssets.map((asset) => {
                    const isSelected =
                      avatarTrack === "caricature" &&
                      selectedCaricature?.id === asset.id;
                    return (
                      <CaricatureHistoryListItem
                        key={asset.id}
                        asset={asset}
                        isSelected={isSelected}
                        onSelect={() => {
                          setAvatarTrack("caricature");
                          setProductionSource("use_existing");
                          setSelectedCaricatureAssetId(asset.id);
                          setCaricaturePreviewUrl(null);
                          persistHeygenPrefs({
                            avatarTrack: "caricature",
                            productionSource: "use_existing",
                            lastCaricatureAssetId: asset.id,
                          });
                        }}
                      />
                    );
                  })}
                </ul>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    );
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
      const response = await fetch(`/api/heygen/videos/${encodeURIComponent(id)}`);
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
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error("O video ainda esta em processamento. Atualize a pagina em alguns minutos.");
  }

  async function handleGenerateScript() {
    setScriptError(null);
    const topic = profileForm.avatarVideoTopic.trim();
    if (!topic) {
      setScriptError("Informe o tema do video antes de gerar o roteiro.");
      return;
    }

    setIsGeneratingScript(true);
    invalidateScriptApproval();

    try {
      await saveProfile({ allowDraftDefaults: true, silent: true });
      const response = await fetch("/api/heygen/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          curadorContext: buildCuradorContextPayload(profileForm),
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
      setScriptError(`O roteiro deve ter no maximo ${MAX_SCRIPT_WORDS} palavras (~45 segundos).`);
      return;
    }
    if (scriptTopicSnapshot !== profileForm.avatarVideoTopic.trim()) {
      setScriptError("O tema mudou. Gere o roteiro novamente antes de aprovar.");
      return;
    }
    setScriptApproved(true);
  }

  async function requestCaricatureVariant(
    variant: CaricatureVariant,
  ): Promise<{ assetId: string; previewUrl: string | null }> {
    const response = await fetch("/api/openai/caricature", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceAssetId: selectedAvatarImage?.id,
        variant,
      }),
    });
    const payload = await parseJsonOrText<{
      asset?: ProfileTrainingAsset;
      previewUrl?: string;
      message?: string;
    }>(response);

    if (!response.ok) {
      throw new Error(payload.message || "Nao foi possivel gerar a caricatura.");
    }

    if (payload.asset) {
      appendTrainingAssets([payload.asset]);
    }

    const assetId = payload.asset?.id?.trim() ?? "";
    if (!assetId) {
      throw new Error("Resposta invalida: caricatura sem identificador.");
    }

    return {
      assetId,
      previewUrl: payload.previewUrl?.trim() || null,
    };
  }

  function selectCaricatureForTraining(assetId: string, previewUrl?: string | null) {
    setSelectedCaricatureAssetId(assetId);
    if (previewUrl) {
      setCaricaturePreviewUrl(previewUrl);
    }
    persistHeygenPrefs({ lastCaricatureAssetId: assetId });
  }

  async function handleGenerateBothCaricatures() {
    if (!canGenerateCaricaturePair || isTrainingBusy) {
      return;
    }

    setCaricatureError(null);
    setCaricatureInfo(null);
    setIsGeneratingCaricature(true);

    try {
      await saveProfile({ allowDraftDefaults: true, silent: true });
      const editorial = await requestCaricatureVariant("editorial");
      const mascot = await requestCaricatureVariant("mascot_3d");
      selectCaricatureForTraining(editorial.assetId, editorial.previewUrl);
      setHeygenVoiceId("");
      setTrainingInfo(null);
      setCaricatureInfo(
        "Duas versões geradas. Escolha qual caricatura enviar ao treinamento do avatar.",
      );
    } catch (error) {
      setCaricatureError(
        error instanceof Error ? error.message : "Erro ao gerar caricaturas.",
      );
      throw error;
    } finally {
      setIsGeneratingCaricature(false);
    }
  }

  async function handleTrainHeyGen(): Promise<string | undefined> {
    setTrainingError(null);
    setIsTraining(true);
    setTrainingStarted(true);

    const isTwinSync =
      avatarTrack === "realistic" && Boolean(heygenAvatarGroupId.trim());

    if (!isTwinSync) {
      setHeygenConsentUrl("");
    }

    try {
      await saveProfile({ allowDraftDefaults: true, silent: true });
      const response = await fetch("/api/heygen/train", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          avatarName: profileForm.fullName || "Mandato Digital Avatar",
          mode: avatarTrack === "realistic" ? "digital_twin" : "caricature",
          action: isTwinSync ? "sync" : "create",
          avatarGroupId: isTwinSync ? heygenAvatarGroupId : undefined,
          avatarLookId: isTwinSync ? heygenAvatarId : undefined,
          voiceId: isTwinSync ? heygenVoiceId || undefined : undefined,
          caricatureAssetId:
            avatarTrack === "caricature" ? selectedCaricatureAssetId : undefined,
        }),
      });
      const payload = await parseJsonOrText<{
        avatarId?: string;
        avatarGroupId?: string | null;
        voiceId?: string;
        consentUrl?: string | null;
        consentStatus?: string | null;
        avatarGroupStatus?: string | null;
        trainingPhase?: HeyGenTrainingPhase;
        message?: string;
      }>(response);

      if (!response.ok) {
        throw new Error(payload.message || "Nao foi possivel treinar o avatar.");
      }

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
      } else if (avatarTrack === "caricature") {
        applyTrainingPhase("ready");
      }

      if (avatarTrack === "realistic") {
        await loadPrivateDigitalTwinLooks({
          preferredAvatarId: nextAvatarId || heygenAvatarId,
          preferredGroupId: nextGroupId || heygenAvatarGroupId,
        });
      }

      persistHeygenPrefs({
        heygenAvatarId: nextAvatarId || heygenAvatarId,
        heygenVoiceId: payload.voiceId?.trim() || heygenVoiceId,
        heygenAvatarGroupId: nextGroupId || heygenAvatarGroupId,
        lastCaricatureAssetId: selectedCaricatureAssetId || sortedCaricatureAssets[0]?.id,
      });

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
    if (!canStartRealisticTraining || isTrainingBusy) {
      return;
    }
    setTrainingBannerState("started");
    setTrainingError(null);
    try {
      await handleTrainHeyGen();
      persistHeygenPrefs({ avatarTrack: "realistic", productionSource: "train_new" });
    } catch {
      setTrainingBannerState("hidden");
    }
  }

  async function handleStartCaricatureTraining() {
    if (!canStartCaricatureTraining || isTrainingBusy) {
      return;
    }
    setTrainingBannerState("started");
    setTrainingError(null);
    setCaricatureError(null);
    try {
      await saveProfile({ allowDraftDefaults: true, silent: true });
      await handleTrainHeyGen();
      persistHeygenPrefs({
        avatarTrack: "caricature",
        productionSource: "train_new",
        lastCaricatureAssetId: selectedCaricatureAssetId,
      });
    } catch {
      setTrainingBannerState("hidden");
    }
  }

  function renderCaricatureVariantPicker() {
    if (avatarTrack !== "caricature" || !showTrainingUploads) {
      return null;
    }
    if (!editorialCaricature && !mascotCaricature) {
      return null;
    }

    return (
      <div className="persona-form-group persona-top-gap">
        <p className="persona-helper-text">
          Escolha a caricatura para o treinamento e para gerar vídeos
        </p>
        <div className="persona-caricature-variant-grid">
          {editorialCaricature ? (
            <CaricatureVariantOption
              asset={editorialCaricature}
              variant="editorial"
              isSelected={selectedCaricatureAssetId === editorialCaricature.id}
              onSelect={() => selectCaricatureForTraining(editorialCaricature.id)}
            />
          ) : null}
          {mascotCaricature ? (
            <CaricatureVariantOption
              asset={mascotCaricature}
              variant="mascot_3d"
              isSelected={selectedCaricatureAssetId === mascotCaricature.id}
              onSelect={() => selectCaricatureForTraining(mascotCaricature.id)}
            />
          ) : null}
        </div>
      </div>
    );
  }

  function renderTrainingStartControl(
    canStart: boolean,
    onStart: () => Promise<void>,
    options?: { twinSyncMode?: boolean },
  ) {
    if (!showTrainingUploads) {
      return null;
    }

    const trainButtonLabel = options?.twinSyncMode
      ? "Atualizar status do treino"
      : "Iniciar treinamento";

    return (
      <div className="persona-cta-block persona-top-gap">
        <div className="persona-cta-row">
          <button
            type="button"
            className="persona-btn persona-btn-large"
            onClick={() => void onStart()}
            disabled={!canStart || isTrainingBusy || isDeletingTwinGroup}
          >
            {isTrainingBusy ? (
              <span className="persona-loading-row">
                <span className="persona-spinner" aria-hidden="true" />
                {options?.twinSyncMode ? "Atualizando..." : "Treinando..."}
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
          {trainingBannerState === "awaiting_consent" ? (
            <p className="persona-script-approved persona-training-phase-hint">
              {trainingPhaseMessage("awaiting_consent")}
            </p>
          ) : null}
          {trainingBannerState === "processing" ? (
            <p className="persona-script-approved persona-training-phase-hint">
              {trainingPhaseMessage("processing")}
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

  async function loadPrivateDigitalTwinLooks(options?: {
    preferredAvatarId?: string;
    preferredGroupId?: string;
  }) {
    setLooksError(null);
    setIsLoadingLooks(true);
    try {
      const [looksResponse, groupsResponse] = await Promise.all([
        fetch("/api/heygen/avatars/looks?ownership=private&avatarType=digital_twin"),
        fetch("/api/heygen/avatars/groups?ownership=private"),
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

      const enriched = [...(looksPayload.looks ?? [])]
        .map((look) => {
          const group = groupsById.get(String(look.group_id ?? "").trim());
          return {
            ...look,
            groupCreatedAt: group?.created_at ?? null,
            groupStatus: group?.status ?? null,
            consentStatus: group?.consent_status ?? null,
          } satisfies PrivateTwinLook;
        })
        .sort(
          (a, b) => (b.groupCreatedAt ?? 0) - (a.groupCreatedAt ?? 0),
        );

      setPrivateTwinLooks(enriched);

      if (enriched.length === 0) {
        if (productionSource === "use_existing") {
          setProductionSource("train_new");
        }
      } else if (profileIdForPrefs) {
        const prefs = readCuradorHeygenPrefs(profileIdForPrefs);
        const preferredFromPrefs = prefs.heygenAvatarId?.trim() ?? "";
        if (
          prefs.productionSource === "use_existing" &&
          preferredFromPrefs &&
          enriched.some((look) => look.id === preferredFromPrefs)
        ) {
          setProductionSource("use_existing");
        }
      }

      const preferredAvatarId =
        options?.preferredAvatarId?.trim() ||
        heygenAvatarId.trim() ||
        "";
      const preferredGroupId =
        options?.preferredGroupId?.trim() ||
        heygenAvatarGroupId.trim() ||
        "";

      let resolved =
        enriched.find((look) => look.id === preferredAvatarId) ?? null;

      if (!resolved && preferredGroupId) {
        resolved =
          enriched.find((look) => look.group_id === preferredGroupId) ?? null;
      }

      if (!resolved && productionSource === "use_existing") {
        resolved = enriched[0] ?? null;
      }

      if (resolved) {
        setHeygenAvatarId(resolved.id);
        if (resolved.group_id) {
          setHeygenAvatarGroupId(String(resolved.group_id));
        }
        persistHeygenPrefs({
          heygenAvatarId: resolved.id,
          heygenAvatarGroupId: String(resolved.group_id ?? ""),
        });
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

  async function handleDeleteTwinGroup() {
    if (isDeletingTwinGroup) {
      return;
    }

    setDeleteTwinError(null);
    setDeleteTwinInfo(null);

    const confirmed = window.confirm(
      "Remover todos os Gêmeos Digitais da plataforma?\n\n" +
        "Isso apaga todos os personagens privados da conta (incluindo testes antigos). " +
        "Depois envie novo vídeo e refaça o consentimento.\n\n" +
        "Esta ação não pode ser desfeita.",
    );
    if (!confirmed) {
      return;
    }

    setIsDeletingTwinGroup(true);
    try {
      const response = await fetch("/api/heygen/avatars/groups/purge", {
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
        throw new Error(payload.message || "Nao foi possivel remover os personagens.");
      }

      setHeygenAvatarId("");
      setHeygenAvatarGroupId("");
      setHeygenVoiceId("");
      setHeygenConsentUrl("");
      setPrivateTwinLooks([]);
      setTrainingStarted(false);
      setTrainingBannerState("hidden");
      setProductionSource("train_new");
      setTrainingError(null);
      setTrainingInfo(null);

      if (profileIdForPrefs) {
        writeCuradorHeygenPrefs(profileIdForPrefs, {
          heygenAvatarId: "",
          heygenVoiceId: "",
          heygenAvatarGroupId: "",
          avatarTrack: "realistic",
          productionSource: "train_new",
        });
      }

      const deletedCount = payload.deleted?.length ?? 0;
      const purgeErrors = payload.errors?.length ?? 0;
      let successMessage =
        payload.message?.trim() ||
        (deletedCount > 0
          ? `${deletedCount} gêmeo(s) digital(is) removido(s) na plataforma.`
          : "Nenhum gêmeo digital encontrado na conta — você já pode enviar áudio e vídeo.");

      if (purgeErrors > 0 && deletedCount === 0) {
        throw new Error(
          "Não foi possível remover todos os gêmeos na plataforma. Tente novamente em instantes.",
        );
      }

      if (deletedCount > 0) {
        successMessage += " Envie áudio e vídeo abaixo e inicie o treinamento.";
      }

      setDeleteTwinInfo(sanitizeProviderFacingMessage(successMessage));
      await loadPrivateDigitalTwinLooks();
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

    try {
      const topic = profileForm.avatarVideoTopic.trim();
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
        if (productionSource === "use_existing" && hasExistingCaricature) {
          resolvedVoiceId = (await handleTrainHeyGen()) ?? "";
        }
        if (!resolvedVoiceId) {
          throw new Error(
            "Prepare a voz da caricatura com Iniciar Treinamento antes de gerar o vídeo.",
          );
        }
      }

      await saveProfile({ allowDraftDefaults: true, silent: true });

      const response = await fetch("/api/heygen/videos", {
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
            ? `Curador - prompt livre - ${profileForm.fullName || "Politico"}`
            : `Curador - ${profileForm.fullName || "Politico"} - ${topic || scriptTopicSnapshot}`,
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

      setVideoId(id);
      setVideoStatus("pending");
      await pollVideo(id);
    } catch (error) {
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
    if (prefs.productionSource === "train_new") {
      setProductionSource("train_new");
    }
    // use_existing só é restaurado após validar looks em loadPrivateDigitalTwinLooks
  }, [profileIdForPrefs]);

  useEffect(() => {
    if (avatarTrack === "realistic" && !isLoadingLooks && !hasExistingTwin) {
      if (productionSource === "use_existing") {
        setProductionSource("train_new");
      }
    }
    if (avatarTrack === "caricature" && !hasExistingCaricature) {
      if (productionSource === "use_existing") {
        setProductionSource("train_new");
      }
    }
  }, [
    avatarTrack,
    isLoadingLooks,
    hasExistingTwin,
    hasExistingCaricature,
    productionSource,
  ]);

  useEffect(() => {
    if (!sortedCaricatureAssets.length) {
      return;
    }
    const stillValid = sortedCaricatureAssets.some(
      (asset) => asset.id === selectedCaricatureAssetId,
    );
    if (!stillValid) {
      setSelectedCaricatureAssetId(sortedCaricatureAssets[0].id);
    }
  }, [sortedCaricatureAssets, selectedCaricatureAssetId]);

  useEffect(() => {
    if (avatarTrack !== "realistic" || privateTwinLooks.length === 0) {
      return;
    }
    if (productionSource === "use_existing") {
      setHeygenAvatarId((current) => current || privateTwinLooks[0].id);
    }
  }, [avatarTrack, privateTwinLooks, productionSource]);

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
    const topic = profileForm.avatarVideoTopic.trim();
    if (scriptTopicSnapshot && topic !== scriptTopicSnapshot) {
      invalidateScriptApproval();
    }
  }, [profileForm.avatarVideoTopic, scriptTopicSnapshot]);

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

  return (
    <section className="persona-page">
      <div className="persona-container">
        <div className="persona-card">
          <h2 className="sr-only">Curador</h2>

          <div className="persona-section-header">
            <div className="persona-header-icon" aria-hidden="true">
              <PersonaHeaderIcon />
            </div>
            <h2>Calibragem de Persona</h2>
          </div>

          <div className="persona-form-group">
            <label className="persona-label">Tipo de produção</label>
            <p className="persona-helper-text persona-top-gap">
              Escolha entre realismo máximo (seu gêmeo digital) ou avatar caricato (sua
              caricatura). Ambas digitalizadas e prontas para gravações em vídeo.
            </p>
            <div className="persona-production-track persona-top-gap">
              <button
                type="button"
                className={
                  avatarTrack === "realistic"
                    ? "persona-production-track-btn is-active"
                    : "persona-production-track-btn"
                }
                onClick={() => selectAvatarTrack("realistic")}
              >
                Gêmeo Digital
              </button>
              <button
                type="button"
                className={
                  avatarTrack === "caricature"
                    ? "persona-production-track-btn is-active"
                    : "persona-production-track-btn"
                }
                onClick={() => selectAvatarTrack("caricature")}
              >
                Avatar Caricato
              </button>
            </div>
            <div className="persona-production-track-hints">
              <p>
                Para <strong>Gêmeo Digital</strong> envie: <strong>vídeo</strong> e{" "}
                <strong>áudio</strong>
              </p>
              <p>
                Para <strong>Avatar Caricato</strong> envie: <strong>foto</strong> e{" "}
                <strong>áudio</strong>
              </p>
            </div>
          </div>

          {avatarTrack === "realistic"
            ? renderProductionSourceButtons(
                "Utilizar Gêmeo Digital Atual",
                "Treinar Novo Gêmeo Digital",
                hasExistingTwin,
              )
            : renderProductionSourceButtons(
                "Utilizar Caricatura Atual",
                "Treinar Nova Caricatura",
                hasExistingCaricature,
              )}

          {renderRecentAvatarsPanel()}

          {renderRealisticTwinPurgeStep()}

          {showTrainingUploads ? (
          <div className="persona-form-group">
            <label className="persona-label">
              Upload de VOZ <span className="persona-badge">Obrigatório</span>
            </label>
            <label
              htmlFor={`${uploadInputId}-voice-audio`}
              className={`upload-area persona-upload-area ${isUploadingVoiceAudioAsset ? "persona-upload-area-loading" : ""}`}
            >
              <div className="persona-upload-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" className="persona-upload-svg">
                  <path
                    fill="currentColor"
                    d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"
                  />
                </svg>
              </div>
              <h4 className="persona-upload-block-title">Base de treino — avatares</h4>
              <p>
                Grave um áudio de aproximadamente 30 segundos falando de forma natural (MP3, WAV
                ou M4A).
              </p>
              <input
                id={`${uploadInputId}-voice-audio`}
                type="file"
                accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,.mp3,.wav,.m4a"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  void uploadTrainingAssets([file], "voice_audio");
                  event.target.value = "";
                }}
              />
              <span className="persona-btn persona-btn-upload-label">
                {isUploadingVoiceAudioAsset ? (
                  <span className="persona-loading-row">
                    <span className="persona-spinner" aria-hidden="true" />
                    Enviando...
                  </span>
                ) : (
                  uploadAreaButtonLabel(Boolean(selectedVoiceAudio))
                )}
              </span>
              {isUploadingVoiceAudioAsset && <div className="persona-progress" />}
            </label>
            {selectedVoiceAudio ? (
              <div className="persona-upload-files">
                <UploadedFileChip asset={selectedVoiceAudio} formatBytes={formatBytes} />
              </div>
            ) : null}
          </div>
          ) : null}

          {showTrainingUploads && avatarTrack === "realistic" ? (
            <div className="persona-form-group">
              <label className="persona-label">
                Upload de VÍDEO <span className="persona-badge">Obrigatório</span>
              </label>
              <label
                htmlFor={`${uploadInputId}-training-video`}
                className={`upload-area persona-upload-area ${isUploadingTrainingVideoAsset ? "persona-upload-area-loading" : ""}`}
              >
                <div className="persona-upload-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" className="persona-upload-svg">
                    <path
                      fill="currentColor"
                      d="M17 10.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4.5l4 4v-13l-4 4Z"
                    />
                  </svg>
                </div>
                <h4 className="persona-upload-block-title">Base de treino — avatar gêmeo digital</h4>
                <p>
                  Vídeo em boa luz, rosto visível e áudio ok (MP4) com o candidato falando de frente
                  para a câmera de forma natural sobre um tema qualquer. A IA mapeará sua cadência,
                  pausas, voz, estilo visual e comunicacional.
                </p>
                <input
                  id={`${uploadInputId}-training-video`}
                  type="file"
                  accept="video/*"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    void uploadTrainingAssets([file], "dataset");
                    event.target.value = "";
                  }}
                />
                <span className="persona-btn persona-btn-upload-label">
                  {isUploadingTrainingVideoAsset ? (
                    <span className="persona-loading-row">
                      <span className="persona-spinner" aria-hidden="true" />
                      Enviando...
                    </span>
                  ) : (
                    uploadAreaButtonLabel(Boolean(selectedTrainingVideo))
                  )}
                </span>
                {isUploadingTrainingVideoAsset && <div className="persona-progress" />}
              </label>
              {selectedTrainingVideo ? (
                <div className="persona-upload-files">
                  <UploadedFileChip asset={selectedTrainingVideo} formatBytes={formatBytes} />
                </div>
              ) : null}
            </div>
          ) : null}

          {showTrainingUploads && avatarTrack === "caricature" ? (
            <div className="persona-form-group">
              <label className="persona-label">
                Upload de FOTO <span className="persona-badge">Obrigatório</span>
              </label>
              <label
                htmlFor={`${uploadInputId}-avatar-image`}
                className={`upload-area persona-upload-area ${isUploadingAvatarImageAsset ? "persona-upload-area-loading" : ""}`}
              >
                <div className="persona-upload-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" className="persona-upload-svg">
                    <path
                      fill="currentColor"
                      d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2ZM8.5 13.5 11 16.5l3.5-4.5L19 18H5l3.5-4.5Z"
                    />
                  </svg>
                </div>
                <h4 className="persona-upload-block-title">Base de treino — avatar caricato</h4>
                <p>Foto do rosto (PNG, JPEG ou WebP) bem iluminada e de frente.</p>
                <input
                  id={`${uploadInputId}-avatar-image`}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    void uploadTrainingAssets([file], "avatar_image");
                    event.target.value = "";
                  }}
                />
                <span className="persona-btn persona-btn-upload-label">
                  {isUploadingAvatarImageAsset ? (
                    <span className="persona-loading-row">
                      <span className="persona-spinner" aria-hidden="true" />
                      Enviando...
                    </span>
                  ) : (
                    uploadAreaButtonLabel(Boolean(selectedAvatarImage))
                  )}
                </span>
                {isUploadingAvatarImageAsset && <div className="persona-progress" />}
              </label>
              {selectedAvatarImage ? (
                <div className="persona-upload-files">
                  <UploadedFileChip asset={selectedAvatarImage} formatBytes={formatBytes} />
                </div>
              ) : null}
            </div>
          ) : null}

          {avatarTrack === "caricature" && showTrainingUploads ? (
            <>
              <div className="persona-cta-block persona-top-gap">
                <div className="persona-cta-row">
                  <button
                    type="button"
                    className="persona-btn persona-btn-secondary"
                    onClick={() => void handleGenerateBothCaricatures()}
                    disabled={!canGenerateCaricaturePair || isTrainingBusy}
                  >
                    {isGeneratingCaricature ? (
                      <span className="persona-loading-row">
                        <span className="persona-spinner" aria-hidden="true" />
                        Gerando caricaturas…
                      </span>
                    ) : (
                      "Gerar caricaturas (2 versões)"
                    )}
                  </button>
                </div>
                <p className="persona-helper-text">
                  Versão 1: editorial política (fluxo atual). Versão 2: mascote 3D
                  estilo animação. Depois escolha qual usar no treinamento.
                </p>
              </div>
              {renderCaricatureVariantPicker()}
              {renderTrainingStartControl(
                canStartCaricatureTraining,
                handleStartCaricatureTraining,
              )}
            </>
          ) : null}

          {avatarTrack === "realistic" && productionSource === "use_existing" && selectedTwinLook ? (
            <div className="persona-caricature-actions-card persona-top-gap">
              <TwinLookMedia look={selectedTwinLook} />
              <p className="persona-helper-text persona-twin-look-caption">
                {formatTwinLookCaption(selectedTwinLook)}
              </p>
            </div>
          ) : null}

          {avatarTrack === "caricature" &&
          productionSource === "use_existing" &&
          caricaturePreviewUrl ? (
            <div className="persona-caricature-actions-card persona-top-gap">
              <img
                src={caricaturePreviewUrl}
                alt="Preview da caricatura"
                className="persona-caricature-preview-image"
              />
            </div>
          ) : null}

          <div className="persona-cta-block">
            {looksError && (
              <p className="persona-helper-text persona-helper-highlight">{looksError}</p>
            )}
            {caricatureError && (
              <p className="persona-helper-text persona-helper-highlight">{caricatureError}</p>
            )}
            {trainingError && (
              <>
                <p className="persona-helper-text persona-helper-highlight">{trainingError}</p>
                {formatProviderLimitHint(trainingError) ? (
                  <p className="persona-helper-text">{formatProviderLimitHint(trainingError)}</p>
                ) : null}
              </>
            )}
            {avatarTrack === "realistic" && heygenConsentUrl && (
              <p className="persona-helper-text persona-helper-highlight">
                Consentimento (obrigatório para Digital Twin):{" "}
                <a href={heygenConsentUrl} target="_blank" rel="noreferrer">
                  abrir página de consentimento
                </a>
              </p>
            )}
            {trainingInfo &&
            trainingInfo !== "Treinamento iniciado." &&
            !showTrainingUploads ? (
              <p className="persona-helper-text">{trainingInfo}</p>
            ) : null}
          </div>

          {avatarTrack === "realistic" && showTrainingUploads
            ? renderTrainingStartControl(
                canStartRealisticTraining,
                handleStartRealisticTraining,
                { twinSyncMode: Boolean(heygenAvatarGroupId.trim()) },
              )
            : null}

          <hr className="persona-divider" />

          <div className="persona-section-header">
            <div className="persona-header-icon" aria-hidden="true">
              <PersonaEditorialIcon />
            </div>
            <h2>Calibragem Editorial</h2>
          </div>

          <div className="persona-form-group">
            <label className="persona-label">
              Posicionamento ideológico <span className="persona-badge">Obrigatório</span>
            </label>
            <p className="persona-helper-text">
              O posicionamento ideológico compõe a base da resposta que a IA vai gerar sobre o
              tema.
            </p>
            <div className="persona-tag-list persona-top-gap">
              {spectrumOptions.map((option) => (
                <PersonaTag
                  key={option}
                  active={profileForm.spectrum === option}
                  onClick={() =>
                    setProfileForm((current) => ({
                      ...current,
                      spectrum: option,
                    }))
                  }
                >
                  {option}
                </PersonaTag>
              ))}
            </div>
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

          <div className="persona-form-group">
            <label className="persona-label">Arquétipos de Persona Política</label>
            <p className="persona-helper-text">{archetypeHelperText}</p>
            <div className="persona-tag-list persona-top-gap">
              {archetypeOptions.map((option) => (
                <PersonaTag
                  key={option}
                  active={(profileForm.personaArchetypes ?? []).includes(option)}
                  onClick={() =>
                    setProfileForm((current) => {
                      const personaArchetypes = selectSingleTagValue(
                        current.personaArchetypes,
                        option,
                      );
                      return {
                        ...current,
                        personaArchetypes,
                        archetype: personaArchetypes[0] ?? "",
                      };
                    })
                  }
                >
                  {option}
                </PersonaTag>
              ))}
            </div>
          </div>

          <div className="persona-form-group">
            <label className="persona-label">Tom de linguagem</label>
            <p className="persona-helper-text">{archetypeHelperText}</p>
            <div className="persona-tag-list persona-top-gap">
              {voiceToneOptions.map((tone) => (
                <PersonaTag
                  key={tone}
                  active={(profileForm.voiceTones ?? []).includes(tone)}
                  onClick={() =>
                    setProfileForm((current) => ({
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

          <div className="persona-form-group">
            <label className="persona-label">
              Seu e-mail <span className="persona-badge">Obrigatório</span>
            </label>
            <p className="persona-helper-text">
              Receba avisos sobre o processo de treinamento dos avatares e producao dos videos.
            </p>
            <input
              type="email"
              className="persona-input-control persona-top-gap"
              value={profileForm.notificationEmail ?? ""}
              onChange={(event) =>
                setProfileForm((current) => ({
                  ...current,
                  notificationEmail: event.target.value,
                }))
              }
              placeholder="Digite seu e-mail para receber avisos..."
              autoComplete="email"
            />
          </div>

          <div className="persona-form-group">
            <label className="persona-label">Tema do vídeo</label>
            <textarea
              className="persona-input-control"
              value={profileForm.avatarVideoTopic}
              onChange={(event) => {
                invalidateScriptApproval();
                setProfileForm((current) => ({
                  ...current,
                  avatarVideoTopic: event.target.value,
                }));
              }}
              rows={3}
            />
            {!useFreePromptAsTranscript && (
              <div className="persona-cta-row persona-top-gap">
                <button
                  type="button"
                  className="persona-btn persona-btn-secondary"
                  onClick={() => void handleGenerateScript()}
                  disabled={isGeneratingScript || !profileForm.avatarVideoTopic.trim()}
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
            )}
          </div>

          {!useFreePromptAsTranscript && (
            <div className="persona-form-group">
              <label className="persona-label">Aprovação do roteiro</label>
              <p className="persona-helper-text">
                Veja o roteiro do vídeo que será produzido. Altere-o conforme necessário. Máximo de{" "}
                {MAX_SCRIPT_WORDS} palavras (ou ~45 segundos).
              </p>
              <textarea
                className="persona-input-control persona-top-gap"
                value={scriptDraft}
                onChange={(event) => {
                  invalidateScriptApproval();
                  setScriptDraft(event.target.value);
                }}
                rows={6}
                placeholder="Clique em Gerar roteiro apos preencher o tema..."
              />
              <p
                className={
                  scriptWordCount > MAX_SCRIPT_WORDS
                    ? "persona-script-meta is-warning"
                    : "persona-script-meta"
                }
              >
                {scriptWordCount}/{MAX_SCRIPT_WORDS} palavras
              </p>
              {scriptError && (
                <p className="persona-helper-text persona-helper-highlight">{scriptError}</p>
              )}
              <div className="persona-cta-row persona-top-gap">
                <button
                  type="button"
                  className="persona-btn"
                  onClick={handleApproveScript}
                  disabled={!scriptDraft.trim() || scriptWordCount > MAX_SCRIPT_WORDS}
                >
                  Aprovar Roteiro
                </button>
              </div>
              {scriptApproved && (
                <p className="persona-script-approved">
                  Roteiro aprovado. Você já pode produzir o conteúdo.
                </p>
              )}
            </div>
          )}

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

          {renderProductionAvatarPreview()}

          {avatarTrack === "realistic" && heygenAvatarId && !twinReadyForVideo ? (
            <p className="persona-helper-text persona-helper-highlight persona-top-gap">
              Finalize o consentimento e clique em &quot;Atualizar status do treino&quot; antes de
              gerar o vídeo. O avatar ainda não está pronto na plataforma.
            </p>
          ) : null}

          <div className="persona-generate-row">
            <button
              type="button"
              className="persona-btn persona-btn-large"
              onClick={() => void handleGenerate()}
              disabled={
                isGenerating ||
                !canProduceContent ||
                (avatarTrack === "caricature" && !heygenVoiceId && isTraining)
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
            {isGenerating && <div className="persona-progress" />}
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
        </div>
      </div>
    </section>
  );
}

