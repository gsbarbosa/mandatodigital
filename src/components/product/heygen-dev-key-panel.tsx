"use client";

import { useEffect, useRef, useState } from "react";

import {
  clearHeygenApiKeyOverride,
  fetchHeygenApi,
  maskHeygenApiKey,
  readHeygenApiKeyOverride,
  writeHeygenApiKeyOverride,
} from "@/lib/heygen-client-override";

type HeygenDevKeyPanelProps = {
  open: boolean;
  onClose: () => void;
};

export function HeygenDevKeyPanel({ open, onClose }: HeygenDevKeyPanelProps) {
  const [draftKey, setDraftKey] = useState("");
  const [savedMasked, setSavedMasked] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    const stored = readHeygenApiKeyOverride();
    setDraftKey(stored);
    setSavedMasked(maskHeygenApiKey(stored));
    setStatus(stored ? "Chave de teste ativa para chamadas HeyGen." : null);
    setError(null);
  }, [open]);

  if (!open) {
    return null;
  }

  async function handleSave() {
    setError(null);
    setStatus(null);
    writeHeygenApiKeyOverride(draftKey);
    const stored = readHeygenApiKeyOverride();
    setSavedMasked(maskHeygenApiKey(stored));
    setStatus(
      stored
        ? "Salvo no navegador. O Curador usará esta conta nas próximas chamadas."
        : "Override removido — volta a usar a chave do servidor.",
    );
  }

  function handleClear() {
    setDraftKey("");
    clearHeygenApiKeyOverride();
    setSavedMasked("");
    setStatus("Override removido.");
    setError(null);
  }

  async function handleTest() {
    setIsTesting(true);
    setError(null);
    setStatus(null);
    try {
      if (draftKey.trim()) {
        writeHeygenApiKeyOverride(draftKey);
      }
      const response = await fetchHeygenApi("/api/heygen/me");
      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
        data?: { email?: string; username?: string };
        error?: { message?: string };
      };

      if (!response.ok) {
        throw new Error(
          payload.message ||
            payload.error?.message ||
            "Não foi possível validar a chave.",
        );
      }

      const email = payload.data?.email?.trim();
      const username = payload.data?.username?.trim();
      setSavedMasked(maskHeygenApiKey(readHeygenApiKeyOverride()));
      setStatus(
        email || username
          ? `Conectado: ${email || username}`
          : "Chave aceita pela API.",
      );
    } catch (testError) {
      setError(
        testError instanceof Error ? testError.message : "Falha ao testar a chave.",
      );
    } finally {
      setIsTesting(false);
    }
  }

  return (
    <div className="heygen-dev-panel" role="region" aria-label="Configuração HeyGen (teste)">
      <div className="heygen-dev-panel-head">
        <strong>Conta de teste</strong>
        <button type="button" className="heygen-dev-panel-close" onClick={onClose}>
          Fechar
        </button>
      </div>
      <p className="persona-helper-text">
        Comando oculto: 3 cliques no número <strong>5</strong> (Distribuidor) na barra do Curador.
        Salva só neste navegador. Em produção, defina{" "}
        <code>ALLOW_CLIENT_KEY_OVERRIDE=true</code> no servidor.
      </p>
      <label className="persona-label" htmlFor="heygen-dev-api-key">
        API key
      </label>
      <input
        id="heygen-dev-api-key"
        type="password"
        className="persona-input"
        autoComplete="off"
        spellCheck={false}
        value={draftKey}
        onChange={(event) => setDraftKey(event.target.value)}
        placeholder="Cole a x-api-key da conta HeyGen"
      />
      {savedMasked ? (
        <p className="persona-helper-text">Ativa: {savedMasked}</p>
      ) : null}
      <div className="button-row">
        <button type="button" className="primary-button" onClick={() => void handleSave()}>
          Salvar
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => void handleTest()}
          disabled={isTesting || !draftKey.trim()}
        >
          {isTesting ? "Testando…" : "Testar conexão"}
        </button>
        <button type="button" className="secondary-button" onClick={handleClear}>
          Limpar
        </button>
      </div>
      {status ? (
        <p className="heygen-dev-panel-banner is-success" role="status">
          {status}
        </p>
      ) : null}
      {error ? (
        <p className="heygen-dev-panel-banner is-error" role="status">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const SECRET_CLICK_WINDOW_MS = 700;

export function useHeygenDevPanelReveal() {
  const [open, setOpen] = useState(false);
  const clickCountRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSecretClick() {
    clickCountRef.current += 1;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      clickCountRef.current = 0;
    }, SECRET_CLICK_WINDOW_MS);

    if (clickCountRef.current >= 3) {
      clickCountRef.current = 0;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      setOpen((current) => !current);
    }
  }

  return { open, setOpen, handleSecretClick };
}
