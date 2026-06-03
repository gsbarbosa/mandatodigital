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
  isHeyGenDailyLimitMessage,
  readCuradorHeygenPrefs,
  writeCuradorHeygenPrefs,
} from "@/lib/curador-heygen-prefs";
import type { ProfileTrainingAsset } from "@/lib/types";

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
      return "Gerando (HeyGen)";
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
  const [trainingBannerState, setTrainingBannerState] = useState<
    "hidden" | "started" | "completed"
  >("hidden");
  const [consentInfo, setConsentInfo] = useState<string | null>(null);
  const [isGeneratingCaricature, setIsGeneratingCaricature] = useState(false);
  const [caricatureError, setCaricatureError] = useState<string | null>(null);
  const [caricatureInfo, setCaricatureInfo] = useState<string | null>(null);
  const [caricaturePreviewUrl, setCaricaturePreviewUrl] = useState<string | null>(null);
  const [isLoadingLooks, setIsLoadingLooks] = useState(false);
  const [looksError, setLooksError] = useState<string | null>(null);
  const autoLoadedLooksRef = useRef(false);
  const [privateTwinLooks, setPrivateTwinLooks] = useState<
    Array<{
      id: string;
      name?: string | null;
      preview_image_url?: string | null;
      preview_video_url?: string | null;
      supported_api_engines?: string[];
    }>
  >([]);

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

  const formatBytes = useCallback((bytes: number) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return "";
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(1)} MB`;
  }, []);

  const hasExistingTwin = privateTwinLooks.length > 0;
  const hasExistingCaricature = caricatureAssets.length > 0;
  const showTrainingUploads = productionSource === "train_new";
  const canTrainRealistic = Boolean(trainingVideoAssets[0] && voiceAudioAssets[0]);
  const canStartRealisticTraining = showTrainingUploads && canTrainRealistic;
  const canStartCaricatureTraining =
    showTrainingUploads && Boolean(avatarImageAssets[0] && voiceAudioAssets[0]);
  const isTrainingBusy = isTraining || isGeneratingCaricature;
  const canGenerateCaricature = Boolean(avatarImageAssets[0]);
  const canGenerateVideo =
    avatarTrack === "realistic"
      ? Boolean(heygenAvatarId)
      : Boolean(heygenVoiceId && caricatureAssets[0]);

  const scriptWordCount = countWords(scriptDraft);
  const canProduceContent =
    canGenerateVideo &&
    (useFreePromptAsTranscript
      ? freePrompt.trim().length > 0
      : scriptApproved && scriptDraft.trim().length > 0);

  const archetypeHelperText =
    "Selecione no máximo um arquétipo e um tom. Se não escolher, a IA utiliza a identidade comunicacional identificada nas mídias enviadas.";

  const selectedTwinLook =
    privateTwinLooks.find((look) => look.id === heygenAvatarId) ?? null;

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
      setHeygenAvatarId(privateTwinLooks[0].id);
    }
  }

  function renderProductionSourceButtons(
    useExistingLabel: string,
    trainNewLabel: string,
    hasExisting: boolean,
  ) {
    const useExistingDisabled = !hasExisting;

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
            disabled={useExistingDisabled}
            aria-disabled={useExistingDisabled}
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
                <p className="persona-helper-text">Gêmeos digitais (HeyGen)</p>
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
                        <button
                          type="button"
                          className="persona-video-history-select"
                          onClick={() => {
                            setAvatarTrack("realistic");
                            setProductionSource("use_existing");
                            setHeygenAvatarId(look.id);
                            persistHeygenPrefs({
                              avatarTrack: "realistic",
                              productionSource: "use_existing",
                              heygenAvatarId: look.id,
                            });
                          }}
                        >
                          <strong>{look.name || "Gêmeo Digital"}</strong>
                          <span>{look.id}</span>
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
                      <li
                        key={asset.id}
                        className={
                          isSelected
                            ? "persona-video-history-item active"
                            : "persona-video-history-item"
                        }
                      >
                        <button
                          type="button"
                          className="persona-video-history-select"
                          onClick={() => {
                            setAvatarTrack("caricature");
                            setProductionSource("use_existing");
                            setSelectedCaricatureAssetId(asset.id);
                            persistHeygenPrefs({
                              avatarTrack: "caricature",
                              productionSource: "use_existing",
                              lastCaricatureAssetId: asset.id,
                            });
                          }}
                        >
                          <strong>{asset.originalFilename || "Caricatura"}</strong>
                          <span>
                            {new Date(asset.createdAt).toLocaleString("pt-BR")}
                          </span>
                        </button>
                      </li>
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
        throw new Error(payload.errorMessage || "A geracao do video falhou na HeyGen.");
      }

      if (payload.status === "completed" && payload.videoUrl?.trim()) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error("A HeyGen ainda esta processando. Atualize a pagina em alguns minutos.");
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

  async function handleGenerateCaricature(): Promise<string | undefined> {
    setCaricatureError(null);
    setCaricatureInfo(null);
    setIsGeneratingCaricature(true);

    try {
      void saveProfile({ allowDraftDefaults: true, silent: true });
      const response = await fetch("/api/openai/caricature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceAssetId: selectedAvatarImage?.id,
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
        setSelectedCaricatureAssetId(payload.asset.id);
      }
      setCaricaturePreviewUrl(payload.previewUrl?.trim() || null);
      setCaricatureInfo(payload.message || "Caricatura gerada.");
      setHeygenVoiceId("");
      setTrainingInfo(null);
      return payload.asset?.id;
    } catch (error) {
      setCaricatureError(
        error instanceof Error ? error.message : "Erro ao gerar caricatura.",
      );
      throw error;
    } finally {
      setIsGeneratingCaricature(false);
    }
  }

  async function handleTrainHeyGen(): Promise<string | undefined> {
    setTrainingError(null);
    setConsentInfo(null);
    setHeygenConsentUrl("");
    setIsTraining(true);
    setTrainingStarted(true);

    try {
      await saveProfile({ allowDraftDefaults: true, silent: true });
      const response = await fetch("/api/heygen/train", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          avatarName: profileForm.fullName || "Mandato Digital Avatar",
          mode: avatarTrack === "realistic" ? "digital_twin" : "caricature",
        }),
      });
      const payload = await parseJsonOrText<{
        avatarId?: string;
        avatarGroupId?: string | null;
        voiceId?: string;
        consentUrl?: string | null;
        consentStatus?: string | null;
        avatarGroupStatus?: string | null;
        message?: string;
      }>(response);

      if (!response.ok) {
        throw new Error(payload.message || "Nao foi possivel treinar no HeyGen.");
      }

      setHeygenAvatarId(payload.avatarId?.trim() || "");
      setHeygenAvatarGroupId(String(payload.avatarGroupId ?? "").trim());
      setHeygenVoiceId(payload.voiceId?.trim() || "");
      setHeygenConsentUrl(String(payload.consentUrl ?? "").trim());

      if (
        !String(payload.consentUrl ?? "").trim() &&
        (payload.consentStatus || payload.avatarGroupStatus)
      ) {
        setConsentInfo(
          `Status do consentimento: ${payload.consentStatus ?? "(nao informado)"} | ` +
            `Status do grupo: ${payload.avatarGroupStatus ?? "(nao informado)"}`,
        );
      }

      persistHeygenPrefs({
        heygenAvatarId: payload.avatarId?.trim() || heygenAvatarId,
        heygenVoiceId: payload.voiceId?.trim() || heygenVoiceId,
        heygenAvatarGroupId: String(payload.avatarGroupId ?? "").trim() || heygenAvatarGroupId,
        lastCaricatureAssetId: sortedCaricatureAssets[0]?.id,
      });

      return payload.voiceId?.trim() || undefined;
    } catch (error) {
      setTrainingStarted(false);
      setTrainingError(error instanceof Error ? error.message : "Erro ao treinar HeyGen.");
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
      setTrainingBannerState("completed");
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
      const latestCaricatureId = await handleGenerateCaricature();
      await handleTrainHeyGen();
      setTrainingBannerState("completed");
      if (latestCaricatureId) {
        setSelectedCaricatureAssetId(latestCaricatureId);
      }
      persistHeygenPrefs({
        avatarTrack: "caricature",
        productionSource: "train_new",
        lastCaricatureAssetId: latestCaricatureId ?? selectedCaricatureAssetId,
      });
    } catch {
      setTrainingBannerState("hidden");
    }
  }

  function renderTrainingStartControl(
    canStart: boolean,
    onStart: () => Promise<void>,
  ) {
    if (!showTrainingUploads) {
      return null;
    }

    return (
      <div className="persona-cta-block persona-top-gap">
        <div className="persona-cta-row">
          <button
            type="button"
            className="persona-btn persona-btn-large"
            onClick={() => void onStart()}
            disabled={!canStart || isTrainingBusy}
          >
            {isTrainingBusy ? (
              <span className="persona-loading-row">
                <span className="persona-spinner" aria-hidden="true" />
                Treinando...
              </span>
            ) : (
              "Iniciar Treinamento"
            )}
          </button>
        </div>
        <div className="persona-training-status-banner" aria-live="polite">
          {trainingBannerState === "started" ? (
            <p className="persona-script-approved">Treinamento iniciado</p>
          ) : null}
          {trainingBannerState === "completed" ? (
            <p className="persona-script-approved">Treinamento concluído</p>
          ) : null}
        </div>
      </div>
    );
  }

  async function handleCheckConsent() {
    setConsentInfo(null);
    setTrainingError(null);

    if (!heygenAvatarGroupId) {
      setConsentInfo("Group ID ausente. Treine um Digital Twin para gerar o link de consentimento.");
      return;
    }

    try {
      const response = await fetch(
        `/api/heygen/avatars/groups/${encodeURIComponent(heygenAvatarGroupId)}`,
      );
      const payload = await parseJsonOrText<{
        group?: { status?: string | null; consent_status?: string | null; name?: string | null };
        message?: string;
      }>(response);

      if (!response.ok) {
        throw new Error(payload.message || "Nao foi possivel consultar o status do consentimento.");
      }

      setConsentInfo(
        `Grupo: ${payload.group?.name ?? heygenAvatarGroupId} | ` +
          `Status: ${payload.group?.status ?? "(nao informado)"} | ` +
          `Consentimento: ${payload.group?.consent_status ?? "(nao informado)"}`,
      );

      if (payload.group?.consent_status === "completed" || payload.group?.status === "completed") {
        setTrainingInfo("Consentimento concluído. Gere e aprove o roteiro para produzir.");
      }
    } catch (error) {
      setTrainingError(
        error instanceof Error ? error.message : "Nao foi possivel consultar o status.",
      );
    }
  }

  async function loadPrivateDigitalTwinLooks() {
    setLooksError(null);
    setIsLoadingLooks(true);
    try {
      const response = await fetch(
        "/api/heygen/avatars/looks?ownership=private&avatarType=digital_twin",
      );
      const payload = await parseJsonOrText<{
        looks?: Array<{
          id: string;
          name?: string | null;
          preview_image_url?: string | null;
          preview_video_url?: string | null;
          supported_api_engines?: string[];
        }>;
        message?: string;
      }>(response);

      if (!response.ok) {
        throw new Error(payload.message || "Nao foi possivel listar avatares HeyGen.");
      }

      const looks = payload.looks ?? [];
      setPrivateTwinLooks(looks);

      // UX: se ja existirem looks privados, selecione o primeiro automaticamente
      // (mas respeite uma selecao ja feita manualmente).
      if (
        !heygenAvatarId &&
        looks.length > 0 &&
        productionSource !== "train_new"
      ) {
        setHeygenAvatarId(looks[0].id);
      }
    } catch (error) {
      setLooksError(
        error instanceof Error ? error.message : "Nao foi possivel listar avatares HeyGen.",
      );
    } finally {
      setIsLoadingLooks(false);
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
      setVideoError(error instanceof Error ? error.message : "Falha ao gerar o video.");
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
  const selectedTrainingVideo = trainingVideoAssets[0] ?? null;

  useEffect(() => {
    if (!videoId || autoPollStartedRef.current || isGenerating) {
      return;
    }
    autoPollStartedRef.current = true;
    void pollVideo(videoId).catch((error) => {
      setVideoError(error instanceof Error ? error.message : "Falha ao acompanhar o video.");
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
    if (prefs.productionSource) {
      setProductionSource(prefs.productionSource);
    }
  }, [profileIdForPrefs]);

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
          <h2 className="sr-only">Curador — HeyGen</h2>

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
                className="upload-area persona-upload-area"
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
                  multiple
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    if (!files.length) return;
                    void uploadTrainingAssets(files, "dataset");
                    event.target.value = "";
                  }}
                />
                <span className="persona-btn persona-btn-upload-label">
                  {uploadAreaButtonLabel(Boolean(selectedTrainingVideo))}
                </span>
              </label>
              {selectedTrainingVideo ? (
                <div className="persona-upload-files">
                  <UploadedFileChip asset={selectedTrainingVideo} formatBytes={formatBytes} />
                  {trainingVideoAssets.length > 1 ? (
                    <span className="persona-helper-text">
                      +{trainingVideoAssets.length - 1} vídeos adicionais
                    </span>
                  ) : null}
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

          {avatarTrack === "caricature" && showTrainingUploads
            ? renderTrainingStartControl(
                canStartCaricatureTraining,
                handleStartCaricatureTraining,
              )
            : null}

          {avatarTrack === "realistic" && productionSource === "use_existing" && selectedTwinLook ? (
            <div className="persona-caricature-actions-card persona-top-gap">
              {selectedTwinLook.preview_image_url ? (
                <img
                  src={selectedTwinLook.preview_image_url}
                  alt="Preview do gêmeo digital"
                  className="persona-caricature-preview-image"
                />
              ) : selectedTwinLook.preview_video_url ? (
                <video
                  src={selectedTwinLook.preview_video_url}
                  className="persona-caricature-preview-image"
                  muted
                  playsInline
                  loop
                  autoPlay
                />
              ) : (
                <span className="persona-twin-preview-placeholder" aria-hidden="true" />
              )}
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

          {avatarTrack === "caricature" &&
          showTrainingUploads &&
          caricaturePreviewUrl &&
          !isGeneratingCaricature ? (
            <div className="persona-caricature-actions-card persona-top-gap">
              <img
                src={caricaturePreviewUrl}
                alt="Preview da caricatura gerada"
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
                {isHeyGenDailyLimitMessage(trainingError) ? (
                  <p className="persona-helper-text">
                    Limite diário da API HeyGen atingido (100 envios/dia no plano atual). Tente
                    amanhã ou faça upgrade no painel HeyGen.
                  </p>
                ) : null}
              </>
            )}
            {avatarTrack === "realistic" && heygenConsentUrl && (
              <p className="persona-helper-text persona-helper-highlight">
                Consentimento (HeyGen — obrigatório para Digital Twin):{" "}
                <a href={heygenConsentUrl} target="_blank" rel="noreferrer">
                  abrir página de consentimento
                </a>
              </p>
            )}
            {avatarTrack === "realistic" && heygenAvatarGroupId && (
              <div className="persona-cta-row">
                <button
                  type="button"
                  className="persona-btn persona-btn-secondary"
                  onClick={() => void handleCheckConsent()}
                >
                  Verificar status do consentimento
                </button>
              </div>
            )}
            {consentInfo && <p className="persona-helper-text">{consentInfo}</p>}
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
              {isHeyGenDailyLimitMessage(videoError) ? (
                <p className="persona-helper-text">
                  Limite diário da API HeyGen atingido. Use &quot;Utilizar … atual&quot; com o
                  último treinamento ou aguarde a renovação do limite.
                </p>
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
                <p className="persona-helper-text persona-helper-highlight">
                  Video pronto:{" "}
                  <a href={videoUrl} target="_blank" rel="noreferrer">
                    abrir MP4
                  </a>
                </p>
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

