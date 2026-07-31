"use client";

import { useEffect, useRef, useState } from "react";

type AvatarVoiceRecorderProps = {
  disabled?: boolean;
  busy?: boolean;
  onRecorded: (file: File) => void;
};

const MAX_SECONDS = 120;

function pickRecorderMimeType() {
  if (typeof MediaRecorder === "undefined") {
    return "";
  }
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function extensionForMime(mimeType: string) {
  if (mimeType.includes("mp4")) {
    return "m4a";
  }
  if (mimeType.includes("ogg")) {
    return "ogg";
  }
  return "webm";
}

function formatClock(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function AvatarVoiceRecorder({
  disabled = false,
  busy = false,
  onRecorded,
}: AvatarVoiceRecorderProps) {
  const [supported, setSupported] = useState(true);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);
  const mimeTypeRef = useRef("");

  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      typeof navigator !== "undefined" &&
      Boolean(navigator.mediaDevices?.getUserMedia) &&
      typeof MediaRecorder !== "undefined";
    setSupported(ok);
  }, []);

  useEffect(() => {
    return () => {
      stopTimer();
      stopStream();
    };
  }, []);

  function stopTimer() {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  async function startRecording() {
    setError(null);
    if (!supported || disabled || busy) {
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = pickRecorderMimeType();
      mimeTypeRef.current = mimeType;
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        stopTimer();
        stopStream();
        setRecording(false);

        const blobType = mimeTypeRef.current || recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: blobType });
        chunksRef.current = [];

        if (blob.size < 1000) {
          setError("Gravação muito curta. Tente novamente.");
          return;
        }

        const ext = extensionForMime(blobType);
        const file = new File([blob], `voz-celular-${Date.now()}.${ext}`, {
          type: blobType,
          lastModified: Date.now(),
        });
        onRecorded(file);
      };

      recorder.start(250);
      startedAtRef.current = Date.now();
      setElapsed(0);
      setRecording(true);

      timerRef.current = window.setInterval(() => {
        const seconds = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setElapsed(seconds);
        if (seconds >= MAX_SECONDS) {
          stopRecording();
        }
      }, 250);
    } catch {
      stopStream();
      setRecording(false);
      setError(
        "Não foi possível acessar o microfone. Permita o acesso nas configurações do navegador/celular.",
      );
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      stopTimer();
      stopStream();
      setRecording(false);
      return;
    }
    try {
      recorder.stop();
    } catch {
      stopTimer();
      stopStream();
      setRecording(false);
    }
  }

  if (!supported) {
    return (
      <p className="text-[11px] text-md-text-soft">
        Este navegador não permite gravação direta. Use o upload de arquivo de áudio.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {!recording ? (
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => void startRecording()}
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
              disabled || busy
                ? "cursor-not-allowed border-md-border opacity-50 text-md-text-soft"
                : "border-[var(--criativo-border)] bg-[var(--criativo-soft)] text-[var(--criativo-text)] hover:opacity-90"
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
            Gravar áudio no celular
          </button>
        ) : (
          <button
            type="button"
            onClick={stopRecording}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--auditor-border)] bg-[var(--auditor-soft)] px-4 py-3 text-sm font-semibold text-[var(--auditor-text)] hover:opacity-90"
          >
            <span
              className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-400"
              aria-hidden="true"
            />
            Parar gravação · {formatClock(elapsed)}
          </button>
        )}
      </div>
      <p className="text-[10px] text-md-text-soft">
        Grave o roteiro ao lado (30s–2min). O envio começa ao parar a gravação.
      </p>
      {error ? (
        <p className="text-[11px] text-amber-300/90" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
