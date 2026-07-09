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
  CaricatureAssetPreview,
  IdeologicalSpectrumSlider,
  MaterialUploadField,
  BaseMaterialsReadiness,
  PersonaHeaderIcon,
  PHOTO_REAL_VARIANT_HINT,
  PHOTO_REAL_VARIANT_LABEL,
  PhotoAvatarVariantRow,
  parseJsonOrText,
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
import type { CaricatureVariant } from "@/lib/openai-caricature-prompts";
import type { ProfileTrainingAsset } from "@/lib/types";

export function CuradorPageV2() {
  const router = useRouter();
  const uploadInputId = useId();
  const [heygenAvatarId, setHeygenAvatarId] = useState<string>("");
  const [heygenAvatarGroupId, setHeygenAvatarGroupId] = useState<string>("");
  const [heygenVoiceId, setHeygenVoiceId] = useState<string>("");
  const [productionSource, setProductionSource] = useState<"train_new" | "use_existing">(
    "train_new",
  );
  const restoredHeygenPrefsRef = useRef(false);
  const [isGeneratingCaricature, setIsGeneratingCaricature] = useState(false);
  const [caricatureGenerateStep, setCaricatureGenerateStep] = useState<
    "idle" | "editorial" | "mascot_3d"
  >("idle");
  const [caricatureError, setCaricatureError] = useState<string | null>(null);
  const [caricatureInfo, setCaricatureInfo] = useState<string | null>(null);
  const [isDeletingTwinGroup, setIsDeletingTwinGroup] = useState(false);
  const [caricatureRefazerError, setCaricatureRefazerError] = useState<string | null>(null);
  const [caricatureRefazerInfo, setCaricatureRefazerInfo] = useState<string | null>(null);
  const [caricaturePreviewOpen, setCaricaturePreviewOpen] = useState(false);
  const [materialUploadErrors, setMaterialUploadErrors] = useState<
    Partial<Record<"voice_audio" | "avatar_image", string | null>>
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

  const formatBytes = useCallback((bytes: number) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return "";
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(1)} MB`;
  }, []);

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

  function persistHeygenPrefs(overrides?: {
    heygenAvatarId?: string;
    heygenVoiceId?: string;
    heygenVoiceAudioAssetId?: string;
    heygenAvatarGroupId?: string;
    lastCaricatureAssetId?: string;
    avatarTrack?: "photo_real" | "caricature" | "realistic";
    productionSource?: "train_new" | "use_existing";
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
      avatarTrack: overrides?.avatarTrack ?? "photo_real",
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
    return `Nao foi possivel gerar a caricatura (${response.status}).`;
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
      throw new Error("Resposta invalida: caricatura sem identificador.");
    }

    return {
      assetId,
      previewUrl: payload.previewUrl?.trim() || null,
    };
  }

  async function handleGenerateCaricatureVariant(variant: CaricatureVariant) {
    if (!canGenerateCaricature || isGeneratingCaricature) {
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
        "As outras variantes não serão apagadas.",
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
          disabled={isDeletingTwinGroup || isGeneratingCaricature}
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
          disabled={!canGenerateCaricature || isGeneratingCaricature}
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

        {hasAnyCaricatureReady ? (
          <div className="persona-prepare-ready-actions persona-top-gap">
            <button
              type="button"
              className="persona-btn persona-btn-secondary persona-btn-compact"
              onClick={() => setCaricaturePreviewOpen((open) => !open)}
              aria-expanded={caricaturePreviewOpen}
              aria-controls="caricature-prepare-preview-panel"
            >
              {caricaturePreviewOpen ? "Ocultar preview" : "Ver preview"}
            </button>
          </div>
        ) : null}

        {caricaturePreviewOpen && hasAnyCaricatureReady ? (
          <div
            id="caricature-prepare-preview-panel"
            className="persona-prepare-twin-preview persona-prepare-caricature-preview persona-top-gap"
            aria-label="Preview das caricaturas"
          >
            {editorialCaricature ? (
              <figure className="persona-prepare-caricature-preview-item">
                <CaricatureAssetPreview assetId={editorialCaricature.id} />
                <figcaption>{caricatureVariantLabel("editorial")}</figcaption>
              </figure>
            ) : null}
            {mascotCaricature ? (
              <figure className="persona-prepare-caricature-preview-item">
                <CaricatureAssetPreview assetId={mascotCaricature.id} />
                <figcaption>{caricatureVariantLabel("mascot_3d")}</figcaption>
              </figure>
            ) : null}
          </div>
        ) : null}
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

  function renderPrepareAvatarsSection() {
    return (
      <div className="persona-prepare-generation-stack">
        {renderPhotoAvatarsPrepareBlock()}
      </div>
    );
  }


  const selectedAvatarImage = avatarImageAssets[0] ?? null;
  const selectedVoiceAudio = voiceAudioAssets[0] ?? null;

  useEffect(() => {
    if (!profileIdForPrefs || restoredHeygenPrefsRef.current) {
      return;
    }
    restoredHeygenPrefsRef.current = true;
    const prefs = readCuradorHeygenPrefs(profileIdForPrefs);
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
    if (prefs.heygenAvatarId) {
      setHeygenAvatarId(prefs.heygenAvatarId);
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
    trainingRole: "voice_audio" | "avatar_image",
    file: File,
  ) {
    setMaterialUploadErrors((current) => ({ ...current, [trainingRole]: null }));

    try {
      await uploadTrainingAssets([file], trainingRole, { reportError: "throw" });
    } catch (error) {
      setMaterialUploadErrors((current) => ({
        ...current,
        [trainingRole]:
          error instanceof Error
            ? error.message
            : "Nao foi possivel enviar o arquivo.",
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
            <h2>Calibragem de Persona</h2>
          </div>

          <div className="persona-form-group">
            <label className="persona-label">Materiais base</label>
            <p className="persona-helper-text">
              Comece pelo áudio e depois envie a foto do rosto. Com esses dois materiais você gera
              vídeos nos modelos Foto Real, Caricato e 3D.
            </p>
            <BaseMaterialsReadiness
              hasVoice={Boolean(selectedVoiceAudio)}
              hasPhoto={Boolean(selectedAvatarImage)}
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
          </div>

          {renderPrepareAvatarsSection()}

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
        </div>
      </div>
    </section>
  );
}

