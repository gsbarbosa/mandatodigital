"use client";

import type { Route } from "next";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { CreativeListSkeleton } from "@/components/product/app-loading";
import { parseJsonOrText } from "@/components/product/persona-shared";
import { useProductApp } from "@/components/product/provider";
import { SetupRequiredNotice } from "@/components/product/setup-required-notice";
import { PublishCreativeSoonButton } from "@/components/product/publish-creative-soon-button";
import { useMandatorySetupGate } from "@/components/product/use-mandatory-setup-gate";
import { SentinelSuggestionsList } from "@/components/product/sentinel-suggestion-row";
import { formatCreativeProjectTitle } from "@/lib/creative-project-display";
import {
  isOnboardingV2Completed,
  markOnboardingV2Completed,
} from "@/lib/product-nav";
import { buildSetupChecklist, countPendingSetupItems } from "@/lib/product-setup-checklist";
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

export function InicioPage() {
  const router = useRouter();
  const {
    profileForm,
    trainingAssets,
    sentinelSuggestions,
    sentinelMeta,
    isLoadingSentinel,
    sentinelLoadError,
    isRefreshingSentinel,
    refreshSentinelSignals,
    syncSentinelOnPageEnter,
  } = useProductApp();
  const { canGenerateContent, setupHref, blockMessage } = useMandatorySetupGate();
  const [projects, setProjects] = useState<CreativeProject[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  const checklist = buildSetupChecklist({ profileForm, trainingAssets });
  const pendingCount = countPendingSetupItems({ profileForm, trainingAssets });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setIsLoadingProjects(true);
      setProjectsError(null);

      try {
        const response = await fetch("/api/creative-projects");
        const payload = await parseJsonOrText<{ projects?: CreativeProject[]; message?: string }>(
          response,
        );

        if (!response.ok) {
          throw new Error(payload.message || "Não foi possível carregar os criativos.");
        }

        if (!cancelled) {
          setProjects(payload.projects ?? []);
        }
      } catch (error) {
        if (!cancelled) {
          setProjectsError(
            error instanceof Error ? error.message : "Não foi possível carregar os criativos.",
          );
          setProjects([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingProjects(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void syncSentinelOnPageEnter();
  }, [syncSentinelOnPageEnter]);

  useEffect(() => {
    if (pendingCount === 0 && !isOnboardingV2Completed()) {
      markOnboardingV2Completed();
    }
  }, [pendingCount]);

  useEffect(() => {
    if (isOnboardingV2Completed()) {
      return;
    }

    if (pendingCount > 0) {
      router.replace("/onboarding");
    }
  }, [pendingCount, router]);

  const recentProjects = projects.slice(0, 5);

  return (
    <div className="app-page agent-theme-inicio">
      {pendingCount > 0 ? (
        <section className="app-panel app-panel-alert" data-testid="setup-checklist">
          <div className="app-panel-header">
            <h2 className="app-panel-title">Complete seu setup</h2>
            <span className="app-panel-badge">{pendingCount} pendente{pendingCount === 1 ? "" : "s"}</span>
          </div>
          <ul className="inicio-checklist-list">
            {checklist.map((item) => (
              <li
                key={item.id}
                className={[
                  "inicio-checklist-item",
                  item.done ? "is-done" : "is-pending",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div>
                  <strong>{item.label}</strong>
                  <p className="persona-helper-text">{item.description}</p>
                </div>
                {!item.done ? (
                  <Link href={item.href as Route} className="persona-btn persona-btn-secondary">
                    Configurar
                  </Link>
                ) : (
                  <span className="inicio-checklist-done">Pronto</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="app-dashboard-grid">
        <section className="app-panel app-panel-span-main">
          <div className="app-panel-header">
            <h2 className="app-panel-title">Sinais de pauta</h2>
            <button
              type="button"
              className="persona-btn persona-btn-secondary"
              onClick={() => void refreshSentinelSignals()}
              disabled={isRefreshingSentinel}
              data-testid="inicio-refresh-signals"
            >
              {isRefreshingSentinel ? "Atualizando..." : "Atualizar sinais"}
            </button>
          </div>
          <SentinelSuggestionsList
            suggestions={sentinelSuggestions}
            isLoading={isLoadingSentinel || isRefreshingSentinel}
            loadError={sentinelLoadError}
            emptyMessage="Nenhum sinal em cache. Clique em «Atualizar sinais» para buscar pautas."
            loadingMessage={
              isRefreshingSentinel
                ? "Buscando pautas recentes (pode levar até 1 minuto)..."
                : undefined
            }
            generationBlocked={!canGenerateContent}
            generationBlockedMessage={blockMessage}
            meta={sentinelMeta}
          />
        </section>

        <section className="app-panel app-panel-side">
          <h2 className="app-panel-title">Produção</h2>
          <p className="persona-helper-text">
            Escolha um sinal ao lado ou abra um projeto em branco. A validação factual roda ao
            aprovar o roteiro.
          </p>
          <div className="app-panel-actions">
            {canGenerateContent ? (
              <>
                <Link href="/criativo/novo" className="persona-btn persona-btn-large" data-testid="inicio-criar">
                  Novo criativo
                </Link>
                <Link href="/criativo" className="persona-btn persona-btn-secondary">
                  Meus criativos
                </Link>
              </>
            ) : (
              <SetupRequiredNotice message={blockMessage} href={setupHref} />
            )}
            <Link href="/configuracoes/radar" className="app-link-muted">
              Ajustar radar
            </Link>
          </div>
        </section>

        <section className="app-panel app-panel-span-full">
          <h2 className="app-panel-title">Projetos recentes</h2>
          {projectsError ? (
            <p className="persona-helper-text persona-helper-highlight">{projectsError}</p>
          ) : null}
          {isLoadingProjects ? (
            <>
              <p className="sr-only" role="status">
                Carregando projetos recentes...
              </p>
              <CreativeListSkeleton count={3} />
            </>
          ) : null}
          {!isLoadingProjects && recentProjects.length === 0 ? (
            <p className="persona-helper-text">Nenhum criativo ainda. Comece por Novo criativo.</p>
          ) : null}
          {!isLoadingProjects && recentProjects.length > 0 ? (
            <ul className="persona-creative-list persona-top-gap">
              {recentProjects.map((project) => (
                <li key={project.id} className="persona-creative-list-item">
                  <div className="persona-creative-list-main">
                    <p className="persona-creative-list-topic">
                      {formatCreativeProjectTitle(project)}
                    </p>
                    <p className="persona-helper-text">{formatProjectDate(project.createdAt)}</p>
                  </div>
                  {project.videoUrl ? (
                    <div className="persona-creative-list-actions">
                      <a
                        href={project.videoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="persona-btn persona-btn-secondary"
                      >
                        Ver vídeo
                      </a>
                      <PublishCreativeSoonButton />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </div>
  );
}
