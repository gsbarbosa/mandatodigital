"use client";

import { useCallback, useEffect, useState } from "react";

import {
  readCuradorHeygenPrefs,
  writeCuradorHeygenPrefs,
} from "@/lib/curador-heygen-prefs";
import type { ProfileVoiceSelection } from "@/lib/voice-preview-types";

type AvatarVoicePreviewPickerProps = {
  profileId: string | null;
  voiceAudioAssetId: string | null;
  consentAccepted: boolean;
  onMessage?: (message: string | null) => void;
  onSelectedPreviewChange?: (previewId: string | null) => void;
};

export function AvatarVoicePreviewPicker({
  profileId,
  voiceAudioAssetId,
  consentAccepted,
  onMessage,
  onSelectedPreviewChange,
}: AvatarVoicePreviewPickerProps) {
  const [selection, setSelection] = useState<ProfileVoiceSelection | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const syncLocalPrefs = useCallback(
    (next: ProfileVoiceSelection) => {
      if (!profileId || !next.selectedPreviewId || !next.elevenLabsVoiceId) {
        return;
      }
      const prefs = readCuradorHeygenPrefs(profileId);
      writeCuradorHeygenPrefs(profileId, {
        ...prefs,
        elevenLabsVoiceId: next.elevenLabsVoiceId,
        elevenLabsVoiceAudioAssetId: next.voiceAudioAssetId,
      });
    },
    [profileId],
  );

  useEffect(() => {
    if (!profileId || !voiceAudioAssetId) {
      setSelection(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const response = await fetch("/api/profile/voice-previews", {
          credentials: "include",
        });
        const data = (await response.json().catch(() => ({}))) as {
          selection?: ProfileVoiceSelection | null;
          message?: string;
        };
        if (cancelled) {
          return;
        }
        if (!response.ok) {
          setError(data.message ?? "Não foi possível carregar as prévias.");
          return;
        }
        const next = data.selection ?? null;
        if (next && next.voiceAudioAssetId === voiceAudioAssetId) {
          setSelection(next);
        } else {
          setSelection(null);
        }
      } catch {
        if (!cancelled) {
          setError("Falha de rede ao carregar prévias de voz.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profileId, voiceAudioAssetId]);

  useEffect(() => {
    onSelectedPreviewChange?.(selection?.selectedPreviewId ?? null);
  }, [onSelectedPreviewChange, selection?.selectedPreviewId]);

  async function handleGenerate() {
    if (!profileId || !voiceAudioAssetId) {
      return;
    }
    if (!consentAccepted) {
      onMessage?.("Aceite os termos de treinamento antes de gerar as prévias.");
      return;
    }

    setGenerating(true);
    setError(null);
    onMessage?.(null);

    try {
      const response = await fetch("/api/profile/voice-previews", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceAudioAssetId }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        selection?: ProfileVoiceSelection;
        message?: string;
      };
      if (!response.ok || !data.selection) {
        setError(data.message ?? "Não foi possível gerar as prévias de voz.");
        return;
      }
      setSelection(data.selection);
      onMessage?.("Três prévias geradas. Ouça e escolha a voz ativa.");
    } catch {
      setError("Falha de rede ao gerar prévias de voz.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSelect(previewId: string) {
    if (!profileId) {
      return;
    }
    setSelectingId(previewId);
    setError(null);

    try {
      const response = await fetch("/api/profile/voice-previews", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ previewId }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        selection?: ProfileVoiceSelection;
        message?: string;
      };
      if (!response.ok || !data.selection) {
        setError(data.message ?? "Não foi possível salvar a escolha.");
        return;
      }
      setSelection(data.selection);
      syncLocalPrefs(data.selection);
      const label =
        data.selection.previews.find((p) => p.id === previewId)?.label ?? "escolhida";
      onMessage?.(`Voz ativa: ${label}. Os próximos vídeos usarão esta voz.`);
    } catch {
      setError("Falha de rede ao salvar a escolha de voz.");
    } finally {
      setSelectingId(null);
    }
  }

  if (!voiceAudioAssetId) {
    return null;
  }

  const hasPreviews = Boolean(selection?.previews?.length);
  const staleAsset =
    Boolean(selection) && selection!.voiceAudioAssetId !== voiceAudioAssetId;

  return (
    <div
      id="voz-previas"
      className="bg-md-surface/60 border border-md-border rounded-2xl p-6 scroll-mt-24"
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
        <div>
          <h4 className="text-lg font-bold text-md-text">Escolha sua voz</h4>
          <p className="text-xs text-md-text-soft mt-1 max-w-xl">
            Geramos três variações da sua voz. Ouça e selecione aquela que mais gosta ou se
            parece com você. Ela será utilizada em todos os seus vídeos.
          </p>
        </div>
        {!hasPreviews || staleAsset ? (
          <button
            type="button"
            disabled={!consentAccepted || generating || loading || !profileId}
            onClick={() => void handleGenerate()}
            className={`shrink-0 inline-flex items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
              !consentAccepted || generating || loading || !profileId
                ? "cursor-not-allowed border-md-border opacity-50 text-md-text-soft"
                : "border-[var(--criativo-border)] bg-[var(--criativo-soft)] text-[var(--criativo-text)] hover:opacity-90"
            }`}
          >
            {generating ? "Gerando prévias..." : "Gerar prévias"}
          </button>
        ) : null}
      </div>

      {!consentAccepted ? (
        <p className="text-xs text-amber-300/90">
          Aceite os termos abaixo para liberar a geração das prévias.
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-md-text-soft">Carregando prévias...</p>
      ) : null}

      {error ? (
        <p className="text-sm text-amber-300/90" role="alert">
          {error}
        </p>
      ) : null}

      {hasPreviews && !staleAsset ? (
        <div className="flex flex-col gap-3 mt-2">
          {selection!.previews.map((preview) => {
            const selected = selection!.selectedPreviewId === preview.id;
            const busy = selectingId === preview.id;
            return (
              <div
                key={preview.id}
                className={`rounded-xl border px-4 py-3 transition ${
                  selected
                    ? "border-purple-400/60 bg-purple-500/10"
                    : "border-md-border bg-md-overlay-subtle"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-md-text">
                        {preview.label}
                      </span>
                      {selected ? (
                        <span className="text-[10px] uppercase tracking-wide font-bold text-purple-300">
                          Voz ativa
                        </span>
                      ) : null}
                    </div>
                    <p className="text-[11px] text-md-text-soft mb-2">
                      {preview.description}
                    </p>
                    <audio
                      key={preview.audioUrl}
                      controls
                      src={preview.audioUrl}
                      className="w-full max-w-md"
                      preload="metadata"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={busy || selected}
                    onClick={() => void handleSelect(preview.id)}
                    className={`shrink-0 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                      selected
                        ? "border-[var(--criativo-border)] bg-[var(--criativo-soft)] text-[var(--criativo-text)] cursor-default"
                        : busy
                          ? "opacity-50 cursor-wait border-md-border text-md-text-soft"
                          : "border-[var(--criativo-border)] bg-[var(--criativo-soft)] text-[var(--criativo-text)] hover:opacity-90"
                    }`}
                  >
                    {selected ? "Selecionada" : busy ? "Salvando..." : "Usar esta voz"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        !loading &&
        consentAccepted && (
          <p className="text-sm text-md-text-soft">
            Envie o áudio acima e clique em <strong>Gerar prévias</strong> para ouvir
            as opções.
          </p>
        )
      )}
    </div>
  );
}
