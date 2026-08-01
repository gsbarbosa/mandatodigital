"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useProductApp } from "@/components/product/provider";
import {
  isDevAccountModeEmail,
  isForcePremiumAccountEmail,
  type DevAccountMode,
} from "@/lib/dev-account-mode";

export function DevAccountModePage() {
  const { sessionUser } = useProductApp();
  const email = sessionUser?.email ?? "";
  const allowed = isDevAccountModeEmail(email);
  const forcedPremium = isForcePremiumAccountEmail(email);
  const [mode, setMode] = useState<DevAccountMode>(forcedPremium ? "premium" : "guest");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch("/api/dev/account-mode", { credentials: "same-origin" });
      const payload = (await response.json().catch(() => ({}))) as {
        allowed?: boolean;
        mode?: DevAccountMode;
        forcedPremium?: boolean;
        message?: string;
      };
      if (!response.ok) {
        throw new Error(payload.message || "Não foi possível carregar o modo da conta.");
      }
      if (!payload.allowed) {
        setError("Esta conta não tem acesso a esta tela.");
        return;
      }
      setMode(payload.mode === "premium" ? "premium" : "guest");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar.");
    }
  }, []);

  useEffect(() => {
    if (allowed) {
      void load();
    }
  }, [allowed, load]);

  async function handleSave(next: DevAccountMode) {
    if (forcedPremium) {
      setMessage("Contas de sócio ficam sempre em premium.");
      return;
    }
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/dev/account-mode", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: next }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        mode?: DevAccountMode;
        message?: string;
      };
      if (!response.ok) {
        throw new Error(payload.message || "Não foi possível salvar.");
      }
      setMode(payload.mode === "premium" ? "premium" : "guest");
      setMessage(
        payload.mode === "premium"
          ? "Conta premium ativa — limites de convidado desligados."
          : "Conta convidado ativa — limites da versão free aplicados.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  if (!allowed) {
    return (
      <div className="mx-auto max-w-md px-4 py-6 sm:px-6 sm:py-8">
        <h1 className="text-lg font-semibold text-md-text mb-2">Modo da conta</h1>
        <p className="text-sm text-md-text-soft mb-6">Esta conta não tem acesso a esta tela.</p>
        <Link href="/monitoramento" className="text-sm text-[var(--curador-text)] hover:text-[var(--curador-text)]">
          Voltar
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-6 sm:px-6 sm:py-8">
      <p className="text-xs text-md-text-soft mb-1 truncate">{email}</p>
      <h1 className="text-lg font-semibold text-md-text mb-2">Modo da conta</h1>
      <p className="text-sm text-md-text-soft mb-8">
        {forcedPremium
          ? "Conta de sócio: premium permanente (sem limites de convidado)."
          : "Alterna entre a versão para convidados (limites) e premium (sem esses limites), só para testes internos."}
      </p>

      <div className="space-y-3 mb-6">
        <button
          type="button"
          disabled={saving || forcedPremium}
          onClick={() => void handleSave("guest")}
          className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
            mode === "guest"
              ? "border-cyan-700/60 bg-[var(--curador-soft)] text-md-text"
              : "border-md-border bg-md-surface/40 text-md-text-muted hover:border-md-border"
          } disabled:opacity-50`}
        >
          <span className="block text-sm font-medium">Convidado</span>
          <span className="block text-xs text-md-text-soft mt-0.5">
            5 créditos de atualizar pautas · máx. 3 caricaturas por estilo
          </span>
        </button>

        <button
          type="button"
          disabled={saving || forcedPremium}
          onClick={() => void handleSave("premium")}
          className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
            mode === "premium"
              ? "border-amber-700/60 bg-[var(--distribuidor-soft)] text-md-text"
              : "border-md-border bg-md-surface/40 text-md-text-muted hover:border-md-border"
          } disabled:opacity-50`}
        >
          <span className="block text-sm font-medium">Premium</span>
          <span className="block text-xs text-md-text-soft mt-0.5">
            Sem os limites da versão para convidados
          </span>
        </button>
      </div>

      {message ? <p className="text-xs text-[var(--sentinela-text)] mb-3">{message}</p> : null}
      {error ? <p className="text-xs text-red-400 mb-3">{error}</p> : null}

      <Link href="/monitoramento" className="text-sm text-md-text-soft hover:text-md-text-muted">
        ← Voltar ao monitoramento
      </Link>
    </div>
  );
}
