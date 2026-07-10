"use client";

import Link from "next/link";
import type { Route } from "next";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";

import { parseTextarea } from "@/components/product/shared";
import {
  SPECTRUM_DEFAULT,
  indexToSpectrum,
  spectrumOptions,
  spectrumToIndex,
} from "@/lib/constants";
import { caricatureVariantLabel } from "@/lib/caricature-asset-variant";
import {
  formatTwinLookCaption,
  formatTwinLookDisplayName,
  type AvatarTrainingNameInput,
} from "@/lib/heygen-twin-display";
import type { CaricatureVariant } from "@/lib/openai-caricature-prompts";
import type { ProfileTrainingAsset } from "@/lib/types";
import type { TwinLookDisplayMeta } from "@/lib/heygen-twin-display";

export const MAX_SCRIPT_WORDS = 140;

export const AVATAR_TYPE_BY_TRACK = {
  realistic: "Meu Gêmeo Digital",
  caricature: "Minha Caricatura",
  photo_real: "Meu Gêmeo Digital",
} as const;

export type AvatarTrack = "realistic" | "caricature" | "photo_real";
export type ProductionSource = "use_existing" | "train_new";
export type ProductionTemplate =
  | "digital_twin"
  | "photo_real"
  | "caricature_editorial"
  | "caricature_mascot_3d";

export const PHOTO_REAL_VARIANT_LABEL = "Gêmeo Digital";
export const PHOTO_REAL_VARIANT_HINT = "Sua foto com voz clonada";

export function productionTemplateLabel(template: ProductionTemplate) {
  switch (template) {
    case "digital_twin":
      return "Gêmeo Digital";
    case "photo_real":
      return PHOTO_REAL_VARIANT_LABEL;
    case "caricature_editorial":
      return "Caricato";
    case "caricature_mascot_3d":
      return "Mascote 3D";
  }
}

export function productionTemplateDescription(template: ProductionTemplate) {
  switch (template) {
    case "digital_twin":
      return "Clone falante a partir do vídeo de treino";
    case "photo_real":
      return PHOTO_REAL_VARIANT_HINT;
    case "caricature_editorial":
      return "Retrato ilustrado editorial";
    case "caricature_mascot_3d":
      return "Personagem mascote 3D";
  }
}

export function productionTemplateTier(template: ProductionTemplate) {
  switch (template) {
    case "digital_twin":
      return "Hiper-realista";
    case "photo_real":
      return "Realista";
    default:
      return "Ilustrado";
  }
}

export type PrivateTwinLook = TwinLookDisplayMeta & {
  preview_image_url?: string | null;
  preview_video_url?: string | null;
  supported_api_engines?: string[];
};

export function countWords(text: string) {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function uploadAreaButtonLabel(hasFile: boolean) {
  return hasFile ? "Substituir" : "Adicionar";
}

export function avatarTypeToTrack(value: string | undefined): AvatarTrack {
  if (value === "Minha Caricatura") {
    return "caricature";
  }
  if (value === "Minha Foto Real" || value === "Meu Gêmeo Digital") {
    return "photo_real";
  }
  return "photo_real";
}

export function formatStatus(status: string | null | undefined) {
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

export function selectSingleTagValue(values: string[] | undefined, value: string) {
  const current = values ?? [];
  return current.includes(value) ? [] : [value];
}

export function buildCuradorContextPayload(profileForm: {
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

export async function parseJsonOrText<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }
  return { message: await response.text() } as T;
}

export function PersonaTag({
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

export function IdeologicalSpectrumSlider({
  value,
  onChange,
}: {
  value: string;
  onChange: (spectrum: string) => void;
}) {
  const didDefaultRef = useRef(false);
  const spectrumIndex = spectrumToIndex(value);
  const currentLabel = indexToSpectrum(spectrumIndex);
  const isValidSpectrum = spectrumOptions.includes(
    value as (typeof spectrumOptions)[number],
  );

  useEffect(() => {
    if (didDefaultRef.current) {
      return;
    }
    if (!value.trim() || !isValidSpectrum) {
      didDefaultRef.current = true;
      onChange(SPECTRUM_DEFAULT);
    }
  }, [isValidSpectrum, onChange, value]);

  return (
    <div className="persona-spectrum-slider-wrap persona-top-gap">
      <div className="persona-spectrum-slider-axis">
        <span className="persona-spectrum-slider-end">Esquerda</span>
        <div className="persona-spectrum-slider-track-wrap">
          <div className="persona-spectrum-slider-ticks" aria-hidden="true">
            {spectrumOptions.map((option, index) => (
              <span
                key={option}
                className={index === spectrumIndex ? "is-active" : undefined}
              />
            ))}
          </div>
          <input
            type="range"
            className="persona-spectrum-slider-input"
            min={0}
            max={spectrumOptions.length - 1}
            step={1}
            value={spectrumIndex}
            onChange={(event) => onChange(indexToSpectrum(Number(event.target.value)))}
            aria-valuetext={currentLabel}
            aria-label="Posicionamento ideológico"
          />
        </div>
        <span className="persona-spectrum-slider-end">Direita</span>
        <p className="persona-spectrum-slider-value" aria-live="polite">
          {currentLabel}
        </p>
      </div>
    </div>
  );
}

export function PersonaHeaderIcon() {
  return (
    <svg viewBox="0 0 24 24" className="persona-header-icon-svg" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-3.31 0-6 1.79-6 4v1h12v-1c0-2.21-2.69-4-6-4Zm7.78-3.65-1.41-1.41L16 11.31l1.41 1.41 1.41-1.41 1.41 1.41 1.41-1.41-1.41-1.41 1.41-1.41Z"
      />
    </svg>
  );
}

export function PersonaCriativoIcon() {
  return (
    <svg viewBox="0 0 24 24" className="persona-header-icon-svg" aria-hidden="true">
      <path
        fill="currentColor"
        d="m19 3-1.5 1.5L16 3l-1.5 1.5L13 3l-1.5 1.5L10 3 8.5 4.5 7 3 5.5 4.5 4 3v18l1.5-1.5L7 21l1.5-1.5L10 21l1.5-1.5L13 21l1.5-1.5L16 21l1.5-1.5L19 21V3ZM11 17H8v-2h3v2Zm0-4H8v-2h3v2Zm0-4H8V7h3v2Zm5 8h-3v-2h3v2Zm0-4h-3v-2h3v2Zm0-4h-3V7h3v2Z"
      />
    </svg>
  );
}

export function PersonaSentinelaIcon() {
  return (
    <svg viewBox="0 0 24 24" className="persona-header-icon-svg" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2a7 7 0 0 0-7 7v1.1A5.9 5.9 0 0 0 3 15v2h18v-2a5.9 5.9 0 0 0-2-4.9V9a7 7 0 0 0-7-7Zm0 2a5 5 0 0 1 5 5v1.1c0 1.2.5 2.3 1.3 3.1L17 14H7l.7-2.8A4 4 0 0 0 8 10.1V9a5 5 0 0 1 5-5Zm-1 16h2v2h-2v-2Z"
      />
    </svg>
  );
}

export function PersonaAuditorIcon() {
  return (
    <svg viewBox="0 0 24 24" className="persona-header-icon-svg" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4Zm0 2.18 7 3.11v4.71c0 4.52-3.07 8.86-7 9.93-3.93-1.07-7-5.41-7-9.93V6.29l7-3.11Zm-1 5.32-3 3 1.41 1.41L11 11.41V17h2v-5.59l1.59 1.59 1.41-1.41-3-3a1 1 0 0 0-1.41 0Z"
      />
    </svg>
  );
}

export function PersonaDistribuidorIcon() {
  return (
    <svg viewBox="0 0 24 24" className="persona-header-icon-svg" aria-hidden="true">
      <path
        fill="currentColor"
        d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7a3.27 3.27 0 0 0 0-1.39l7.05-4.11A2.99 2.99 0 1 0 15 5a2.99 2.99 0 0 0 .04.49L7.99 9.6a3 3 0 1 0 0 4.8l7.05 4.11A2.99 2.99 0 1 0 18 22a2.99 2.99 0 0 0-.04-.49l7.01-4.11a3 3 0 1 0 0-1.39l-7.01-4.11A2.99 2.99 0 0 0 18 4a3 3 0 1 0 0 8Zm0 12a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm0-8.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2ZM6 14a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"
      />
    </svg>
  );
}

export function trainingAssetFileUrl(assetId: string) {
  return `/api/profile/training-assets/${encodeURIComponent(assetId)}/file`;
}

export function TrainingAssetMediaPreview({
  assetId,
  className = "persona-caricature-preview-image",
  preferVideo = false,
}: {
  assetId: string;
  className?: string;
  preferVideo?: boolean;
}) {
  const [mediaFailed, setMediaFailed] = useState(false);
  const normalizedAssetId = assetId.trim();
  const src = normalizedAssetId ? trainingAssetFileUrl(normalizedAssetId) : "";

  useEffect(() => {
    setMediaFailed(false);
  }, [normalizedAssetId]);

  if (!src || mediaFailed) {
    return <span className="persona-twin-preview-placeholder" />;
  }

  if (preferVideo) {
    return (
      <video
        src={src}
        className={className}
        muted
        playsInline
        loop
        autoPlay
        onError={() => setMediaFailed(true)}
      />
    );
  }

  return (
    <img
      src={src}
      alt=""
      className={className}
      onError={() => setMediaFailed(true)}
    />
  );
}

export function TwinLookMedia({
  look,
  className = "persona-caricature-preview-image",
  compact = false,
  preferVideo = false,
  profile,
  fallbackAssetId,
  fallbackPreferVideo = false,
}: {
  look: PrivateTwinLook;
  className?: string;
  compact?: boolean;
  preferVideo?: boolean;
  profile?: AvatarTrainingNameInput;
  fallbackAssetId?: string | null;
  fallbackPreferVideo?: boolean;
}) {
  const [mediaFailed, setMediaFailed] = useState(false);
  const caption = formatTwinLookCaption(look);
  const displayName = formatTwinLookDisplayName(look.name, profile);
  const imageUrl = look.preview_image_url?.trim();
  const videoUrl = look.preview_video_url?.trim();

  if (mediaFailed || (!imageUrl && !videoUrl)) {
    if (fallbackAssetId?.trim()) {
      return (
        <TrainingAssetMediaPreview
          assetId={fallbackAssetId.trim()}
          className={className}
          preferVideo={fallbackPreferVideo}
        />
      );
    }

    return (
      <div
        className={
          compact ? "persona-twin-look-meta compact" : "persona-twin-look-meta"
        }
      >
        <span className="persona-twin-look-meta-title">{displayName}</span>
        <span className="persona-twin-look-meta-date">{caption}</span>
      </div>
    );
  }

  if (preferVideo && videoUrl) {
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

export function CaricatureAssetPreview({ assetId }: { assetId: string }) {
  const [mediaFailed, setMediaFailed] = useState(false);
  const normalizedAssetId = assetId.trim();
  const src = normalizedAssetId ? trainingAssetFileUrl(normalizedAssetId) : "";

  useEffect(() => {
    setMediaFailed(false);
  }, [normalizedAssetId]);

  if (!src || mediaFailed) {
    return <span className="persona-twin-preview-placeholder" />;
  }

  return (
    <img
      src={src}
      alt=""
      className="persona-caricature-preview-image"
      onError={() => setMediaFailed(true)}
    />
  );
}

export function ProductionTemplateEmptyPreview({
  icon = "photo",
  message,
}: {
  icon?: "photo" | "video";
  message: string;
}) {
  return (
    <div className="persona-production-template-empty">
      <MaterialUploadIcon kind={icon} variant="inline" />
      <span>{message}</span>
    </div>
  );
}

export function ProductionTemplatePendingPreview({
  assetId,
  message,
}: {
  assetId: string;
  message: string;
}) {
  return (
    <div className="persona-production-template-pending">
      <TrainingAssetMediaPreview assetId={assetId} />
      <span className="persona-production-template-pending-label">{message}</span>
    </div>
  );
}

export function ProductionTemplateOption({
  label,
  description,
  tier,
  isSelected,
  isAvailable,
  unavailableHint,
  curadorHref = "/curador",
  onSelect,
  preview,
}: {
  label: string;
  description: string;
  tier: string;
  isSelected: boolean;
  isAvailable: boolean;
  unavailableHint?: string;
  curadorHref?: string;
  onSelect: () => void;
  preview: ReactNode;
}) {
  if (!isAvailable) {
    return (
      <div className="persona-production-template-card is-unavailable">
        <span className="persona-production-template-tier">{tier}</span>
        <div className="persona-production-template-thumb" aria-hidden="true">
          {preview}
        </div>
        <div className="persona-production-template-meta">
          <strong>{label}</strong>
          <span className="persona-production-template-description">{description}</span>
        </div>
        <Link
          href={curadorHref as Route}
          className="persona-production-template-curador-link"
        >
          {unavailableHint ?? "Configurar no Curador"}
          <span aria-hidden="true"> →</span>
        </Link>
      </div>
    );
  }

  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      className={[
        "persona-production-template-card",
        isSelected ? "is-selected" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onSelect}
    >
      <span className="persona-production-template-tier">{tier}</span>
      <div className="persona-production-template-thumb" aria-hidden="true">
        {preview}
        {isSelected ? (
          <span className="persona-production-template-active-badge">Ativo</span>
        ) : null}
      </div>
      <div className="persona-production-template-meta">
        <strong>{label}</strong>
        <span className="persona-production-template-description">{description}</span>
      </div>
      <span className="persona-production-template-status">
        {isSelected ? "Modelo selecionado para este vídeo" : "Selecionar modelo"}
      </span>
    </button>
  );
}

export function CaricatureVariantOption({
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
        <CaricatureAssetPreview assetId={asset.id} />
      </div>
      <strong>{caricatureVariantLabel(variant)}</strong>
      <span>{isSelected ? "Selecionado para este vídeo" : "Usar neste vídeo"}</span>
    </button>
  );
}

const MATERIAL_UPLOAD_ICON_PATHS = {
  audio:
    "M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z",
  video:
    "M17 10.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4.5l4 4v-13l-4 4Z",
  photo:
    "M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2ZM8.5 13.5 11 16.5l3.5-4.5L19 18H5l3.5-4.5Z",
} as const;

export function MaterialUploadIcon({
  kind,
  variant = "large",
}: {
  kind: keyof typeof MATERIAL_UPLOAD_ICON_PATHS;
  variant?: "inline" | "large";
}) {
  return (
    <span
      className={
        variant === "inline" ? "persona-upload-inline-icon" : "persona-upload-icon"
      }
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        className={
          variant === "inline" ? "persona-upload-svg-inline" : "persona-upload-svg"
        }
      >
        <path fill="currentColor" d={MATERIAL_UPLOAD_ICON_PATHS[kind]} />
      </svg>
    </span>
  );
}

function UploadedFileChip({
  asset,
  formatBytes,
  icon,
}: {
  asset: ProfileTrainingAsset;
  formatBytes: (bytes: number) => string;
  icon: keyof typeof MATERIAL_UPLOAD_ICON_PATHS;
}) {
  const sizeLabel = asset.sizeBytes ? formatBytes(asset.sizeBytes) : "";
  const fullLabel = `${asset.originalFilename}${sizeLabel ? ` (${sizeLabel})` : ""}`;
  const showPhotoThumb = icon === "photo";

  return (
    <span className="persona-upload-file-chip-wrap" title={fullLabel}>
      {showPhotoThumb ? (
        <span className="persona-upload-file-thumb" aria-hidden="true">
          <TrainingAssetMediaPreview
            assetId={asset.id}
            className="persona-upload-file-thumb-image"
          />
        </span>
      ) : (
        <MaterialUploadIcon kind={icon} variant="inline" />
      )}
      <span className="persona-file-chip persona-file-chip-truncate">
        <span className="persona-file-chip-name">{asset.originalFilename}</span>
        {sizeLabel ? <span className="persona-file-chip-size"> ({sizeLabel})</span> : null}
      </span>
    </span>
  );
}

function MaterialUploadFieldError({ message }: { message?: string | null }) {
  if (!message?.trim()) {
    return null;
  }

  return (
    <p className="persona-helper-text persona-helper-highlight persona-upload-field-error">
      {message}
    </p>
  );
}

function MaterialUploadFilledState({
  id,
  accept,
  icon,
  asset,
  formatBytes,
  error,
  variant,
  onChange,
}: {
  id: string;
  accept: string;
  icon: keyof typeof MATERIAL_UPLOAD_ICON_PATHS;
  asset: ProfileTrainingAsset;
  formatBytes: (bytes: number) => string;
  error?: string | null;
  variant: "featured" | "standard";
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="persona-upload-field-block">
      <div
        className={[
          "persona-upload-area",
          "persona-upload-area--filled",
          variant === "featured" ? "persona-upload-area--featured" : "persona-upload-area--standard",
        ].join(" ")}
      >
        <div className="persona-upload-filled-main">
          <UploadedFileChip asset={asset} formatBytes={formatBytes} icon={icon} />
        </div>
        <label htmlFor={id} className="persona-btn persona-btn-secondary persona-btn-compact persona-upload-replace-btn">
          Substituir
        </label>
        <input id={id} type="file" accept={accept} hidden onChange={onChange} />
      </div>
      <MaterialUploadFieldError message={error} />
    </div>
  );
}

export function BaseMaterialsReadiness({
  hasVoice,
  hasPhoto,
  illustratedReadyCount,
}: {
  hasVoice: boolean;
  hasPhoto: boolean;
  illustratedReadyCount: number;
}) {
  const photoRealReady = hasPhoto && hasVoice;

  function photoRealStatus() {
    if (photoRealReady) {
      return { label: "Pronta para vídeo", tone: "ok" as const };
    }
    if (!hasPhoto) {
      return { label: "Falta foto", tone: "warn" as const };
    }
    return { label: "Falta áudio", tone: "warn" as const };
  }

  function illustratedStatus() {
    const readyCount = Math.min(Math.max(illustratedReadyCount, 0), 2);
    if (readyCount > 0 && hasVoice) {
      return {
        label: readyCount === 2 ? "2 prontas" : "1 pronta",
        tone: "ok" as const,
      };
    }
    if (!hasPhoto) {
      return { label: "Falta foto", tone: "warn" as const };
    }
    if (readyCount === 0) {
      return { label: "Falta gerar", tone: "warn" as const };
    }
    return { label: "Falta áudio", tone: "warn" as const };
  }

  const photoReal = photoRealStatus();
  const illustrated = illustratedStatus();

  return (
    <div className="persona-materials-readiness" role="status" aria-live="polite">
      <div className="persona-materials-readiness-item">
        <span className="persona-materials-readiness-track">Foto real</span>
        <span className={`persona-materials-readiness-badge is-${photoReal.tone}`}>
          {photoReal.label}
        </span>
      </div>
      <div className="persona-materials-readiness-item">
        <span className="persona-materials-readiness-track">Ilustrados</span>
        <span className={`persona-materials-readiness-badge is-${illustrated.tone}`}>
          {illustrated.label}
        </span>
      </div>
    </div>
  );
}

export function PhotoAvatarVariantRow({
  label,
  hint,
  statusLabel,
  statusTone = "neutral",
  previewAssetId,
  action,
}: {
  label: string;
  hint: string;
  statusLabel?: string;
  statusTone?: "ok" | "warn" | "neutral";
  previewAssetId?: string | null;
  action?: ReactNode;
}) {
  return (
    <div className="persona-photo-avatar-variant-row">
      <div className="persona-photo-avatar-variant-thumb" aria-hidden="true">
        {previewAssetId ? (
          <TrainingAssetMediaPreview assetId={previewAssetId} />
        ) : (
          <span className="persona-twin-preview-placeholder" />
        )}
      </div>
      <div className="persona-photo-avatar-variant-meta">
        <strong>{label}</strong>
        <span>{hint}</span>
      </div>
      <div className="persona-photo-avatar-variant-actions">
        {statusLabel ? (
          <span className={`persona-photo-avatar-variant-badge is-${statusTone}`}>
            {statusLabel}
          </span>
        ) : null}
        {action}
      </div>
    </div>
  );
}

export function MaterialUploadField({
  id,
  variant,
  icon,
  hint,
  actionLabel,
  accept,
  isUploading,
  asset,
  formatBytes,
  error,
  onFile,
}: {
  id: string;
  variant: "featured" | "standard";
  icon: "audio" | "video" | "photo";
  hint: string;
  actionLabel: string;
  accept: string;
  isUploading: boolean;
  asset: ProfileTrainingAsset | null;
  formatBytes: (bytes: number) => string;
  error?: string | null;
  onFile: (file: File) => void;
}) {
  const hasFile = Boolean(asset);
  const showDropzone = !hasFile || isUploading;

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    onFile(file);
    event.target.value = "";
  }

  if (!showDropzone && asset) {
    return (
      <MaterialUploadFilledState
        id={id}
        accept={accept}
        icon={icon}
        asset={asset}
        formatBytes={formatBytes}
        error={error}
        variant={variant}
        onChange={handleChange}
      />
    );
  }

  return (
    <div className="persona-upload-field-block">
      <label
        htmlFor={id}
        className={[
          "upload-area",
          "persona-upload-area",
          variant === "featured" ? "persona-upload-area--featured" : "persona-upload-area--standard",
          isUploading ? "persona-upload-area-loading" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="persona-upload-lead">
          <MaterialUploadIcon kind={icon} variant="inline" />
          <p className="persona-upload-hint">{hint}</p>
        </div>
        <input id={id} type="file" accept={accept} hidden onChange={handleChange} />
        <span className="persona-btn persona-btn-upload-label">
          {isUploading ? (
            <span className="persona-loading-row">
              <span className="persona-spinner" aria-hidden="true" />
              Enviando...
            </span>
          ) : (
            actionLabel
          )}
        </span>
        {isUploading ? <div className="persona-progress" /> : null}
      </label>
      <MaterialUploadFieldError message={error} />
    </div>
  );
}
