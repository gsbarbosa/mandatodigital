"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { AppearanceToggle } from "@/components/appearance-toggle";

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@mandatodigital.com.br");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.message || "Falha no login.");
      }
      router.replace("/admin" as Route);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no login.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-md-bg px-4">
      <form
        onSubmit={(e) => void onSubmit(e)}
        className="w-full max-w-md rounded-2xl border border-md-border bg-md-surface p-8 shadow-2xl"
      >
        <div className="mb-4">
          <AppearanceToggle />
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-400/80">
          Mandato Digital
        </p>
        <h1 className="mt-2 text-2xl font-bold text-md-text">Painel de gestão</h1>
        <p className="mt-2 text-sm text-md-text-soft">
          Acesso compartilhado (Guga / Thiago). Conta administrativa estática.
        </p>

        <label className="mt-6 block text-xs font-semibold uppercase tracking-wide text-md-text-soft">
          E-mail
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 w-full rounded-xl border border-md-border bg-md-surface-inset px-3 py-2.5 text-sm text-md-text outline-none focus:border-cyan-500/60"
          />
        </label>

        <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-md-text-soft">
          Senha
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 w-full rounded-xl border border-md-border bg-md-surface-inset px-3 py-2.5 text-sm text-md-text outline-none focus:border-cyan-500/60"
          />
        </label>

        {error ? (
          <p className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-60"
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
