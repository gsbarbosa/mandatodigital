"use client";

import { useEffect, useState } from "react";

import type { AdminProvider } from "@/lib/admin/providers";

const STATUS_STYLE: Record<string, string> = {
  configured: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  missing: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  optional: "bg-amber-500/15 text-amber-200 border-amber-500/30",
};

const STATUS_LABEL: Record<string, string> = {
  configured: "Configurado",
  missing: "Faltando",
  optional: "Opcional / off",
};

export function AdminProvidersPage() {
  const [providers, setProviders] = useState<AdminProvider[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/admin/providers");
        const payload = (await response.json()) as {
          providers?: AdminProvider[];
          message?: string;
        };
        if (!response.ok) {
          throw new Error(payload.message || "Falha ao listar provedores.");
        }
        if (!cancelled) {
          setProviders(payload.providers ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erro.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <header className="mb-8">
        <h2 className="text-2xl font-bold text-white">Provedores</h2>
        <p className="mt-1 text-sm text-slate-400">
          Serviços externos usados pela plataforma. Status baseado em variáveis de ambiente
          (chaves nunca são exibidas).
        </p>
      </header>

      {error ? (
        <p className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3">
        {providers.map((provider) => (
          <article
            key={provider.id}
            className="rounded-2xl border border-slate-800/80 bg-slate-900/40 px-5 py-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-white">{provider.name}</h3>
                <p className="mt-1 text-sm text-slate-400">{provider.description}</p>
                <p className="mt-2 text-xs text-slate-500">
                  Categoria: {provider.category}
                  {provider.envKeys.length > 0
                    ? ` · env: ${provider.envKeys.join(", ")}`
                    : " · sem API key"}
                  {provider.required ? " · obrigatório" : ""}
                </p>
              </div>
              <span
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${STATUS_STYLE[provider.status]}`}
              >
                {STATUS_LABEL[provider.status]}
              </span>
            </div>
            {provider.docsUrl ? (
              <a
                href={provider.docsUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-xs text-cyan-400 hover:underline"
              >
                Documentação →
              </a>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
