"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import {
  archetypeOptions,
  avatarTypeOptions,
  spectrumOptions,
  voiceToneOptions,
} from "@/lib/constants";
import type { AvatarVideoGeneration } from "@/lib/types";

import { AvatarImageCropModal } from "./avatar-image-crop-modal";
import { useProductApp } from "./provider";

type VideoGenerationPayload = {
  id: string;
  status?: string;
  previewUrl?: string;
  videoUrl?: string;
  errorMessage?: string;
  topic?: string;
  createdAt?: string;
};

function formatVideoStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "GENERATING_AUDIO":
      return "Gerando audio";
    case "GENERATING_VIDEO":
      return "Gerando video (lip-sync)";
    case "DONE":
      return "Concluido";
    case "FAILED":
      return "Falhou";
    case "DRY_RUN":
      return "Simulacao (dry-run)";
    case "IDLE":
      return "Aguardando";
    default:
      return status || "Desconhecido";
  }
}

function formatVideoCreatedAt(value: string | undefined) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

export function CuradorPage() {
  const uploadInputId = useId();
  const [trainingRequested, setTrainingRequested] = useState(false);
  const [isTrainingAvatar, setIsTrainingAvatar] = useState(false);
  const [avatarTrainingStatus, setAvatarTrainingStatus] = useState<string | null>(null);
  const [avatarTrainingError, setAvatarTrainingError] = useState<string | null>(null);
  const [avatarTrainingInfo, setAvatarTrainingInfo] = useState<string | null>(null);
  const [videoGenerationId, setVideoGenerationId] = useState<string | null>(null);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [isRefreshingVideoStatus, setIsRefreshingVideoStatus] = useState(false);
  const [isLoadingVideoGenerations, setIsLoadingVideoGenerations] = useState(false);
  const [videoGenerations, setVideoGenerations] = useState<AvatarVideoGeneration[]>([]);
  const [videoStatus, setVideoStatus] = useState<string | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const autoPollStartedRef = useRef(false);
  const [avatarImageToCrop, setAvatarImageToCrop] = useState<File | null>(null);
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
    () =>
      visibleTrainingAssets.filter((asset) => asset.trainingRole === "avatar_image"),
    [visibleTrainingAssets],
  );
  const legacyDatasetAssets = useMemo(
    () => visibleTrainingAssets.filter((asset) => asset.trainingRole === "dataset"),
    [visibleTrainingAssets],
  );
  const voiceAudioAssets = useMemo(
    () =>
      visibleTrainingAssets.filter((asset) => asset.trainingRole === "voice_audio"),
    [visibleTrainingAssets],
  );

  const isTrainingInProgress =
    isTrainingAvatar ||
    avatarTrainingStatus === "TRAINING" ||
    profileForm.avatarTrainingStatus === "TRAINING";

  const curadorFormSnapshot = useMemo(
    () =>
      JSON.stringify({
        spectrum: profileForm.spectrum,
        glossaryTerms: profileForm.glossaryTerms,
        personaArchetypes: profileForm.personaArchetypes,
        voiceTones: profileForm.voiceTones,
        avatarType: profileForm.avatarType,
        avatarVideoTopic: profileForm.avatarVideoTopic,
        notificationEmail: profileForm.notificationEmail,
      }),
    [
      profileForm.spectrum,
      profileForm.glossaryTerms,
      profileForm.personaArchetypes,
      profileForm.voiceTones,
      profileForm.avatarType,
      profileForm.avatarVideoTopic,
      profileForm.notificationEmail,
    ],
  );

  useEffect(() => {
    if (!isTrainingInProgress) {
      return;
    }

    const timer = setTimeout(() => {
      void saveProfile({ allowDraftDefaults: true });
    }, 2000);

    return () => clearTimeout(timer);
  }, [isTrainingInProgress, curadorFormSnapshot, saveProfile]);

  async function parseJsonOrText<T>(response: Response): Promise<T> {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      return (await response.json()) as T;
    }

    const text = await response.text();
    // Mantém compatibilidade com os usos existentes que esperam `payload.message`.
    return ({ message: text } as unknown as T);
  }

  async function pollAvatarTraining(trainingId: string) {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const response = await fetch(
        `/api/argil/avatars/train?trainingId=${encodeURIComponent(trainingId)}`,
      );
      const payload = await parseJsonOrText<{
        training?: {
          status?: string;
          argilAvatarId?: string | null;
          argilVoiceId?: string | null;
          errorMessage?: string;
        };
        message?: string;
      }>(response);

      if (!response.ok) {
        throw new Error(payload.message || "Nao foi possivel consultar o treinamento.");
      }

      const training = payload.training;
      setAvatarTrainingStatus(training?.status ?? null);

      if (training?.status === "IDLE") {
        setProfileForm((current) => ({
          ...current,
          argilAvatarId: training.argilAvatarId ?? current.argilAvatarId,
          argilVoiceId: training.argilVoiceId ?? current.argilVoiceId,
          avatarTrainingStatus: "IDLE",
        }));
        return training;
      }

      if (
        training?.status === "TRAINING_FAILED" ||
        training?.status === "REFUSED"
      ) {
        throw new Error(training.errorMessage || "Treinamento falhou na Argil.");
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return null;
  }

  async function handleTrainIa() {
    setTrainingRequested(true);
    setAvatarTrainingError(null);
    setAvatarTrainingInfo(null);
    setAvatarTrainingStatus(null);
    setIsTrainingAvatar(true);

    try {
      void saveProfile({ allowDraftDefaults: true });

      const response = await fetch("/api/argil/avatars/train", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          profileId: profile?.id ?? null,
          draftProfileId: profile?.id ? null : profileForm.id ?? null,
          avatarName: profileForm.fullName?.trim() || undefined,
        }),
      });

      const payload = await parseJsonOrText<{
        avatarReady?: boolean;
        training?: {
          id?: string;
          status?: string;
          argilAvatarId?: string | null;
          argilVoiceId?: string | null;
        };
        message?: string;
      }>(response);

      if (!response.ok) {
        throw new Error(payload.message || "Nao foi possivel iniciar o treinamento.");
      }

      if (payload.avatarReady) {
        setAvatarTrainingStatus("IDLE");
        setProfileForm((current) => ({
          ...current,
          avatarTrainingStatus: "IDLE",
          argilAvatarId: payload.training?.argilAvatarId ?? current.argilAvatarId,
          argilVoiceId: payload.training?.argilVoiceId ?? current.argilVoiceId,
        }));
        setAvatarTrainingInfo(
          payload.message ??
            "Avatar pronto. Voce ja pode gerar videos com o tema desejado.",
        );
        return;
      }

      const trainingId = payload.training?.id;
      if (!trainingId) {
        throw new Error("Resposta de treinamento invalida.");
      }

      setAvatarTrainingStatus(payload.training?.status ?? "TRAINING");
      await pollAvatarTraining(trainingId);
    } catch (error) {
      setAvatarTrainingError(
        error instanceof Error ? error.message : "Erro ao treinar avatar.",
      );
    } finally {
      setIsTrainingAvatar(false);
    }
  }

  function isVideoReady(generation?: {
    status?: string;
    videoUrl?: string | null;
  }) {
    return (
      generation?.status === "DONE" && Boolean(String(generation.videoUrl ?? "").trim())
    );
  }

  function isVideoInProgress(generation?: { status?: string; videoUrl?: string | null }) {
    if (!generation?.status || generation.status === "FAILED") {
      return false;
    }

    return !isVideoReady(generation);
  }

  const applyGenerationState = useCallback((generation: VideoGenerationPayload) => {
    setVideoGenerationId(generation.id);
    setVideoStatus(generation.status ?? null);
    setVideoPreviewUrl(generation.previewUrl?.trim() || null);
    setVideoUrl(generation.videoUrl?.trim() || null);
    if (generation.status === "FAILED" && generation.errorMessage) {
      setVideoError(generation.errorMessage);
    }
  }, []);

  const upsertVideoGeneration = useCallback((generation: AvatarVideoGeneration) => {
    setVideoGenerations((current) => {
      const withoutCurrent = current.filter((item) => item.id !== generation.id);
      return [generation, ...withoutCurrent].sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      );
    });
  }, []);

  async function loadVideoGenerations() {
    if (!assetReferenceId) {
      setVideoGenerations([]);
      return;
    }

    setIsLoadingVideoGenerations(true);

    try {
      const response = await fetch("/api/argil/videos");
      const payload = await parseJsonOrText<{ generations?: AvatarVideoGeneration[] }>(
        response,
      );

      if (!response.ok) {
        return;
      }

      const generations = payload.generations ?? [];
      setVideoGenerations(generations);

      const active =
        generations.find((generation) => isVideoInProgress(generation)) ?? generations[0];

      if (active) {
        applyGenerationState(active);
      }
    } finally {
      setIsLoadingVideoGenerations(false);
    }
  }

  async function refreshVideoGeneration(generationId: string, options?: { poll?: boolean }) {
    setIsRefreshingVideoStatus(true);
    setVideoError(null);

    try {
      if (options?.poll) {
        setIsGeneratingVideo(true);
        await pollVideoGeneration(generationId);
        return;
      }

      const response = await fetch(`/api/argil/videos/${generationId}`);
      const payload = await parseJsonOrText<{ generation?: AvatarVideoGeneration }>(response);

      if (!response.ok || !payload.generation) {
        throw new Error("Nao foi possivel consultar o status do video.");
      }

      applyGenerationState(payload.generation);
      upsertVideoGeneration(payload.generation);

      if (payload.generation.status === "FAILED") {
        setVideoError(
          payload.generation.errorMessage || "A geracao do video falhou na Argil.",
        );
      }
    } catch (error) {
      setVideoError(
        error instanceof Error ? error.message : "Nao foi possivel consultar o status do video.",
      );
    } finally {
      setIsRefreshingVideoStatus(false);
      setIsGeneratingVideo(false);
    }
  }

  useEffect(() => {
    autoPollStartedRef.current = false;
    void loadVideoGenerations();
  }, [assetReferenceId]);

  useEffect(() => {
    if (autoPollStartedRef.current || isGeneratingVideo) {
      return;
    }

    const inProgress = videoGenerations.find((generation) => isVideoInProgress(generation));
    if (!inProgress) {
      return;
    }

    autoPollStartedRef.current = true;
    setIsGeneratingVideo(true);
    void pollVideoGeneration(inProgress.id).finally(() => {
      setIsGeneratingVideo(false);
    });
  }, [videoGenerations, isGeneratingVideo]);

  async function pollVideoGeneration(generationId: string) {
    const pollIntervalMs = 5000;
    const maxAttempts = 180;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const response = await fetch(`/api/argil/videos/${generationId}`);
      const payload = await parseJsonOrText<{
        generation?: AvatarVideoGeneration;
        message?: string;
      }>(response);

      if (!response.ok) {
        throw new Error(payload.message || "Nao foi possivel consultar o status do video.");
      }

      const generation = payload.generation;
      if (generation) {
        applyGenerationState(generation);
        upsertVideoGeneration(generation);
      }

      if (generation?.status === "FAILED") {
        throw new Error("A geracao do video falhou na Argil.");
      }

      if (isVideoReady(generation)) {
        return generation;
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(
      "O lip-sync ainda esta em processamento na Argil (pode levar 5 a 15 min). " +
        "Atualize a pagina em alguns minutos ou confira o painel da Argil.",
    );
  }

  async function handleGenerateAvatar() {
    setVideoError(null);
    setVideoStatus(null);
    setVideoPreviewUrl(null);
    setVideoUrl(null);
    setVideoGenerationId(null);
    setIsGeneratingVideo(true);

    try {
      const topic = profileForm.avatarVideoTopic.trim();
      if (!topic) {
        throw new Error("Informe o tema do video antes de gerar.");
      }

      void saveProfile({ allowDraftDefaults: true });

      const response = await fetch("/api/argil/videos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic,
          profileId: profile?.id ?? profileForm.id ?? null,
          name: `Avatar - ${profileForm.fullName || "Politico"} - ${topic}`,
        }),
      });

      const payload = await parseJsonOrText<{
        dryRun?: boolean;
        generation?: AvatarVideoGeneration;
        message?: string;
      }>(response);

      if (!response.ok) {
        throw new Error(payload.message || "Nao foi possivel gerar o video.");
      }

      const generationId = payload.generation?.id;
      if (!generationId) {
        throw new Error("Resposta invalida: geracao sem id.");
      }

      if (payload.generation) {
        applyGenerationState(payload.generation);
        upsertVideoGeneration(payload.generation);
      } else {
        setVideoGenerationId(generationId);
        setVideoStatus(payload.dryRun ? "DRY_RUN" : "IDLE");
      }

      await pollVideoGeneration(generationId);
      await loadVideoGenerations();
    } catch (error) {
      setVideoError(error instanceof Error ? error.message : "Falha ao gerar o video.");
    } finally {
      setIsGeneratingVideo(false);
    }
  }

  function handleAvatarImageFileChange(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    setAvatarImageToCrop(files[0]);
  }

  async function handleVoiceAudioFileChange(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    await uploadTrainingAssets([files[0]], "voice_audio");
  }

  const readyToTrain = avatarImageAssets.length >= 1 && voiceAudioAssets.length >= 1;

  return (
    <>
      {avatarImageToCrop && (
        <AvatarImageCropModal
          file={avatarImageToCrop}
          onCancel={() => setAvatarImageToCrop(null)}
          onConfirm={async (croppedFile) => {
            setAvatarImageToCrop(null);
            await uploadTrainingAssets([croppedFile], "avatar_image");
          }}
        />
      )}

    <section className="persona-page">
      <div className="persona-container">
        <div className="persona-card">
          <h2 className="sr-only">Onboarding do parlamentar</h2>

          <div className="persona-section-header">
            <div className="persona-header-icon" aria-hidden="true">
              UC
            </div>
            <h2>Calibragem de Persona</h2>
            <p>
              O Agente Curador usa estes dados para garantir que os roteiros tenham a
              sua cara.
            </p>
          </div>

          <div className="persona-form-group">
            <label className="persona-label">
              Materiais para o clone <span className="persona-badge">Obrigatorio</span>
            </label>

            <div className="persona-upload-files">
              <span className="persona-file-chip">
                1) Audio de voz: {voiceAudioAssets.length ? "enviado" : "pendente"}
              </span>
              <span className="persona-file-chip">
                2) Foto para clone: {avatarImageAssets.length ? "enviada" : "pendente"}
              </span>
            </div>

            <label
              htmlFor={`${uploadInputId}-voice-audio`}
              className={`upload-area persona-upload-area ${isUploadingVoiceAudioAsset ? "persona-upload-area-loading" : ""}`}
            >
              <h4>1) Enviar audio de voz (obrigatorio)</h4>
              <p>
                Grave 30 segundos a 4 minutos da sua voz, falando de forma natural (MP3, WAV ou
                M4A). Usamos para clonar o timbre na Argil.
              </p>
              <input
                id={`${uploadInputId}-voice-audio`}
                type="file"
                accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,.mp3,.wav,.m4a"
                hidden
                data-testid="training-voice-audio-input"
                onChange={(event) => {
                  void handleVoiceAudioFileChange(event.target.files);
                  event.target.value = "";
                }}
              />
              <span className="persona-btn">
                {isUploadingVoiceAudioAsset ? (
                  <span className="persona-loading-row">
                    <span className="persona-spinner" aria-hidden="true" />
                    Enviando...
                  </span>
                ) : voiceAudioAssets.length ? (
                  "Substituir audio"
                ) : (
                  "Selecionar audio"
                )}
              </span>
              {isUploadingVoiceAudioAsset && <div className="persona-progress" />}
            </label>

            <label
              htmlFor={`${uploadInputId}-avatar-image`}
              className={`upload-area persona-upload-area ${isUploadingAvatarImageAsset ? "persona-upload-area-loading" : ""}`}
            >
              <h4>2) Enviar foto para clone (obrigatorio)</h4>
              <p>
                Foto do rosto (PNG ou JPEG), bem iluminada. Voce ajusta o recorte na tela (9:16 ou
                16:9) para nao cortar o rosto.
              </p>
              <input
                id={`${uploadInputId}-avatar-image`}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                data-testid="training-avatar-image-input"
                onChange={(event) => {
                  void handleAvatarImageFileChange(event.target.files);
                  event.target.value = "";
                }}
              />
              <span className="persona-btn">
                {isUploadingAvatarImageAsset ? (
                  <span className="persona-loading-row">
                    <span className="persona-spinner" aria-hidden="true" />
                    Enviando...
                  </span>
                ) : avatarImageAssets.length ? (
                  "Substituir foto"
                ) : (
                  "Selecionar foto"
                )}
              </span>
              {isUploadingAvatarImageAsset && <div className="persona-progress" />}
            </label>

            {legacyDatasetAssets.length > 0 && !avatarImageAssets.length && (
              <p className="persona-helper-text persona-helper-highlight">
                Voce enviou um video de treino antigo. A API da Argil passou a exigir{" "}
                <strong>foto (IMAGE)</strong>. Envie a foto acima e treine novamente.
              </p>
            )}

            <p className="persona-helper-text">
              Dica: audio sem ruido de fundo; foto em boa luz com rosto centralizado (16:9 ou
              9:16).
            </p>
            {!readyToTrain && (avatarImageAssets.length > 0 || voiceAudioAssets.length > 0) && (
              <p className="persona-helper-text persona-helper-highlight">
                Para habilitar o treinamento, envie <strong>1 audio de voz</strong> e{" "}
                <strong>1 foto para clone</strong>.
              </p>
            )}
          </div>

          <div className="persona-cta-block">
            <div className="persona-cta-row">
              <button
                type="button"
                className="persona-btn"
                data-testid="train-avatar-button"
                onClick={() => void handleTrainIa()}
                disabled={isSavingProfile || isTrainingAvatar || !readyToTrain}
              >
                {isTrainingAvatar ? (
                  <span className="persona-loading-row">
                    <span className="persona-spinner" aria-hidden="true" />
                    Treinando...
                  </span>
                ) : (
                  "Treinar a IA"
                )}
              </button>
            </div>
            <p className="persona-helper-text">
              Enquanto treinamos, voce pode preencher o restante do formulario (salvamos
              automaticamente). Tempo aproximado: 2 a 5 minutos.
            </p>
            {(trainingRequested || avatarTrainingStatus) && (
              <div
                className="persona-helper-text persona-helper-highlight"
                data-testid="argil-avatar-training-panel"
              >
                <p data-testid="argil-avatar-training-status">
                  Status do treinamento: {avatarTrainingStatus ?? "TRAINING"}
                </p>
                {isTrainingAvatar && <div className="persona-progress" />}
                {profileForm.argilAvatarId && (
                  <p>Avatar Argil: {profileForm.argilAvatarId}</p>
                )}
                {avatarTrainingInfo && (
                  <p className="persona-helper-text persona-helper-highlight">
                    {avatarTrainingInfo}
                  </p>
                )}
                {avatarTrainingError && (
                  <p className="persona-helper-text persona-helper-highlight">
                    {avatarTrainingError}
                  </p>
                )}
              </div>
            )}
            {trainingRequested && !avatarTrainingStatus && !avatarTrainingError && (
              <p className="persona-helper-text persona-helper-highlight">
                Dica: em ambiente de testes (dry-run), o treino e simulado e nao consome
                creditos.
              </p>
            )}
          </div>

          <hr className="persona-divider" />

          <div className="persona-form-group">
            <label className="persona-label">
              Posicionamento ideologico <span className="persona-badge">Obrigatorio</span>
            </label>
            <p className="persona-helper-text">
              O posicionamento ideologico compoe a base da resposta que a IA vai gerar
              sobre o tema.
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
              Inclua caracteristicas fundamentais da sua expressao, como por exemplo:
              ne, tipo, entendeu, sabe, ta, ok, certo, mano, assim.
            </p>
            <textarea
              className="persona-input-control"
              value={profileForm.glossaryTerms}
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
                  active={profileForm.personaArchetypes.includes(option)}
                  onClick={() =>
                    setProfileForm((current) => {
                      const personaArchetypes = toggleValue(current.personaArchetypes, option);
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
              A nao selecao de algum arquetipo nao traz prejuizo para sua identidade
              comunicacional, previamente mapeada pelos videos encaminhados.
            </p>
          </div>

          <div className="persona-form-group">
            <label className="persona-label">Tom de linguagem</label>
            <div className="persona-tag-list">
              {voiceToneOptions.map((tone) => (
                <PersonaTag
                  key={tone}
                  active={profileForm.voiceTones.includes(tone)}
                  onClick={() =>
                    setProfileForm((current) => ({
                      ...current,
                      voiceTones: toggleValue(current.voiceTones, tone),
                    }))
                  }
                >
                  {tone}
                </PersonaTag>
              ))}
            </div>
            <p className="persona-helper-text persona-top-gap">
              A nao selecao de algum modificador de tom nao traz prejuizo para sua
              identidade comunicacional, previamente mapeada pelos videos encaminhados.
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
              Tema do video <span className="persona-badge">Obrigatorio</span>
            </label>
            <input
              type="text"
              className="persona-input-control"
              value={profileForm.avatarVideoTopic}
              onChange={(event) =>
                setProfileForm((current) => ({
                  ...current,
                  avatarVideoTopic: event.target.value,
                }))
              }
              placeholder="Digite o tema do video..."
              data-testid="avatar-video-topic"
            />
          </div>

          <div className="persona-form-group">
            <label className="persona-label">
              Seu e-mail <span className="persona-badge">Obrigatorio</span>
            </label>
            <input
              type="email"
              className="persona-input-control"
              value={profileForm.notificationEmail}
              onChange={(event) =>
                setProfileForm((current) => ({
                  ...current,
                  notificationEmail: event.target.value,
                }))
              }
              placeholder="Digite seu e-mail..."
            />
            <p className="persona-helper-text persona-top-gap">
              Usaremos este e-mail para avisar quando o treinamento terminar (e, no futuro,
              para enviar o link do video final).
            </p>
          </div>

          <div className="persona-generate-row">
            <button
              type="button"
              className="persona-btn persona-btn-large"
              onClick={() => void handleGenerateAvatar()}
              disabled={isSavingProfile || isGeneratingVideo}
              data-testid="generate-avatar-video-button"
            >
              {isGeneratingVideo
                ? "Gerando video (lip-sync)..."
                : isSavingProfile
                  ? "Salvando..."
                  : "Gerar meu avatar"}
            </button>
            <p className="persona-helper-text persona-top-gap">
              A Argil primeiro mostra uma pre-visualizacao estatica; o video com lip-sync leva em
              media <strong>5 a 15 minutos</strong>. Voce pode sair e voltar depois — o status fica
              salvo na lista abaixo.
            </p>
          </div>

          {(videoGenerations.length > 0 || isLoadingVideoGenerations) && (
            <div className="persona-form-group" data-testid="argil-video-history">
              <label className="persona-label">Videos gerados</label>
              {isLoadingVideoGenerations ? (
                <p className="persona-helper-text">Carregando historico...</p>
              ) : (
                <ul className="persona-video-history-list">
                  {videoGenerations.map((generation) => {
                    const isSelected = videoGenerationId === generation.id;
                    const ready = isVideoReady(generation);

                    return (
                      <li
                        key={generation.id}
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
                            setVideoError(null);
                            applyGenerationState(generation);
                          }}
                        >
                          <strong>{generation.topic || "Sem tema"}</strong>
                          <span>{formatVideoCreatedAt(generation.createdAt)}</span>
                          <span data-testid={`argil-video-history-status-${generation.id}`}>
                            {formatVideoStatusLabel(generation.status)}
                            {ready ? " — pronto" : ""}
                          </span>
                        </button>
                        <button
                          type="button"
                          className="persona-btn"
                          disabled={isRefreshingVideoStatus || isGeneratingVideo}
                          onClick={() =>
                            void refreshVideoGeneration(
                              generation.id,
                              isVideoInProgress(generation) ? { poll: true } : undefined,
                            )
                          }
                          data-testid={`argil-video-refresh-${generation.id}`}
                        >
                          {isVideoInProgress(generation) ? "Acompanhar" : "Atualizar"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {(videoStatus ||
            videoError ||
            videoPreviewUrl ||
            videoUrl ||
            videoGenerationId ||
            isRefreshingVideoStatus) && (
            <div
              className="persona-form-group persona-support-block"
              data-testid="argil-video-generation-panel"
            >
              <label className="persona-label">Geracao do video (Argil)</label>
              {videoError ? (
                <p
                  className="persona-helper-text persona-helper-highlight"
                  data-testid="argil-video-error"
                >
                  {videoError}
                </p>
              ) : (
                <>
                  {videoStatus && (
                    <p className="persona-helper-text" data-testid="argil-video-status">
                      Status: {formatVideoStatusLabel(videoStatus)}
                    </p>
                  )}
                  {(isGeneratingVideo || isRefreshingVideoStatus) && (
                    <div className="persona-progress" />
                  )}
                  {videoGenerationId && (
                    <p className="persona-helper-text" data-testid="argil-video-generation-id">
                      Job: {videoGenerationId}
                    </p>
                  )}
                  {videoPreviewUrl && !isVideoReady({ status: videoStatus ?? "", videoUrl }) && (
                    <p className="persona-helper-text persona-helper-highlight">
                      Pre-visualizacao (rosto parado, sem lip-sync ainda):{" "}
                      <a href={videoPreviewUrl} data-testid="argil-video-preview-link">
                        abrir preview
                      </a>
                    </p>
                  )}
                  {isVideoReady({ status: videoStatus ?? "", videoUrl }) && videoUrl && (
                    <>
                      <p className="persona-helper-text">
                        Video final com lip-sync:{" "}
                        <a href={videoUrl} data-testid="argil-video-final-link">
                          abrir
                        </a>
                      </p>
                      <video
                        className="persona-video-player"
                        src={videoUrl}
                        controls
                        playsInline
                        data-testid="argil-video-player"
                      />
                      <p className="persona-helper-text persona-top-gap">
                        <a
                          className="persona-btn"
                          href={videoUrl}
                          download={`avatar-${(profileForm.fullName || "politico").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${(profileForm.avatarVideoTopic || "tema").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.mp4`}
                          data-testid="argil-video-download-link"
                        >
                          Baixar video
                        </a>
                      </p>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          <div className="persona-form-group">
            <label className="persona-label">Observacoes importantes:</label>
            <p className="persona-helper-text">
              Com foco na geracao de conteudo viral, a IA pode nao utilizar
              arquetipos da persona politica e ou tom de linguagem. O paradoxo das
              restricoes reduz a viralidade do video. Imagine o cenario: arquetipo
              estadista conciliador com tom indignado e tema corrupcao. O agente tenta
              equilibrar posturas conflitantes, e o resultado pode ficar inconsistente.
            </p>
          </div>
        </div>
      </div>
    </section>
    </>
  );
}
