"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import {
  archetypeOptions,
  avatarTypeOptions,
  spectrumOptions,
  voiceToneOptions,
} from "@/lib/constants";
import { useProductApp } from "@/components/product/provider";

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

export function CuradorPageV2() {
  const uploadInputId = useId();
  const uploadVideoInputId = useId();
  const [isTraining, setIsTraining] = useState(false);
  const [trainingError, setTrainingError] = useState<string | null>(null);
  const [trainingInfo, setTrainingInfo] = useState<string | null>(null);
  const [heygenAvatarId, setHeygenAvatarId] = useState<string>("");
  const [heygenAvatarGroupId, setHeygenAvatarGroupId] = useState<string>("");
  const [heygenVoiceId, setHeygenVoiceId] = useState<string>("");
  const [heygenConsentUrl, setHeygenConsentUrl] = useState<string>("");
  const [trainingMode, setTrainingMode] = useState<"digital_twin" | "photo">(
    "digital_twin",
  );
  const [consentInfo, setConsentInfo] = useState<string | null>(null);
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
    sessionUser,
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

  const canTrain =
    trainingMode === "digital_twin"
      ? Boolean(trainingVideoAssets[0] && voiceAudioAssets[0])
      : Boolean(avatarImageAssets[0] && voiceAudioAssets[0]);

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
          mode: trainingMode,
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
          "Consentimento concluido. Agora clique em 'Selecionar Digital Twin existente' e escolha o look para gerar videos.",
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
      if (!useFreePromptAsTranscript && !topic) {
        throw new Error("Informe o tema do video antes de gerar.");
      }
      if (useFreePromptAsTranscript && !free) {
        throw new Error("Escreva o roteiro completo no Prompt livre para gerar em modo teste.");
      }
      if (!heygenAvatarId) {
        throw new Error(
          "Selecione um Digital Twin existente ou clique em Treinar (HeyGen) antes de gerar o video.",
        );
      }

      void saveProfile({ allowDraftDefaults: true, silent: true });

      const response = await fetch("/api/heygen/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: useFreePromptAsTranscript ? undefined : topic,
          avatarId: heygenAvatarId,
          voiceId: heygenVoiceId || undefined,
          name: useFreePromptAsTranscript
            ? `Curador v2 - prompt livre - ${profileForm.fullName || "Politico"}`
            : `Curador v2 - ${profileForm.fullName || "Politico"} - ${topic}`,
          transcript: useFreePromptAsTranscript ? free : undefined,
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
    const loginEmail = sessionUser?.email?.trim();
    if (!loginEmail) {
      return;
    }
    setProfileForm((current) => {
      if (current.notificationEmail?.trim()) {
        return current;
      }
      return { ...current, notificationEmail: loginEmail };
    });
  }, [sessionUser?.email, setProfileForm]);

  return (
    <section className="persona-page">
      <div className="persona-container">
        <div className="persona-card">
          <h2 className="sr-only">Curador v2 — HeyGen</h2>

          <div className="persona-section-header">
            <div className="persona-header-icon" aria-hidden="true">
              HG
            </div>
            <h2>Calibragem de Persona (Curador v2 — HeyGen)</h2>
            <p>
              Fluxo de teste com HeyGen. Nao altera o Curador oficial (Argil) e foca em
              realismo maximo com Digital Twin quando houver video.
            </p>
          </div>

          <div className="persona-form-group">
            <label className="persona-label">
              Upload de midias <span className="persona-badge">Obrigatorio</span>
            </label>

            <div className="persona-upload-files">
              <span className="persona-file-chip">
                1) Audio de voz: {selectedVoiceAudio ? "enviado" : "pendente"}
              </span>
              <span className="persona-file-chip">
                2) Video (Digital Twin): {selectedTrainingVideo ? "enviado" : "opcional"}
              </span>
              <span className="persona-file-chip">
                3) Foto (fallback): {selectedAvatarImage ? "enviada" : "opcional"}
              </span>
            </div>

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
              <h4>1) Audio de voz (obrigatorio)</h4>
              <p>
                Grave de 30 segundos a alguns minutos falando de forma natural (MP3, WAV ou
                M4A). Usamos para clonar a voz na HeyGen.
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
              <span className="persona-btn">
                {isUploadingVoiceAudioAsset ? (
                  <span className="persona-loading-row">
                    <span className="persona-spinner" aria-hidden="true" />
                    Enviando...
                  </span>
                ) : selectedVoiceAudio ? (
                  "Substituir audio"
                ) : (
                  "Selecionar audio"
                )}
              </span>
              {isUploadingVoiceAudioAsset && <div className="persona-progress" />}
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
              <h4>2) Video (Digital Twin) — base de treino</h4>
              <p>
                Video em boa luz, rosto visivel e audio ok (MP4). Essa e a opcao mais realista.
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
              <span className="persona-btn persona-btn-secondary">
                {selectedTrainingVideo ? "Adicionar/Substituir videos" : "Selecionar videos"}
              </span>
            </label>

            {trainingVideoAssets.length > 0 && (
              <div className="persona-upload-files">
                {trainingVideoAssets.slice(0, 5).map((asset) => (
                  <span key={asset.id} className="persona-file-chip">
                    {asset.originalFilename}
                    {asset.sizeBytes ? ` (${formatBytes(asset.sizeBytes)})` : ""}
                  </span>
                ))}
                {trainingVideoAssets.length > 5 && (
                  <span className="persona-helper-text">
                    +{trainingVideoAssets.length - 5} videos adicionais
                  </span>
                )}
              </div>
            )}

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
              <h4>3) Foto (fallback rapido)</h4>
              <p>Foto do rosto (PNG/JPEG/WebP), bem iluminada, de frente.</p>
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
              <span className="persona-btn">
                {isUploadingAvatarImageAsset ? (
                  <span className="persona-loading-row">
                    <span className="persona-spinner" aria-hidden="true" />
                    Enviando...
                  </span>
                ) : selectedAvatarImage ? (
                  "Substituir foto"
                ) : (
                  "Selecionar foto"
                )}
              </span>
              {isUploadingAvatarImageAsset && <div className="persona-progress" />}
            </label>

          </div>

          <div className="persona-form-group">
            <label className="persona-label">Modo de treino (realismo)</label>
            <div className="persona-tag-list">
              <button
                type="button"
                className={trainingMode === "digital_twin" ? "persona-tag active" : "persona-tag"}
                onClick={() => setTrainingMode("digital_twin")}
                disabled={isTraining}
              >
                Digital Twin (video) — maximo realismo
              </button>
              <button
                type="button"
                className={trainingMode === "photo" ? "persona-tag active" : "persona-tag"}
                onClick={() => setTrainingMode("photo")}
                disabled={isTraining}
              >
                Photo Avatar (foto) — rapido
              </button>
            </div>
            <p className="persona-helper-text">
              Para <strong>Digital Twin</strong>, envie video + audio. Para{" "}
              <strong>Photo Avatar</strong>, envie foto + audio.
            </p>
          </div>

          <div className="persona-cta-block">
            <div className="persona-cta-row">
              <button
                type="button"
                className="persona-btn persona-btn-large"
                onClick={() => void handleTrainHeyGen()}
                disabled={!canTrain || isTraining || isSavingProfile}
              >
                {isTraining ? (
                  <span className="persona-loading-row">
                    <span className="persona-spinner" aria-hidden="true" />
                    Treinando...
                  </span>
                ) : (
                  "Treinar (HeyGen)"
                )}
              </button>
              {isTraining && <div className="persona-progress" />}
            </div>

            <div className="persona-cta-row">
              <button
                type="button"
                className="persona-btn persona-btn-secondary"
                onClick={() => void loadPrivateDigitalTwinLooks()}
                disabled={isLoadingLooks}
              >
                {isLoadingLooks ? "Carregando avatares..." : "Selecionar Digital Twin existente"}
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
              <p className="persona-helper-text">
                HeyGen group_id (Digital Twin): {heygenAvatarGroupId}
              </p>
            )}
            {trainingMode === "digital_twin" && heygenAvatarGroupId && (
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
            {(heygenAvatarId || heygenVoiceId) && (
              <p className="persona-helper-text">
                HeyGen avatar: {heygenAvatarId || "(vazio)"} | voz: {heygenVoiceId || "(vazio)"}
              </p>
            )}
          </div>

          {privateTwinLooks.length > 0 && (
            <div className="persona-form-group">
              <label className="persona-label">Digital Twins (looks privados)</label>
              <p className="persona-helper-text">
                Selecione um look para usar como <strong>avatar_id</strong> na geracao.
              </p>
              <ul className="persona-video-history">
                {privateTwinLooks.map((look) => {
                  const isSelected = heygenAvatarId === look.id;
                  const engines = (look.supported_api_engines ?? []).join(", ");
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
                            "Digital Twin selecionado. Voce ja pode gerar videos.",
                          );
                        }}
                      >
                        <strong>{look.name || "Digital Twin"}</strong>
                        <span>{look.id}</span>
                        <span>
                          {engines ? `Engines: ${engines}` : "Engines: (nao informado)"}
                        </span>
                      </button>
                      {look.preview_video_url ? (
                        <a
                          className="persona-btn persona-btn-secondary"
                          href={look.preview_video_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Preview
                        </a>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
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
            <div className="persona-tag-list">
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
              className="persona-input-control"
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
            <div className="persona-tag-list">
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
            <p className="persona-helper-text persona-top-gap">
              A nao selecao de algum arquetipo nao traz prejuizo para sua identidade comunicacional.
            </p>
          </div>

          <div className="persona-form-group">
            <label className="persona-label">Tom de linguagem</label>
            <div className="persona-tag-list">
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
            <p className="persona-helper-text persona-top-gap">
              A nao selecao de algum modificador de tom nao traz prejuizo para sua identidade comunicacional.
            </p>
          </div>

          <div className="persona-form-group">
            <label className="persona-label">Tipo de Avatar</label>
            <div className="persona-tag-list">
              {avatarTypeOptions.map((option) => (
                <PersonaTag
                  key={option}
                  active={profileForm.avatarType === option}
                  onClick={() =>
                    setProfileForm((current) => ({
                      ...current,
                      avatarType: option,
                    }))
                  }
                >
                  {option}
                </PersonaTag>
              ))}
            </div>
          </div>

          <div className="persona-form-group">
            <label className="persona-label">
              Seu e-mail <span className="persona-badge">Obrigatorio</span>
            </label>
            <input
              type="email"
              className="persona-input-control"
              value={profileForm.notificationEmail ?? ""}
              onChange={(event) =>
                setProfileForm((current) => ({
                  ...current,
                  notificationEmail: event.target.value,
                }))
              }
              placeholder="voce@exemplo.com"
              autoComplete="email"
            />
            <p className="persona-helper-text persona-top-gap">
              Avisos de treino e video (quando disponivel). Preenchemos com o e-mail da sua conta
              se estiver vazio.
            </p>
          </div>

          <div className="persona-form-group">
            <label className="persona-label">Tema do video</label>
            <textarea
              className="persona-input-control"
              value={profileForm.avatarVideoTopic}
              onChange={(event) =>
                setProfileForm((current) => ({
                  ...current,
                  avatarVideoTopic: event.target.value,
                }))
              }
              rows={4}
            />
          </div>

          <div className="persona-form-group">
            <label className="persona-label">Prompt livre (teste)</label>
            <textarea
              className="persona-input"
              value={freePrompt}
              onChange={(event) => setFreePrompt(event.target.value)}
              rows={6}
              placeholder="Use 1-2 frases curtas. Ex: 'tom confiante. frases curtas. finalize com CTA.'"
            />
            <div className="persona-checkbox-row">
              <label className="persona-checkbox">
                <input
                  type="checkbox"
                  checked={useFreePromptAsTranscript}
                  onChange={(event) => setUseFreePromptAsTranscript(event.target.checked)}
                />
                Usar o Prompt livre como roteiro completo (ignorar o sistema)
              </label>
            </div>
            <p className="persona-helper-text">
              {useFreePromptAsTranscript
                ? "Modo teste: o Prompt livre vira o texto falado completo."
                : "Dica: esse texto entra junto do script e pode aumentar a duracao/custo do video."}
            </p>
          </div>

          <div className="persona-generate-row">
            <button
              type="button"
              className="persona-btn persona-btn-large"
              onClick={() => void handleGenerate()}
              disabled={isGenerating || !heygenAvatarId}
            >
              {isGenerating ? (
                <span className="persona-loading-row">
                  <span className="persona-spinner" aria-hidden="true" />
                  Gerando...
                </span>
              ) : (
                "Gerar video (HeyGen)"
              )}
            </button>
            {isGenerating && <div className="persona-progress" />}
          </div>

          {!heygenVoiceId && heygenAvatarId && (
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

