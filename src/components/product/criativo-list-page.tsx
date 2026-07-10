"use client";

import { useCallback, useEffect, useState } from "react";

import { formatCreativeProjectTitle } from "@/lib/creative-project-display";
import { parseJsonOrText } from "@/components/product/persona-shared";
import type { CreativeProject } from "@/lib/types";

function formatProjectDate(value: string) {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function projectStatusBadge(status: CreativeProject["status"]) {
  switch (status) {
    case "ready":
      return {
        label: "Pronto",
        className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
      };
    case "generating":
      return {
        label: "Gerando",
        className: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
      };
    case "failed":
      return {
        label: "Falhou",
        className: "border-red-500/30 bg-red-500/10 text-red-400",
      };
    default:
      return {
        label: status,
        className: "border-slate-600/40 bg-slate-800/60 text-slate-300",
      };
  }
}

export function CriativoListPage() {
  const [projects, setProjects] = useState<CreativeProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const response = await fetch("/api/creative-projects");
      const payload = await parseJsonOrText<{ projects?: CreativeProject[]; message?: string }>(
        response,
      );

      if (!response.ok) {
        throw new Error(payload.message || "Nao foi possivel carregar os criativos.");
      }

      setProjects(payload.projects ?? []);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Nao foi possivel carregar os criativos.",
      );
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  return (
    <div className="min-h-full relative pb-20">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[40%] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-[30%] right-[-10%] w-[40%] h-[40%] bg-cyan-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-5xl mx-auto relative z-10 px-4 sm:px-6 lg:px-8 pt-10">
        <header className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            Meus criativos
          </h1>
        </header>

        <div className="mb-10 rounded-xl border border-slate-800 bg-slate-900/40 px-5 py-4">
          <p className="text-sm leading-relaxed text-slate-300">
            Histórico de vídeos produzidos com seus avatares. Para visualizá-los, clique em{" "}
            <strong className="font-semibold text-slate-200">ver vídeo</strong>.
          </p>
        </div>

        <section className="bg-gradient-to-b from-slate-900/50 to-slate-900/20 backdrop-blur-xl border border-slate-800 rounded-[1.75rem] p-6 md:p-8 shadow-xl">
          <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-6">
            <h2 className="text-lg font-semibold text-white">Criativos gerados</h2>
            {!isLoading ? (
              <span className="text-xs font-medium text-slate-500">
                {projects.length} {projects.length === 1 ? "item" : "itens"}
              </span>
            ) : null}
          </div>

          {loadError ? (
            <div className="rounded-xl border border-red-500/25 bg-red-950/20 px-5 py-4">
              <p className="text-sm text-red-300">{loadError}</p>
            </div>
          ) : null}

          {isLoading ? (
            <div
              className="flex items-start gap-3 rounded-xl border border-cyan-500/20 bg-cyan-950/20 px-5 py-4"
              role="status"
            >
              <span
                className="mt-0.5 h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-400"
                aria-hidden="true"
              />
              <p className="text-sm text-slate-300">Carregando criativos…</p>
            </div>
          ) : null}

          {!isLoading && !loadError && projects.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nenhum vídeo no histórico ainda. Os criativos produzidos com seus avatares aparecerão
              aqui.
            </p>
          ) : null}

          {!isLoading && projects.length > 0 ? (
            <ul className="space-y-4">
              {projects.map((project) => {
                const status = projectStatusBadge(project.status);

                return (
                  <li
                    key={project.id}
                    className="rounded-xl border border-slate-800 bg-[#0E1321]/80 p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold text-white truncate">
                        {formatCreativeProjectTitle(project)}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <span>{formatProjectDate(project.createdAt)}</span>
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </div>
                      {project.personaArchetypes.length > 0 ? (
                        <p className="mt-2 text-xs text-slate-500">
                          {project.personaArchetypes.join(", ")}
                          {project.voiceTones.length > 0
                            ? ` · ${project.voiceTones.join(", ")}`
                            : ""}
                        </p>
                      ) : null}
                    </div>

                    {project.videoUrl ? (
                      <div className="flex shrink-0 items-center gap-3">
                        <a
                          href={project.videoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white no-underline shadow-[0_0_15px_rgba(6,182,212,0.2)] transition-all hover:from-cyan-400 hover:to-blue-500"
                        >
                          Ver vídeo
                        </a>
                        {project.captionUrl ? (
                          <button
                            type="button"
                            className="inline bg-transparent p-0 text-xs text-cyan-400 hover:text-cyan-300 hover:underline"
                            onClick={() => void navigator.clipboard.writeText(project.captionUrl!)}
                          >
                            Copiar legenda
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </section>
      </div>
    </div>
  );
}
