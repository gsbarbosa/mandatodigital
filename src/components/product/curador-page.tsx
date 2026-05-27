"use client";

import { useId, useMemo, useState } from "react";

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
    isUploadingTrainingAssets,
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

  const datasetAssets = useMemo(
    () => visibleTrainingAssets.filter((asset) => asset.trainingRole === "dataset"),
    [visibleTrainingAssets],
  );
  const consentAssets = useMemo(
    () => visibleTrainingAssets.filter((asset) => asset.trainingRole === "consent"),
    [visibleTrainingAssets],
  );
  const orderedDatasetAssets = useMemo(() => {
    return [...datasetAssets].sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));
  }, [datasetAssets]);

  async function pollAvatarTraining(trainingId: string) {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const response = await fetch(
        `/api/argil/avatars/train?trainingId=${encodeURIComponent(trainingId)}`,
      );
      const payload = (await response.json()) as {
        training?: {
          status?: string;
          argilAvatarId?: string | null;
          argilVoiceId?: string | null;
          errorMessage?: string;
        };
        message?: string;
      };

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

      const payload = (await response.json()) as {
        training?: { id?: string; status?: string };
        message?: string;
      };

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
      const payload = (await response.json()) as {
        generation?: {
          status?: string;
          previewUrl?: string;
          videoUrl?: string;
          dryRun?: boolean;
        };
        message?: string;
      };

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

      const payload = (await response.json()) as {
        dryRun?: boolean;
        generation?: {
          id: string;
          status?: string;
          previewUrl?: string;
          videoUrl?: string;
        };
        message?: string;
      };

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

  async function handleTrainingFileChange(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    await uploadTrainingAssets(Array.from(files), "dataset");
  }

  async function handleTrainingSlotFileChange(file: File | null) {
    if (!file) {
      return;
    }

    await uploadTrainingAssets([file], "dataset");
  }

  async function handleConsentFileChange(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    await uploadTrainingAssets([files[0]], "consent");
  }

  const readyToTrain = datasetAssets.length >= 2 && consentAssets.length >= 1;
  const canAddMoreTraining = datasetAssets.length < 5;
  const trainingSlots = [
    { label: "Video 1 (obrigatorio)", required: true },
    { label: "Video 2 (obrigatorio)", required: true },
    { label: "Video 3 (opcional)", required: false },
    { label: "Video 4 (opcional)", required: false },
    { label: "Video 5 (opcional)", required: false },
  ] as const;

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
              Upload de videos <span className="persona-badge">Obrigatorio</span>
            </label>

            <div className="persona-upload-files">
              <span className="persona-file-chip">
                1) Video de autorizacao: {consentAssets.length ? "enviado" : "pendente"}
              </span>
              <span className="persona-file-chip">
                2) Videos de treinamento: {datasetAssets.length} / 2 obrigatorios (ate 5)
              </span>
            </div>

            <label
              htmlFor={`${uploadInputId}-consent`}
              className={`upload-area persona-upload-area ${isUploadingTrainingAssets ? "persona-upload-area-loading" : ""}`}
            >
              <h4>1) Enviar video de autorizacao (obrigatorio)</h4>
              <p>Ate 30s, dizendo que autoriza o uso do video para treinar o avatar.</p>
              <input
                id={`${uploadInputId}-consent`}
                type="file"
                accept="video/*"
                hidden
                data-testid="training-consent-input"
                onChange={(event) => {
                  void handleConsentFileChange(event.target.files);
                  event.target.value = "";
                }}
              />
              <span className="persona-btn">
                {isUploadingTrainingAssets ? (
                  <span className="persona-loading-row">
                    <span className="persona-spinner" aria-hidden="true" />
                    Enviando...
                  </span>
                ) : consentAssets.length ? (
                  "Substituir video"
                ) : (
                  "Selecionar video"
                )}
              </span>
              {isUploadingTrainingAssets && <div className="persona-progress" />}
            </label>

            <label
              htmlFor={`${uploadInputId}-dataset`}
              className={`upload-area persona-upload-area ${isUploadingTrainingAssets ? "persona-upload-area-loading" : ""}`}
            >
              <h4>
                2) Enviar videos de treinamento{" "}
                <span className="persona-badge">Minimo 2</span>
              </h4>
              <p>
                Ideal: 3+ min, frente para a camera, audio claro. Voce pode enviar ate{" "}
                <strong>5</strong> no total.
              </p>
              <div className="persona-upload-slot-list">
                {trainingSlots.map((slot, index) => {
                  const asset = orderedDatasetAssets[index] ?? null;
                  const slotId = `${uploadInputId}-dataset-slot-${index + 1}`;
                  const isFilled = Boolean(asset);
                  const isDisabled =
                    isUploadingTrainingAssets ||
                    (!isFilled && !canAddMoreTraining) ||
                    (slot.required && index > 0 && !orderedDatasetAssets[index - 1]);

                  const statusLabel = asset
                    ? "Enviado"
                    : slot.required
                      ? "Obrigatorio"
                      : "Opcional";
                  const statusVariant = asset ? "ok" : slot.required ? "warn" : "";

                  return (
                    <div key={slot.label} className="persona-upload-slot">
                      <div className="persona-upload-slot-main">
                        <div className="persona-upload-slot-title">{slot.label}</div>
                        <div className="persona-upload-slot-meta">
                          <span
                            className={`persona-upload-slot-badge ${statusVariant}`}
                            aria-label={`Status: ${statusLabel}`}
                          >
                            {statusLabel}
                          </span>
                          {asset ? (
                            <span
                              className="persona-upload-slot-filename"
                              title={asset.originalFilename}
                            >
                              {asset.originalFilename}
                            </span>
                          ) : (
                            <span className="persona-upload-slot-filename">
                              {slot.required
                                ? "Envie este video para liberar o treinamento."
                                : "Opcional (melhora a qualidade)."}
                            </span>
                          )}
                        </div>
                      </div>

                      {!isFilled && (
                        <>
                          <input
                            id={slotId}
                            type="file"
                            accept="video/*"
                            hidden
                            data-testid={`training-dataset-slot-${index + 1}-input`}
                            onChange={(event) => {
                              void handleTrainingSlotFileChange(event.target.files?.[0] ?? null);
                              event.target.value = "";
                            }}
                            disabled={isDisabled}
                          />
                          <label
                            htmlFor={slotId}
                            className="persona-btn persona-btn-compact"
                            aria-disabled={isDisabled}
                          >
                            {isUploadingTrainingAssets ? (
                              <span className="persona-loading-row">
                                <span className="persona-spinner" aria-hidden="true" />
                                Enviando...
                              </span>
                            ) : (
                              "Selecionar"
                            )}
                          </label>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
              {isUploadingTrainingAssets && <div className="persona-progress" />}
            </label>

            {datasetAssets.length > 0 && (
              <div className="persona-upload-files">
                {datasetAssets.map((asset) => (
                  <span key={asset.id} className="persona-file-chip">
                    {asset.originalFilename} - {asset.status}
                  </span>
                ))}
              </div>
            )}

            <p className="persona-helper-text">
              Dica: se o upload ficar pesado, grave em boa luz, celular na vertical e
              evite ruido.
            </p>
            {!readyToTrain && (datasetAssets.length > 0 || consentAssets.length > 0) && (
              <p className="persona-helper-text persona-helper-highlight">
                Para habilitar o treinamento, envie <strong>1 video de autorizacao</strong> e{" "}
                <strong>2 videos de treinamento</strong>.
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
              Enquanto treinamos, voce pode preencher o restante do formulario.
              Tempo aproximado: 5 minutos.
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
