"use client";

import { useEffect, useId, useMemo, useState } from "react";

import {
  archetypeOptions,
  avatarTypeOptions,
  spectrumOptions,
  voiceToneOptions,
} from "@/lib/constants";

import { useProductApp } from "./provider";

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
  const [videoGenerationId, setVideoGenerationId] = useState<string | null>(null);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoStatus, setVideoStatus] = useState<string | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
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
      void saveProfile();
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
    setAvatarTrainingStatus(null);
    setIsTrainingAvatar(true);

    try {
      void saveProfile();

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
        training?: { id?: string; status?: string };
        message?: string;
      }>(response);

      if (!response.ok) {
        throw new Error(payload.message || "Nao foi possivel iniciar o treinamento.");
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

  async function pollVideoGeneration(generationId: string) {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const response = await fetch(`/api/argil/videos/${generationId}`);
      const payload = await parseJsonOrText<{
        generation?: {
          status?: string;
          previewUrl?: string;
          videoUrl?: string;
          dryRun?: boolean;
        };
        message?: string;
      }>(response);

      if (!response.ok) {
        throw new Error(payload.message || "Nao foi possivel consultar o status do video.");
      }

      const generation = payload.generation;
      setVideoStatus(generation?.status ?? null);
      setVideoPreviewUrl(generation?.previewUrl || null);
      setVideoUrl(generation?.videoUrl || null);

      if (generation?.status === "DONE" || generation?.status === "FAILED") {
        return generation;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return null;
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

      void saveProfile();

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
        generation?: {
          id: string;
          status?: string;
          previewUrl?: string;
          videoUrl?: string;
        };
        message?: string;
      }>(response);

      if (!response.ok) {
        throw new Error(payload.message || "Nao foi possivel gerar o video.");
      }

      const generationId = payload.generation?.id;
      if (!generationId) {
        throw new Error("Resposta invalida: geracao sem id.");
      }

      setVideoGenerationId(generationId);
      setVideoStatus(payload.generation?.status ?? (payload.dryRun ? "DRY_RUN" : "IDLE"));
      setVideoPreviewUrl(payload.generation?.previewUrl ?? null);
      setVideoUrl(payload.generation?.videoUrl ?? null);

      await pollVideoGeneration(generationId);
    } catch (error) {
      setVideoError(error instanceof Error ? error.message : "Falha ao gerar o video.");
    } finally {
      setIsGeneratingVideo(false);
    }
  }

  async function handleAvatarImageFileChange(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    await uploadTrainingAssets([files[0]], "avatar_image");
  }

  async function handleVoiceAudioFileChange(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    await uploadTrainingAssets([files[0]], "voice_audio");
  }

  const readyToTrain = avatarImageAssets.length >= 1 && voiceAudioAssets.length >= 1;

  return (
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
                Foto do rosto (PNG ou JPEG), bem iluminada. A Argil exige proporcao{" "}
                <strong>9:16</strong> (retrato) ou <strong>16:9</strong> (paisagem); se a sua foto
                for 3:4 ou outra, recortamos automaticamente ao enviar.
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
                {avatarTrainingError && <p>{avatarTrainingError}</p>}
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
                ? "Gerando video..."
                : isSavingProfile
                  ? "Salvando..."
                  : "Gerar meu avatar"}
            </button>
          </div>

          {(videoStatus || videoError || videoPreviewUrl || videoUrl || videoGenerationId) && (
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
                      Status: {videoStatus}
                    </p>
                  )}
                  {isGeneratingVideo && <div className="persona-progress" />}
                  {videoGenerationId && (
                    <p className="persona-helper-text" data-testid="argil-video-generation-id">
                      Job: {videoGenerationId}
                    </p>
                  )}
                  {videoPreviewUrl && (
                    <p className="persona-helper-text">
                      Preview:{" "}
                      <a href={videoPreviewUrl} data-testid="argil-video-preview-link">
                        abrir
                      </a>
                    </p>
                  )}
                  {videoUrl && (
                    <p className="persona-helper-text">
                      Video final:{" "}
                      <a href={videoUrl} data-testid="argil-video-final-link">
                        abrir
                      </a>
                    </p>
                  )}
                  {videoUrl && (
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
  );
}
