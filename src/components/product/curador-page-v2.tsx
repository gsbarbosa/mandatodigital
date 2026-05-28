"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import Image from "next/image";

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

export function CuradorPageV2() {
  const uploadInputId = useId();
  const uploadVideoInputId = useId();
  const [isTraining, setIsTraining] = useState(false);
  const [trainingError, setTrainingError] = useState<string | null>(null);
  const [trainingInfo, setTrainingInfo] = useState<string | null>(null);
  const [heygenAvatarId, setHeygenAvatarId] = useState<string>("");
  const [heygenVoiceId, setHeygenVoiceId] = useState<string>("");
  const [heygenConsentUrl, setHeygenConsentUrl] = useState<string>("");
  const [trainingMode, setTrainingMode] = useState<"digital_twin" | "photo">(
    "digital_twin",
  );

  const [isGenerating, setIsGenerating] = useState(false);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [videoStatus, setVideoStatus] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [captionUrl, setCaptionUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [freePrompt, setFreePrompt] = useState<string>("");
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
        voiceId?: string;
        consentUrl?: string | null;
        message?: string;
      }>(response);

      if (!response.ok) {
        throw new Error(payload.message || "Nao foi possivel treinar no HeyGen.");
      }

      setHeygenAvatarId(payload.avatarId?.trim() || "");
      setHeygenVoiceId(payload.voiceId?.trim() || "");
      setHeygenConsentUrl(String(payload.consentUrl ?? "").trim());
      setTrainingInfo(payload.message || "Treino concluido.");
    } catch (error) {
      setTrainingError(error instanceof Error ? error.message : "Erro ao treinar HeyGen.");
    } finally {
      setIsTraining(false);
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
      if (!topic) {
        throw new Error("Informe o tema do video antes de gerar.");
      }
      if (!heygenAvatarId || !heygenVoiceId) {
        throw new Error("Clique em Treinar (HeyGen) antes de gerar o video.");
      }

      void saveProfile({ allowDraftDefaults: true, silent: true });

      const response = await fetch("/api/heygen/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          avatarId: heygenAvatarId,
          voiceId: heygenVoiceId,
          name: `Curador v2 - ${profileForm.fullName || "Politico"} - ${topic}`,
          freePrompt: freePrompt.trim() || undefined,
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

  const avatarImagePreviewUrl = useMemo(() => null, []);

  useEffect(() => {
    if (!videoId || autoPollStartedRef.current || isGenerating) {
      return;
    }
    autoPollStartedRef.current = true;
    void pollVideo(videoId).catch((error) => {
      setVideoError(error instanceof Error ? error.message : "Falha ao acompanhar o video.");
    });
  }, [videoId, isGenerating]);

  return (
    <div className="persona-container">
      <header className="persona-header">
        <h1>Calibragem de Persona (Curador v2 — HeyGen)</h1>
        <p className="persona-helper-text">
          Esta pagina replica o fluxo do Curador, mas usa HeyGen (sem mexer na versao
          oficial com Argil).
        </p>
      </header>

      <section className="persona-card">
        <h2>Treino do Avatar (HeyGen)</h2>

        <div className="persona-form-group">
          <label className="persona-label">Modo de treino (realismo)</label>
          <div className="persona-actions">
            <button
              type="button"
              className={trainingMode === "digital_twin" ? "persona-btn" : "persona-btn persona-btn-secondary"}
              onClick={() => setTrainingMode("digital_twin")}
              disabled={isTraining}
            >
              Realismo maximo (video / Digital Twin)
            </button>
            <button
              type="button"
              className={trainingMode === "photo" ? "persona-btn" : "persona-btn persona-btn-secondary"}
              onClick={() => setTrainingMode("photo")}
              disabled={isTraining}
            >
              Rapido (foto / Photo Avatar)
            </button>
          </div>
          <p className="persona-helper-text">
            Recomendado: <strong>Digital Twin</strong> quando tiver um video bom (mais realista). Foto e um fallback rapido.
          </p>
        </div>

        <div className="persona-form-row">
          <div className="persona-form-group">
            <label className="persona-label">Foto do rosto (fallback)</label>
            {selectedAvatarImage ? (
              <p className="persona-helper-text">{selectedAvatarImage.originalFilename}</p>
            ) : (
              <p className="persona-helper-text">Envie uma foto para criar o avatar.</p>
            )}
          </div>

          <div className="persona-form-group">
            <label className="persona-label">Audio de voz (para clonar voz)</label>
            {selectedVoiceAudio ? (
              <p className="persona-helper-text">{selectedVoiceAudio.originalFilename}</p>
            ) : (
              <p className="persona-helper-text">Envie um audio (MP3/WAV) para clonar a voz.</p>
            )}
          </div>
        </div>

        <div className="persona-form-row persona-actions">
          <label htmlFor={uploadInputId} className="persona-btn persona-btn-secondary">
            {isUploadingAvatarImageAsset ? "Enviando..." : "Enviar foto (JPEG/PNG)"}
          </label>
          <input
            id={uploadInputId}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void uploadTrainingAssets([file], "avatar_image");
              event.currentTarget.value = "";
            }}
          />

          <label htmlFor={`${uploadInputId}-audio`} className="persona-btn persona-btn-secondary">
            {isUploadingVoiceAudioAsset ? "Enviando..." : "Enviar audio (MP3/WAV)"}
          </label>
          <input
            id={`${uploadInputId}-audio`}
            type="file"
            accept="audio/*"
            style={{ display: "none" }}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void uploadTrainingAssets([file], "voice_audio");
              event.currentTarget.value = "";
            }}
          />

          <label htmlFor={uploadVideoInputId} className="persona-btn persona-btn-secondary">
            Enviar video (MP4) — Digital Twin
          </label>
          <input
            id={uploadVideoInputId}
            type="file"
            accept="video/*"
            style={{ display: "none" }}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void uploadTrainingAssets([file], "dataset");
              event.currentTarget.value = "";
            }}
          />

          <button
            type="button"
            className="persona-btn"
            onClick={() => void handleTrainHeyGen()}
            disabled={!canTrain || isTraining || isSavingProfile}
          >
            {isTraining ? "Treinando..." : "Treinar (HeyGen)"}
          </button>
        </div>

        {selectedTrainingVideo && (
          <p className="persona-helper-text">
            Video de treino: {selectedTrainingVideo.originalFilename}
          </p>
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
        {(heygenAvatarId || heygenVoiceId) && (
          <p className="persona-helper-text">
            HeyGen avatar: {heygenAvatarId || "(vazio)"} | voz: {heygenVoiceId || "(vazio)"}
          </p>
        )}
      </section>

      <section className="persona-card">
        <h2>Geracao de video (HeyGen)</h2>

        <div className="persona-form-group">
          <label className="persona-label">Tema do video</label>
          <textarea
            className="persona-input"
            value={profileForm.avatarVideoTopic}
            onChange={(event) =>
              setProfileForm((current) => ({ ...current, avatarVideoTopic: event.target.value }))
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
            placeholder="Escreva instrucoes livres (estilo, ritmo, frases, estrutura, gestos, tom). Ex: 'mais agressivo, 2 frases curtas no inicio, finalize com CTA...'"
          />
          <p className="persona-helper-text">
            Esse texto entra como instrucoes adicionais no script enviado para a HeyGen.
          </p>
        </div>

        <div className="persona-actions">
          <button
            type="button"
            className="persona-btn"
            onClick={() => void handleGenerate()}
            disabled={isGenerating || !heygenAvatarId || !heygenVoiceId}
          >
            {isGenerating ? "Gerando..." : "Gerar video (HeyGen)"}
          </button>
        </div>

        {videoError ? (
          <p className="persona-helper-text persona-helper-highlight">{videoError}</p>
        ) : (
          <>
            {(videoStatus || videoId) && (
              <p className="persona-helper-text">
                Status: {formatStatus(videoStatus)} {videoId ? `| Job: ${videoId}` : ""}
              </p>
            )}
            {isGenerating && <div className="persona-progress" />}
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
      </section>
    </div>
  );
}

