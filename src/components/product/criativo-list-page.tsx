"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ExportComplianceModal } from "@/components/product/export-compliance-modal";
import { formatCreativeProjectTitle } from "@/lib/creative-project-display";
import { withTseCaptionTag } from "@/lib/creative-ai-metadata";
import { parseJsonOrText } from "@/components/product/persona-shared";
import { createDemoPost, isDistributionDemoMode } from "@/lib/distribution/demo-store";
import type { DistributionPost } from "@/lib/distribution/types";
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
        className: "border-[var(--sentinela-border)] bg-emerald-500/10 text-[var(--sentinela-text)]",
      };
    case "generating":
      return {
        label: "Gerando",
        className: "border-cyan-500/30 bg-cyan-500/10 text-[var(--curador-text)]",
      };
    case "failed":
      return {
        label: "Falhou",
        className: "border-red-500/30 bg-red-500/10 text-red-400",
      };
    default:
      return {
        label: status,
        className: "border-md-border bg-md-surface-inset text-md-text-muted",
      };
  }
}

export function CriativoListPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<CreativeProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [distributingId, setDistributingId] = useState<string | null>(null);
  const [exportTarget, setExportTarget] = useState<{
    mediaId: string;
    mediaUrl: string;
    projectId: string;
  } | null>(null);

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

  async function sendToDistribuidor(project: CreativeProject) {
    setDistributingId(project.id);
    setLoadError(null);
    try {
      if (!project.videoUrl?.trim()) {
        throw new Error("O criativo precisa de vídeo antes de distribuir.");
      }

      // Backend Ayrshare permanece fail-closed; o fluxo de produto usa store local.
      if (isDistributionDemoMode()) {
        const post = createDemoPost({
          creativeProjectId: project.id,
          videoUrl: project.videoUrl,
          captionBase:
            project.captionUrl?.trim() ||
            project.scriptDraft?.trim() ||
            project.topic?.trim() ||
            formatCreativeProjectTitle(project),
        });
        router.push(`/distribuidor?post=${post.id}`);
        return;
      }

      const response = await fetch("/api/distribution/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creativeProjectId: project.id }),
      });
      const payload = await parseJsonOrText<{
        post?: DistributionPost;
        message?: string;
      }>(response);
      if (!response.ok || !payload.post) {
        throw new Error(payload.message || "Nao foi possivel enviar ao Distribuidor.");
      }
      router.push(`/distribuidor?post=${payload.post.id}`);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Nao foi possivel enviar ao Distribuidor.",
      );
    } finally {
      setDistributingId(null);
    }
  }

  return (
    <div className="min-h-full relative pb-20">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[40%] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-[30%] right-[-10%] w-[40%] h-[40%] bg-cyan-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-5xl mx-auto relative z-10 px-4 sm:px-6 lg:px-8 pt-10">
        <header className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-md-text tracking-tight">
            Meus criativos
          </h1>
        </header>

        <div className="mb-10 rounded-xl border border-md-border bg-md-surface/40 px-5 py-4">
          <p className="text-sm leading-relaxed text-md-text-muted">
            Histórico de vídeos produzidos com seus avatares. Para visualizá-los, clique em{" "}
            <strong className="font-semibold text-md-text">ver vídeo</strong>. Com vídeo selado,
            envie ao <strong className="font-semibold text-md-text">Distribuidor</strong> para
            publicar nas redes.
          </p>
        </div>

        <section className="bg-gradient-to-b from-md-surface/50 to-md-slate-900/20 backdrop-blur-xl border border-md-border rounded-[1.75rem] p-6 md:p-8 shadow-xl">
          <div className="flex items-center justify-between gap-4 border-b border-md-border pb-4 mb-6">
            <h2 className="text-lg font-semibold text-md-text">Criativos gerados</h2>
            {!isLoading ? (
              <span className="text-xs font-medium text-md-text-soft">
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
              className="flex items-start gap-3 rounded-xl border border-cyan-500/20 bg-[var(--curador-soft)] px-5 py-4"
              role="status"
            >
              <span
                className="mt-0.5 h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-md-border border-t-[var(--curador)]"
                aria-hidden="true"
              />
              <p className="text-sm text-md-text-muted">Carregando criativos…</p>
            </div>
          ) : null}

          {!isLoading && !loadError && projects.length === 0 ? (
            <p className="text-sm text-md-text-soft">
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
                    className="rounded-xl border border-md-border bg-md-surface-inset/80 p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold text-md-text truncate">
                        {formatCreativeProjectTitle(project)}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-md-text-soft">
                        <span>{formatProjectDate(project.createdAt)}</span>
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </div>
                      {project.personaArchetypes.length > 0 ? (
                        <p className="mt-2 text-xs text-md-text-soft">
                          {project.personaArchetypes.join(", ")}
                          {project.voiceTones.length > 0
                            ? ` · ${project.voiceTones.join(", ")}`
                            : ""}
                        </p>
                      ) : null}
                    </div>

                    {project.videoUrl ? (
                      <div className="flex shrink-0 flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            setExportTarget({
                              mediaId: project.heygenVideoId || project.id,
                              mediaUrl: project.videoUrl!,
                              projectId: project.id,
                            })
                          }
                          className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 text-sm font-semibold text-md-text no-underline shadow-[0_0_15px_rgba(6,182,212,0.2)] transition-all hover:from-cyan-400 hover:to-blue-500"
                        >
                          Ver vídeo
                        </button>
                        <button
                          type="button"
                          disabled={distributingId === project.id}
                          onClick={() => void sendToDistribuidor(project)}
                          className="inline-flex items-center justify-center rounded-lg border border-[var(--distribuidor-border)] bg-[var(--distribuidor-soft)] px-4 py-2 text-sm font-semibold text-[var(--distribuidor-text)] disabled:opacity-50"
                        >
                          {distributingId === project.id ? "Enviando…" : "Distribuir"}
                        </button>
                        {project.captionUrl ? (
                          <button
                            type="button"
                            className="inline bg-transparent p-0 text-xs text-[var(--curador-text)] hover:text-[var(--curador-text)] hover:underline"
                            onClick={() =>
                              void navigator.clipboard.writeText(
                                withTseCaptionTag(project.captionUrl!),
                              )
                            }
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
      {exportTarget ? (
        <ExportComplianceModal
          open
          mediaId={exportTarget.mediaId}
          mediaUrl={exportTarget.mediaUrl}
          projectId={exportTarget.projectId}
          onClose={() => setExportTarget(null)}
          onConfirmed={(url) => {
            window.open(url, "_blank", "noopener,noreferrer");
          }}
        />
      ) : null}
    </div>
  );
}
