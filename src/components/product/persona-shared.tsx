"use client";

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
import { formatTwinLookCaption } from "@/lib/heygen-twin-display";
import type { CaricatureVariant } from "@/lib/openai-caricature-prompts";
import type { ProfileTrainingAsset } from "@/lib/types";
import type { TwinLookDisplayMeta } from "@/lib/heygen-twin-display";

export const MAX_SCRIPT_WORDS = 140;

export const AVATAR_TYPE_BY_TRACK = {
  realistic: "Meu Gêmeo Digital",
  caricature: "Minha Caricatura",
} as const;

export type AvatarTrack = "realistic" | "caricature";
export type ProductionSource = "use_existing" | "train_new";
export type ProductionTemplate =
  | "digital_twin"
  | "caricature_editorial"
  | "caricature_mascot_3d";

export function productionTemplateLabel(template: ProductionTemplate) {
  switch (template) {
    case "digital_twin":
      return "Gêmeo Digital";
    case "caricature_editorial":
      return caricatureVariantLabel("editorial");
    case "caricature_mascot_3d":
      return caricatureVariantLabel("mascot_3d");
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
  return value === "Minha Caricatura" ? "caricature" : "realistic";
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

export function TwinLookMedia({
  look,
  className = "persona-caricature-preview-image",
  compact = false,
  preferVideo = false,
}: {
  look: PrivateTwinLook;
  className?: string;
  compact?: boolean;
  preferVideo?: boolean;
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/profile/training-assets/${encodeURIComponent(assetId)}/preview-url`)
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
  }, [assetId]);

  if (previewUrl) {
    return (
      <img src={previewUrl} alt="" className="persona-caricature-preview-image" />
    );
  }

  return <span className="persona-twin-preview-placeholder" />;
}

export function ProductionTemplateOption({
  label,
  isSelected,
  isAvailable,
  unavailableHint,
  onSelect,
  preview,
}: {
  label: string;
  isSelected: boolean;
  isAvailable: boolean;
  unavailableHint?: string;
  onSelect: () => void;
  preview: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      disabled={!isAvailable}
      className={[
        "persona-production-template-card",
        isSelected ? "is-selected" : "",
        !isAvailable ? "is-unavailable" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onSelect}
    >
      <span className="persona-production-template-check" aria-hidden="true">
        <span className="persona-production-template-check-box">
          {isSelected ? "✓" : ""}
        </span>
      </span>
      <div className="persona-production-template-thumb" aria-hidden="true">
        {preview}
      </div>
      <strong>{label}</strong>
      {!isAvailable && unavailableHint ? (
        <span className="persona-production-template-hint">{unavailableHint}</span>
      ) : (
        <span className="persona-production-template-hint">
          {isSelected ? "Selecionado" : "Usar neste vídeo"}
        </span>
      )}
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

  return (
    <span className="persona-upload-file-chip-wrap" title={fullLabel}>
      <MaterialUploadIcon kind={icon} variant="inline" />
      <span className="persona-file-chip persona-file-chip-truncate">
        <span className="persona-file-chip-name">{asset.originalFilename}</span>
        {sizeLabel ? <span className="persona-file-chip-size"> ({sizeLabel})</span> : null}
      </span>
    </span>
  );
}

export function MaterialUploadField({
  id,
  size,
  spanFull,
  icon,
  title,
  hint,
  accept,
  isUploading,
  asset,
  formatBytes,
  onFile,
}: {
  id: string;
  size: "compact" | "large";
  spanFull?: boolean;
  icon: "audio" | "video" | "photo";
  title: string;
  hint: string;
  accept: string;
  isUploading: boolean;
  asset: ProfileTrainingAsset | null;
  formatBytes: (bytes: number) => string;
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
      <div
        className={[
          "persona-upload-inline-row",
          spanFull ? "persona-upload-field-span-full" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <UploadedFileChip asset={asset} formatBytes={formatBytes} icon={icon} />
        <label htmlFor={id} className="persona-btn persona-btn-secondary persona-btn-compact">
          Substituir
        </label>
        <input id={id} type="file" accept={accept} hidden onChange={handleChange} />
      </div>
    );
  }

  if (size === "compact") {
    return (
      <div
        className={[
          "persona-upload-inline-wrap",
          spanFull ? "persona-upload-field-span-full" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <label
          htmlFor={id}
          className={[
            "upload-area",
            "persona-upload-inline-row",
            "is-empty",
            isUploading ? "is-loading" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <MaterialUploadIcon kind={icon} variant="inline" />
          <span className="persona-upload-inline-hint">{hint}</span>
          <input id={id} type="file" accept={accept} hidden onChange={handleChange} />
          <span className="persona-btn persona-btn-upload-label">
            {isUploading ? (
              <span className="persona-loading-row">
                <span className="persona-spinner" aria-hidden="true" />
                Enviando...
              </span>
            ) : (
              uploadAreaButtonLabel(false)
            )}
          </span>
        </label>
        {isUploading ? <div className="persona-progress" /> : null}
      </div>
    );
  }

  return (
    <label
      htmlFor={id}
      className={[
        "upload-area",
        "persona-upload-area",
        spanFull ? "persona-upload-field-span-full" : "",
        isUploading ? "persona-upload-area-loading" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <MaterialUploadIcon kind={icon} variant="large" />
      <h4 className="persona-upload-block-title">{title}</h4>
      <p>{hint}</p>
      <input id={id} type="file" accept={accept} hidden onChange={handleChange} />
      <span className="persona-btn persona-btn-upload-label">
        {isUploading ? (
          <span className="persona-loading-row">
            <span className="persona-spinner" aria-hidden="true" />
            Enviando...
          </span>
        ) : (
          uploadAreaButtonLabel(false)
        )}
      </span>
      {isUploading ? <div className="persona-progress" /> : null}
    </label>
  );
}
