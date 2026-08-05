"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useProductApp } from "@/components/product/provider";
import { ACCOUNT_TIER_LABELS, type AccountTier } from "@/lib/account-tier";
import {
  isDevAccountModeEmail,
  type DevAccountMode,
} from "@/lib/dev-account-mode";

const OPTIONS: Array<{ mode: DevAccountMode; tier: AccountTier; hint: string }> = [
  {
    mode: "guest",
    tier: "trial",
    hint: "Cotas de convidado: temas, vídeos/avatar e créditos do radar.",
  },
  {
    mode: "essencial",
    tier: "essencial",
    hint: "Pago 1 — 5 avatares/mês, vídeos até 1 minuto.",
  },
  {
    mode: "avancado",
    tier: "avancado",
    hint: "Pago 2 — 22 avatares/mês, até 90s, render avançado.",
  },
  {
    mode: "elite",
    tier: "elite",
    hint: "Pago 3 — 60 avatares/mês, até 3 min, publicação em 7 redes.",
  },
];

export function DevAccountModePage() {
  const { sessionUser } = useProductApp();
  const email = sessionUser?.email ?? "";
  const allowed = isDevAccountModeEmail(email);
  const [mode, setMode] = useState<DevAccountMode>("guest");
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
        message?: string;
      };
      if (!response.ok) {
        throw new Error(payload.message || "Não foi possível carregar o modo da conta.");
      }
      if (!payload.allowed) {
        setError("Esta conta não tem acesso a esta tela.");
        return;
      }
      setMode(payload.mode ?? "guest");
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
      const saved = payload.mode ?? next;
      setMode(saved);
      setMessage(payload.message || `Modo ${ACCOUNT_TIER_LABELS[saved === "guest" ? "trial" : saved]} ativo.`);
      window.dispatchEvent(new Event("mandato-account-tier-changed"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  if (!allowed) {
    return (
      <div className="mx-auto max-w-md px-4 py-6 sm:px-6 sm:py-8">
        <h1 className="text-lg font-semibold text-md-text mb-2">Tipo de conta</h1>
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
      <h1 className="text-lg font-semibold text-md-text mb-2">Tipo de conta</h1>
      <p className="text-sm text-md-text-soft mb-8">
        Teste interno: trial + Essencial + Avançado + Elite. Sócios também podem alternar para validar limites.
      </p>

      <div className="space-y-3 mb-6">
        {OPTIONS.map((option) => (
          <button
            key={option.mode}
            type="button"
            disabled={saving}
            onClick={() => void handleSave(option.mode)}
            className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
              mode === option.mode
                ? "border-cyan-700/60 bg-[var(--curador-soft)] text-md-text"
                : "border-md-border bg-md-surface/40 text-md-text-muted hover:border-md-border"
            } disabled:opacity-50`}
          >
            <span className="block text-sm font-medium">{ACCOUNT_TIER_LABELS[option.tier]}</span>
            <span className="block text-xs text-md-text-soft mt-0.5">{option.hint}</span>
          </button>
        ))}
      </div>

      {message ? <p className="text-xs text-[var(--sentinela-text)] mb-3">{message}</p> : null}
      {error ? <p className="text-xs text-red-400 mb-3">{error}</p> : null}

      <Link href="/monitoramento" className="text-sm text-md-text-soft hover:text-md-text-muted">
        ← Voltar ao monitoramento
      </Link>
    </div>
  );
}
