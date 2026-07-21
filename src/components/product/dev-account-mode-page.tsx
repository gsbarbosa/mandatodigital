"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useProductApp } from "@/components/product/provider";
import {
  isDevAccountModeEmail,
  type DevAccountMode,
} from "@/lib/dev-account-mode";

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
      <div className="max-w-md mx-auto p-8">
        <h1 className="text-lg font-semibold text-white mb-2">Modo da conta</h1>
        <p className="text-sm text-slate-400 mb-6">Esta conta não tem acesso a esta tela.</p>
        <Link href="/monitoramento" className="text-sm text-cyan-400 hover:text-cyan-300">
          Voltar
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-8">
      <p className="text-xs text-slate-500 mb-1 truncate">{email}</p>
      <h1 className="text-lg font-semibold text-white mb-2">Modo da conta</h1>
      <p className="text-sm text-slate-400 mb-8">
        Alterna entre a versão para convidados (limites) e premium (sem esses limites), só para
        testes internos.
      </p>

      <div className="space-y-3 mb-6">
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave("guest")}
          className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
            mode === "guest"
              ? "border-cyan-700/60 bg-cyan-950/40 text-cyan-100"
              : "border-slate-800 bg-slate-900/40 text-slate-300 hover:border-slate-700"
          }`}
        >
          <span className="block text-sm font-medium">Convidado</span>
          <span className="block text-xs text-slate-500 mt-0.5">
            5 créditos de atualizar pautas · máx. 3 caricaturas por estilo
          </span>
        </button>

        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave("premium")}
          className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
            mode === "premium"
              ? "border-amber-700/60 bg-amber-950/30 text-amber-100"
              : "border-slate-800 bg-slate-900/40 text-slate-300 hover:border-slate-700"
          }`}
        >
          <span className="block text-sm font-medium">Premium</span>
          <span className="block text-xs text-slate-500 mt-0.5">
            Sem os limites da versão para convidados
          </span>
        </button>
      </div>

      {message ? <p className="text-xs text-emerald-400 mb-3">{message}</p> : null}
      {error ? <p className="text-xs text-red-400 mb-3">{error}</p> : null}

      <Link href="/monitoramento" className="text-sm text-slate-500 hover:text-slate-300">
        ← Voltar ao monitoramento
      </Link>
    </div>
  );
}
