"use client";

import type { Route } from "next";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useProductShell } from "@/components/product/product-shell-context";
import {
  AppLoadingStatus,
  CreativeListSkeleton,
} from "@/components/product/app-loading";
import {
  PersonaCriativoIcon,
  formatStatus,
  parseJsonOrText,
} from "@/components/product/persona-shared";
import { PersonaSectionHeader } from "@/components/product/persona-section-header";
import { PublishCreativeSoonButton } from "@/components/product/publish-creative-soon-button";
import { formatCreativeProjectTitle } from "@/lib/creative-project-display";
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

function projectStatusLabel(status: CreativeProject["status"]) {
  switch (status) {
    case "ready":
      return "Pronto";
    case "generating":
      return "Gerando";
    case "failed":
      return "Falhou";
    default:
      return formatStatus(status);
  }
}

function CriativoListBody({
  loadError,
  isLoading,
  projects,
}: {
  loadError: string | null;
  isLoading: boolean;
  projects: CreativeProject[];
}) {
  return (
    <>
      {loadError ? (
        <p className="persona-helper-text persona-helper-highlight persona-top-gap">
          {loadError}
        </p>
      ) : null}

      {isLoading ? (
        <>
          <AppLoadingStatus
            message="Carregando criativos..."
            className="app-loading-status--compact persona-top-gap"
          />
          <CreativeListSkeleton count={4} />
        </>
      ) : null}

      {!isLoading && !loadError && projects.length === 0 ? (
        <p className="persona-helper-text persona-top-gap">
          Nenhum criativo ainda.{" "}
          <Link href={"/inicio" as Route} className="app-link-muted">
            Volte ao Início
          </Link>{" "}
          e clique em Novo criativo.
        </p>
      ) : null}

      {!isLoading && projects.length > 0 ? (
        <ul className="persona-creative-list persona-top-gap">
          {projects.map((project) => (
            <li key={project.id} className="persona-creative-list-item">
              <div className="persona-creative-list-main">
                <p className="persona-creative-list-topic">
                  {formatCreativeProjectTitle(project)}
                </p>
                <p className="persona-helper-text">
                  {formatProjectDate(project.createdAt)} ·{" "}
                  <span className={`persona-creative-status is-${project.status}`}>
                    {projectStatusLabel(project.status)}
                  </span>
                </p>
                {project.personaArchetypes.length > 0 ? (
                  <p className="persona-helper-text">
                    {project.personaArchetypes.join(", ")}
                    {project.voiceTones.length > 0 ? ` · ${project.voiceTones.join(", ")}` : ""}
                  </p>
                ) : null}
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
    </>
  );
}

export function CriativoListPage() {
  const { hasPageHeader } = useProductShell();
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
        throw new Error(payload.message || "Não foi possível carregar os criativos.");
      }

      setProjects(payload.projects ?? []);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Não foi possível carregar os criativos.",
      );
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const body = (
    <CriativoListBody loadError={loadError} isLoading={isLoading} projects={projects} />
  );

  if (hasPageHeader) {
    return (
      <div className="app-page agent-theme-criativo">
        <section
          className="app-panel app-panel-span-full app-panel-flush-top"
          aria-labelledby="criativo-list-heading"
        >
          <h2 id="criativo-list-heading" className="sr-only">
            Meus criativos
          </h2>
          {body}
        </section>
      </div>
    );
  }

  return (
    <section className="persona-page agent-theme-criativo">
      <div className="persona-container">
        <div className="persona-card">
          <PersonaSectionHeader
            icon={<PersonaCriativoIcon />}
            title="Meus criativos"
            description="Histórico de roteiros e vídeos já produzidos. Para iniciar uma peça nova, use o Início — sinais de pauta e Novo criativo ficam lá."
            showWhenShellHeader
          />
          {body}
        </div>
      </div>
    </section>
  );
}
