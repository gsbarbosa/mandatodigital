"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  ARGIL_LANDSCAPE_RATIO,
  ARGIL_PORTRAIT_RATIO,
  clampArgilCrop,
  computeMaxArgilCrop,
  loadImageFromFile,
  renderArgilCropToFile,
  type ArgilCropRect,
} from "@/lib/argil-image";

type AvatarImageCropModalProps = {
  file: File;
  onConfirm: (file: File) => void | Promise<void>;
  onCancel: () => void;
};

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  cropX: number;
  cropY: number;
};

export function AvatarImageCropModal({
  file,
  onConfirm,
  onCancel,
}: AvatarImageCropModalProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
  const [aspect, setAspect] = useState(ARGIL_PORTRAIT_RATIO);
  const [crop, setCrop] = useState<ArgilCropRect>({ x: 0, y: 0, width: 0, height: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingImage, setIsLoadingImage] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingImage(true);
    setErrorMessage(null);
    setImageSrc(null);
    setImageSize({ width: 0, height: 0 });
    setDisplaySize({ width: 0, height: 0 });
    setCrop({ x: 0, y: 0, width: 0, height: 0 });

    void loadImageFromFile(file)
      .then((loaded) => {
        if (cancelled) {
          return;
        }

        const initialAspect =
          loaded.width >= loaded.height ? ARGIL_LANDSCAPE_RATIO : ARGIL_PORTRAIT_RATIO;

        setImageSrc(loaded.displaySrc);
        setImageSize({ width: loaded.width, height: loaded.height });
        setAspect(initialAspect);
        setCrop(computeMaxArgilCrop(loaded.width, loaded.height, initialAspect));
        setIsLoadingImage(false);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setIsLoadingImage(false);
        setErrorMessage(
          error instanceof Error ? error.message : "Nao foi possivel carregar a imagem.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [file]);

  const syncDisplaySize = useCallback(() => {
    const frame = frameRef.current;
    if (!frame || imageSize.width === 0) {
      return;
    }

    const bounds = frame.getBoundingClientRect();
    const scale = Math.min(bounds.width / imageSize.width, bounds.height / imageSize.height);

    setDisplaySize({
      width: imageSize.width * scale,
      height: imageSize.height * scale,
    });
  }, [imageSize.height, imageSize.width]);

  useEffect(() => {
    syncDisplaySize();
    window.addEventListener("resize", syncDisplaySize);

    const frame = frameRef.current;
    const observer =
      frame && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => syncDisplaySize())
        : null;
    if (frame && observer) {
      observer.observe(frame);
    }

    return () => {
      window.removeEventListener("resize", syncDisplaySize);
      observer?.disconnect();
    };
  }, [syncDisplaySize, imageSize.width]);

  function changeAspect(nextAspect: number) {
    if (imageSize.width === 0) {
      return;
    }

    setAspect(nextAspect);
    setCrop((current) => {
      const centerX = current.x + current.width / 2;
      const centerY = current.y + current.height / 2;
      const next = computeMaxArgilCrop(imageSize.width, imageSize.height, nextAspect);
      return clampArgilCrop(
        {
          ...next,
          x: centerX - next.width / 2,
          y: centerY - next.height / 2,
        },
        imageSize.width,
        imageSize.height,
      );
    });
  }

  const displayScale = imageSize.width > 0 ? displaySize.width / imageSize.width : 1;

  function onCropPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (displayScale === 0) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      cropX: crop.x,
      cropY: crop.y,
    };
  }

  function onCropPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = (event.clientX - drag.startX) / displayScale;
    const deltaY = (event.clientY - drag.startY) / displayScale;

    setCrop((current) =>
      clampArgilCrop(
        {
          ...current,
          x: drag.cropX + deltaX,
          y: drag.cropY + deltaY,
        },
        imageSize.width,
        imageSize.height,
      ),
    );
  }

  function onCropPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  async function handleConfirm() {
    if (!imageSrc || crop.width <= 0) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const outputName = file.name.replace(/\.[^.]+$/, "") || "avatar";
      const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
      const cropped = await renderArgilCropToFile(
        imageSrc,
        crop,
        `${outputName}-recorte.jpg`,
        mimeType,
      );
      await onConfirm(cropped);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Nao foi possivel aplicar o recorte.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCancel();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  const cropStyle = {
    left: crop.x * displayScale,
    top: crop.y * displayScale,
    width: crop.width * displayScale,
    height: crop.height * displayScale,
  };

  return (
    <div
      className="persona-crop-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="avatar-crop-title"
      data-testid="avatar-image-crop-modal"
    >
      <div className="persona-crop-dialog">
        <h3 id="avatar-crop-title">Ajustar enquadramento da foto</h3>
        <p className="persona-helper-text">
          Arraste a area de recorte para manter o rosto visivel. A Argil exige proporcao{" "}
          <strong>9:16</strong> ou <strong>16:9</strong>.
        </p>

        <div className="persona-crop-aspect-row">
          <button
            type="button"
            className={aspect === ARGIL_PORTRAIT_RATIO ? "persona-tag active" : "persona-tag"}
            onClick={() => changeAspect(ARGIL_PORTRAIT_RATIO)}
          >
            Retrato 9:16
          </button>
          <button
            type="button"
            className={aspect === ARGIL_LANDSCAPE_RATIO ? "persona-tag active" : "persona-tag"}
            onClick={() => changeAspect(ARGIL_LANDSCAPE_RATIO)}
          >
            Paisagem 16:9
          </button>
        </div>

        <div className="persona-crop-frame" ref={frameRef}>
          {imageSrc && displaySize.width > 0 ? (
            <div
              className="persona-crop-stage"
              style={{ width: displaySize.width, height: displaySize.height }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageSrc}
                alt="Pre-visualizacao para recorte"
                className="persona-crop-image"
                width={displaySize.width}
                height={displaySize.height}
                draggable={false}
              />
              <div
                className="persona-crop-selection"
                style={cropStyle}
                onPointerDown={onCropPointerDown}
                onPointerMove={onCropPointerMove}
                onPointerUp={onCropPointerUp}
                onPointerCancel={onCropPointerUp}
                data-testid="avatar-crop-selection"
              >
                <span className="persona-crop-handle" />
              </div>
            </div>
          ) : (
            <p className="persona-helper-text">
              {isLoadingImage ? "Carregando imagem..." : "Aguardando imagem..."}
            </p>
          )}
        </div>

        {errorMessage && (
          <p className="persona-helper-text persona-helper-highlight">{errorMessage}</p>
        )}

        <div className="persona-crop-actions">
          <button type="button" className="persona-btn" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </button>
          <button
            type="button"
            className="persona-btn"
            data-testid="avatar-crop-confirm"
            onClick={() => void handleConfirm()}
            disabled={isSubmitting || crop.width <= 0 || !imageSrc}
          >
            {isSubmitting ? "Aplicando..." : "Usar este recorte"}
          </button>
        </div>
      </div>
    </div>
  );
}
