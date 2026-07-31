"use client";

import { useEffect, useRef, useState } from "react";

type AvatarCameraCaptureProps = {
  onCaptured: (file: File) => void;
  onCancel: () => void;
};

export function AvatarCameraCapture({ onCaptured, onCancel }: AvatarCameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        setError("Este navegador não permite acessar a câmera. Use a galeria.");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "user" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
        }
        setReady(true);
      } catch {
        if (!cancelled) {
          setError(
            "Não foi possível acessar a câmera. Permita o acesso nas configurações do navegador ou use a galeria.",
          );
        }
      }
    }

    void startCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function handleCancel() {
    stopCamera();
    onCancel();
  }

  async function takePhoto() {
    const video = videoRef.current;
    if (!video || !ready || capturing) {
      return;
    }

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) {
      setError("Aguarde a câmera carregar e tente de novo.");
      return;
    }

    setCapturing(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setError("Não foi possível capturar a foto.");
        return;
      }

      // Espelha horizontalmente para bater com o preview (selfie).
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, width, height);

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/jpeg", 0.92);
      });
      if (!blob) {
        setError("Não foi possível capturar a foto.");
        return;
      }

      const file = new File([blob], `foto-camera-${Date.now()}.jpg`, {
        type: "image/jpeg",
        lastModified: Date.now(),
      });
      stopCamera();
      onCaptured(file);
    } finally {
      setCapturing(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="avatar-camera-title"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-md-border bg-md-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-md-border px-5 py-4">
          <h2 id="avatar-camera-title" className="text-base font-bold text-md-text">
            Tirar foto com a câmera
          </h2>
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-lg px-2 py-1 text-sm text-md-text-soft hover:bg-md-overlay-hover hover:text-md-text"
          >
            Fechar
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-black">
            {error ? (
              <div className="flex h-full items-center justify-center p-6 text-center text-sm text-amber-200">
                {error}
              </div>
            ) : (
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="h-full w-full object-cover"
                style={{ transform: "scaleX(-1)" }}
              />
            )}
            {!ready && !error ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm text-white">
                Abrindo câmera…
              </div>
            ) : null}
          </div>

          <p className="text-xs text-md-text-soft">
            Enquadre o rosto estilo 3x4, olhando para a lente. Depois você ainda poderá
            recortar.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="inline-flex flex-1 items-center justify-center rounded-xl border border-md-border bg-md-overlay-subtle px-4 py-3 text-sm font-medium text-md-text-muted hover:bg-md-overlay-hover hover:text-md-text"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!ready || Boolean(error) || capturing}
              onClick={() => void takePhoto()}
              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                !ready || error || capturing
                  ? "cursor-not-allowed border-md-border opacity-50 text-md-text-soft"
                  : "border-[var(--curador-border)] bg-[var(--curador-soft)] text-[var(--curador-text)] hover:opacity-90"
              }`}
            >
              {capturing ? "Capturando…" : "Capturar foto"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
