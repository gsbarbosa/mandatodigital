"use client";

import type { Route } from "next";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
import type { MockSentinelSuggestion } from "@/lib/sentinel-mock-suggestions";
import type { SentinelSuggestionsMeta } from "@/lib/sentinel-suggestions";
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
  const { profileForm, trainingAssets } = useProductApp();
  const { canGenerateContent, setupHref, blockMessage } = useMandatorySetupGate();
  const [projects, setProjects] = useState<CreativeProject[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [sentinelSuggestions, setSentinelSuggestions] = useState<MockSentinelSuggestion[]>([]);
  const [sentinelMeta, setSentinelMeta] = useState<SentinelSuggestionsMeta | null>(null);
  const [isLoadingSentinel, setIsLoadingSentinel] = useState(true);
  const [sentinelLoadError, setSentinelLoadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);

  const checklist = buildSetupChecklist({ profileForm, trainingAssets });
  const pendingCount = countPendingSetupItems({ profileForm, trainingAssets });

  const loadProjects = useCallback(async () => {
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

      setProjects(payload.projects ?? []);
    } catch (error) {
      setProjectsError(
        error instanceof Error ? error.message : "Não foi possível carregar os criativos.",
      );
      setProjects([]);
    } finally {
      setIsLoadingProjects(false);
    }
  }, []);

  const loadSentinelSuggestions = useCallback(async () => {
    setIsLoadingSentinel(true);
    setSentinelLoadError(null);

    try {
      const response = await fetch("/api/sentinel/suggestions");
      const payload = await parseJsonOrText<{
        suggestions?: MockSentinelSuggestion[];
        meta?: SentinelSuggestionsMeta;
        message?: string;
      }>(response);

      if (!response.ok) {
        throw new Error(payload.message || "Não foi possível carregar os sinais.");
      }

      setSentinelSuggestions(payload.suggestions ?? []);
      setSentinelMeta(payload.meta ?? null);
    } catch (error) {
      setSentinelLoadError(
        error instanceof Error ? error.message : "Não foi possível carregar os sinais.",
      );
      setSentinelSuggestions([]);
      setSentinelMeta(null);
    } finally {
      setIsLoadingSentinel(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
    void loadSentinelSuggestions();
  }, [loadProjects, loadSentinelSuggestions]);

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

  async function handleRefreshSignals() {
    setIsRefreshing(true);
    setRefreshMessage(null);
    setSentinelLoadError(null);

    try {
      const response = await fetch("/api/sentinel/refresh", { method: "POST" });
      const payload = (await response.json()) as {
        message?: string;
        suggestions?: MockSentinelSuggestion[];
        meta?: SentinelSuggestionsMeta;
      };

      if (!response.ok) {
        throw new Error(payload.message || "Não foi possível atualizar os sinais.");
      }

      setSentinelSuggestions(payload.suggestions ?? []);
      setSentinelMeta(payload.meta ?? null);

      const count = payload.suggestions?.length ?? 0;
      setRefreshMessage(
        count > 0
          ? `${count} sinal(is) atualizado(s).`
          : payload.meta?.emptyReason || "Nenhum sinal novo para o radar atual.",
      );
      window.setTimeout(() => setRefreshMessage(null), 4200);
    } catch (error) {
      setRefreshMessage(
        error instanceof Error ? error.message : "Não foi possível atualizar os sinais.",
      );
    } finally {
      setIsRefreshing(false);
    }
  }

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
              onClick={() => void handleRefreshSignals()}
              disabled={isRefreshing}
              data-testid="inicio-refresh-signals"
            >
              {isRefreshing ? "Atualizando..." : "Atualizar sinais"}
            </button>
          </div>
          {refreshMessage ? (
            <p className="persona-helper-text persona-top-gap" role="status">
              {refreshMessage}
            </p>
          ) : null}
            <SentinelSuggestionsList
              suggestions={sentinelSuggestions}
              isLoading={isLoadingSentinel || isRefreshing}
              loadError={sentinelLoadError}
              emptyMessage="Nenhum sinal em cache. Clique em «Atualizar sinais» para buscar pautas."
              loadingMessage={
                isRefreshing
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
            <Link href="/configuracoes?tab=radar" className="app-link-muted">
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
            <p className="persona-helper-text">Carregando projetos...</p>
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
