"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import {
  archetypeOptions,
  spectrumOptions,
  voiceToneOptions,
} from "@/lib/constants";
import { useProductApp } from "@/components/product/provider";
import type { ProfileTrainingAsset } from "@/lib/types";

const MAX_SCRIPT_WORDS = 160;

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
      return "Concluido";
    case "failed":
      return "Falhou";
    default:
      return status || "Desconhecido";
  }
}

function toggleValue(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
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
  const [avatarTrack, setAvatarTrack] = useState<AvatarTrack>("realistic");
  const [consentInfo, setConsentInfo] = useState<string | null>(null);
  const [isGeneratingCaricature, setIsGeneratingCaricature] = useState(false);
  const [caricatureError, setCaricatureError] = useState<string | null>(null);
  const [caricatureInfo, setCaricatureInfo] = useState<string | null>(null);
  const [caricaturePreviewUrl, setCaricaturePreviewUrl] = useState<string | null>(null);
  const [isLoadingLooks, setIsLoadingLooks] = useState(false);
  const [looksError, setLooksError] = useState<string | null>(null);
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

  const canTrainRealistic = Boolean(trainingVideoAssets[0] && voiceAudioAssets[0]);
  const canTrainCaricature = Boolean(caricatureAssets[0] && voiceAudioAssets[0]);
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
    "Selecione somente se necessario. Caso nao escolha nenhum arquetipo, a IA utilizara a identidade comunicacional do candidato, identificada nas midias que voce enviou.";

  const selectedTwinLook =
    privateTwinLooks.find((look) => look.id === heygenAvatarId) ?? null;

  function selectAvatarTrack(track: AvatarTrack) {
    setAvatarTrack(track);
    setProfileForm((current) => ({
      ...current,
      avatarType: AVATAR_TYPE_BY_TRACK[track],
    }));
  }

  function invalidateScriptApproval() {
    setScriptApproved(false);
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
      void saveProfile({ allowDraftDefaults: true, silent: true });
      const response = await fetch("/api/heygen/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
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
    if (scriptTopicSnapshot !== profileForm.avatarVideoTopic.trim()) {
      setScriptError("O tema mudou. Gere o roteiro novamente antes de aprovar.");
      return;
    }
    setScriptApproved(true);
  }

  async function handleGenerateCaricature() {
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
      }
      setCaricaturePreviewUrl(payload.previewUrl?.trim() || null);
      setCaricatureInfo(payload.message || "Caricatura gerada.");
      setHeygenVoiceId("");
      setTrainingInfo(null);
    } catch (error) {
      setCaricatureError(
        error instanceof Error ? error.message : "Erro ao gerar caricatura.",
      );
    } finally {
      setIsGeneratingCaricature(false);
    }
  }

  async function handleTrainHeyGen() {
    setTrainingError(null);
    setTrainingInfo(null);
    setConsentInfo(null);
    setHeygenConsentUrl("");
    setIsTraining(true);

    try {
      void saveProfile({ allowDraftDefaults: true, silent: true });
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
      setTrainingInfo(payload.message || "Treino concluido.");

      if (
        !String(payload.consentUrl ?? "").trim() &&
        (payload.consentStatus || payload.avatarGroupStatus)
      ) {
        setConsentInfo(
          `Status do consentimento: ${payload.consentStatus ?? "(nao informado)"} | ` +
            `Status do grupo: ${payload.avatarGroupStatus ?? "(nao informado)"}`,
        );
      }
    } catch (error) {
      setTrainingError(error instanceof Error ? error.message : "Erro ao treinar HeyGen.");
    } finally {
      setIsTraining(false);
    }
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
        setTrainingInfo(
          "Consentimento concluido. Selecione o gemeo digital e aprove o roteiro para produzir.",
        );
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

      setPrivateTwinLooks(payload.looks ?? []);
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
      if (avatarTrack === "caricature" && !heygenVoiceId) {
        throw new Error(
          "Prepare a voz (HeyGen) e gere a caricatura antes de produzir o video caricato.",
        );
      }

      void saveProfile({ allowDraftDefaults: true, silent: true });

      const response = await fetch("/api/heygen/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: useFreePromptAsTranscript ? undefined : topic || scriptTopicSnapshot,
          avatarId: avatarTrack === "realistic" ? heygenAvatarId : undefined,
          voiceId: heygenVoiceId || undefined,
          generateMode: avatarTrack === "caricature" ? "caricature" : "avatar",
          name: useFreePromptAsTranscript
            ? `Curador v2 - prompt livre - ${profileForm.fullName || "Politico"}`
            : `Curador v2 - ${profileForm.fullName || "Politico"} - ${topic || scriptTopicSnapshot}`,
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
  const selectedCaricature = caricatureAssets[0] ?? null;
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
          <h2 className="sr-only">Curador v2 — HeyGen</h2>

          <div className="persona-section-header">
            <div className="persona-header-icon" aria-hidden="true">
              <PersonaHeaderIcon />
            </div>
            <h2>Calibragem de Persona</h2>
            <p>
              O Agente Curador usa estes dados para garantir que os roteiros tenham &quot;a sua
              cara&quot;.
            </p>
          </div>

          <div className="persona-form-group">
            <label className="persona-label">Tipo de producao</label>
            <p className="persona-helper-text persona-top-gap">
              Escolha entre realismo maximo (seu gemeo digital) ou avatar caricato (sua
              caricatura). Ambas digitalizadas e prontas para gravacoes em video.
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
                disabled={isTraining || isGeneratingCaricature}
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
                disabled={isTraining || isGeneratingCaricature}
              >
                Avatar Caricato
              </button>
            </div>
            <div className="persona-production-track-hints">
              <p>
                Para <strong>Gêmeo Digital</strong> envie: <strong>video</strong> e{" "}
                <strong>audio</strong>
              </p>
              <p>
                Para <strong>Avatar Caricato</strong> envie: <strong>foto</strong> e{" "}
                <strong>audio</strong>
              </p>
            </div>
          </div>

          <div className="persona-form-group">
            <label className="persona-label">
              Upload de VOZ <span className="persona-badge">Obrigatorio</span>
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
                Grave um audio de aproximadamente 30 segundos falando de forma natural (MP3, WAV
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

          {avatarTrack === "realistic" ? (
            <div className="persona-form-group">
              <label className="persona-label">
                Upload de video <span className="persona-badge">Obrigatorio</span>
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
                <h4 className="persona-upload-block-title">Base de treino — avatar gemeo digital</h4>
                <p>
                  Video em boa luz, rosto visivel e audio ok (MP4) com o candidato falando de frente
                  para a camera de forma natural sobre um tema qualquer. A IA mapeara sua cadencia,
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
                      +{trainingVideoAssets.length - 1} videos adicionais
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="persona-form-group">
              <label className="persona-label">
                Upload de FOTO <span className="persona-badge">Obrigatorio</span>
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
          )}

          {avatarTrack === "realistic" ? (
            <div className="persona-cta-block">
              <div className="persona-cta-row">
                <button
                  type="button"
                  className="persona-btn persona-btn-large"
                  onClick={() => void handleTrainHeyGen()}
                  disabled={!canTrainRealistic || isTraining || isSavingProfile}
                >
                  {isTraining ? (
                    <span className="persona-loading-row">
                      <span className="persona-spinner" aria-hidden="true" />
                      Treinando gemeo digital...
                    </span>
                  ) : (
                    "Treinar novo Gêmeo Digital"
                  )}
                </button>
              </div>

              <div className="persona-caricature-actions-card">
                {selectedTwinLook?.preview_image_url ? (
                  <img
                    src={selectedTwinLook.preview_image_url}
                    alt="Preview do gemeo digital"
                    className="persona-caricature-preview-image"
                  />
                ) : selectedTwinLook?.preview_video_url ? (
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
                <p className="persona-helper-text">
                  {heygenAvatarId
                    ? "Gêmeo digital selecionado. Gere e aprove o roteiro para produzir o conteudo."
                    : "Treine ou selecione um gemeo digital para visualizar o avatar."}
                </p>
              </div>

              <div className="persona-cta-row">
                <button
                  type="button"
                  className="persona-btn persona-btn-secondary persona-twin-action-btn"
                  onClick={() => void loadPrivateDigitalTwinLooks()}
                  disabled={isLoadingLooks}
                >
                  {isLoadingLooks
                    ? "Carregando avatares..."
                    : (
                        <>
                          Produzir conteudo a partir do
                          <br />
                          Gêmeo Digital atual
                        </>
                      )}
                </button>
              </div>

              {looksError && (
                <p className="persona-helper-text persona-helper-highlight">{looksError}</p>
              )}
              {trainingError && (
                <p className="persona-helper-text persona-helper-highlight">{trainingError}</p>
              )}
              {trainingInfo && <p className="persona-helper-text">{trainingInfo}</p>}
              {heygenConsentUrl && (
                <p className="persona-helper-text persona-helper-highlight">
                  Consentimento (HeyGen — obrigatorio p/ Digital Twin):{" "}
                  <a href={heygenConsentUrl} target="_blank" rel="noreferrer">
                    abrir pagina de consentimento
                  </a>
                </p>
              )}
              {heygenAvatarGroupId && (
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

              {privateTwinLooks.length > 0 && (
                <ul className="persona-video-history">
                  {privateTwinLooks.map((look) => {
                    const isSelected = heygenAvatarId === look.id;
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
                            setHeygenAvatarId(look.id);
                            setTrainingInfo(
                              "Gêmeo digital selecionado. Agora gere e aprove o roteiro para produzir.",
                            );
                          }}
                        >
                          <strong>{look.name || "Gêmeo Digital"}</strong>
                          <span>{look.id}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : (
            <div className="persona-cta-block">
              <div className="persona-cta-row">
                <button
                  type="button"
                  className="persona-btn persona-btn-secondary"
                  onClick={() => void handleGenerateCaricature()}
                  disabled={!canGenerateCaricature || isGeneratingCaricature}
                >
                  {isGeneratingCaricature ? (
                    <span className="persona-loading-row">
                      <span className="persona-spinner" aria-hidden="true" />
                      Gerando caricatura...
                    </span>
                  ) : (
                    "Treinar nova Caricatura Digital"
                  )}
                </button>
              </div>

              {caricatureError && (
                <p className="persona-helper-text persona-helper-highlight">{caricatureError}</p>
              )}
              {caricatureInfo && <p className="persona-helper-text">{caricatureInfo}</p>}

              {caricaturePreviewUrl && (
                <div className="persona-caricature-actions-card">
                  <img
                    src={caricaturePreviewUrl}
                    alt="Preview da caricatura gerada"
                    className="persona-caricature-preview-image"
                  />
                  <p className="persona-helper-text">
                    Revise a caricatura antes de preparar a voz e gerar o video.
                  </p>
                  <div className="persona-cta-row persona-top-gap">
                    <button
                      type="button"
                      className="persona-btn"
                      onClick={() => void handleTrainHeyGen()}
                      disabled={!canTrainCaricature || isTraining || isSavingProfile}
                    >
                      {isTraining ? (
                        <span className="persona-loading-row">
                          <span className="persona-spinner" aria-hidden="true" />
                          Preparando voz...
                        </span>
                      ) : (
                        "Preparar voz (HeyGen)"
                      )}
                    </button>
                  </div>
                  <p className="persona-helper-text persona-top-gap">
                    Caso necessite ajustar a voz da caricatura, faca novo upload de audio.
                  </p>
                </div>
              )}

              {trainingError && (
                <p className="persona-helper-text persona-helper-highlight">{trainingError}</p>
              )}
              {trainingInfo && <p className="persona-helper-text">{trainingInfo}</p>}
            </div>
          )}

          <hr className="persona-divider" />

          <div className="persona-form-group">
            <label className="persona-label">
              Posicionamento ideologico <span className="persona-badge">Obrigatorio</span>
            </label>
            <p className="persona-helper-text">
              O posicionamento ideologico compoe a base da resposta que a IA vai gerar sobre o
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
            <label className="persona-label">Glossario de expressoes</label>
            <p className="persona-helper-text">
              Inclua caracteristicas fundamentais da sua expressao, como por exemplo: ne, tipo,
              entendeu, sabe, ta, ok, certo, mano, assim.
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
              placeholder="Digite suas expressoes, separadas por virgula..."
            />
          </div>

          <div className="persona-form-group">
            <label className="persona-label">Arquetipos de Persona Politica</label>
            <p className="persona-helper-text">{archetypeHelperText}</p>
            <div className="persona-tag-list persona-top-gap">
              {archetypeOptions.map((option) => (
                <PersonaTag
                  key={option}
                  active={(profileForm.personaArchetypes ?? []).includes(option)}
                  onClick={() =>
                    setProfileForm((current) => {
                      const personaArchetypes = toggleValue(
                        current.personaArchetypes ?? [],
                        option,
                      );
                      return {
                        ...current,
                        personaArchetypes,
                        archetype: personaArchetypes[0] ?? current.archetype,
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
                      voiceTones: toggleValue(current.voiceTones ?? [], tone),
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
              Seu e-mail <span className="persona-badge">Obrigatorio</span>
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
            <label className="persona-label">Tema do video</label>
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
              <label className="persona-label">Aprovacao do roteiro</label>
              <p className="persona-helper-text">
                Veja o roteiro do video que sera produzido. Altere-o conforme necessario. Maximo de{" "}
                {MAX_SCRIPT_WORDS} palavras (ou ~1 minuto).
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
                <p className="persona-script-approved">Roteiro aprovado. Voce ja pode produzir o conteudo.</p>
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
              disabled={isGenerating || !canProduceContent}
            >
              {isGenerating ? (
                <span className="persona-loading-row">
                  <span className="persona-spinner" aria-hidden="true" />
                  Gerando...
                </span>
              ) : (
                "Gerar Conteudo a partir do Avatar selecionado"
              )}
            </button>
            {isGenerating && <div className="persona-progress" />}
          </div>

          {avatarTrack === "realistic" && !heygenVoiceId && heygenAvatarId && (
            <p className="persona-helper-text">
              Observacao: sem voz clonada/selecionada, a HeyGen pode usar a voz padrao do avatar.
            </p>
          )}

          {videoError ? (
            <p className="persona-helper-text persona-helper-highlight">{videoError}</p>
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

