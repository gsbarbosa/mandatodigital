"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  PersonaCriativoIcon,
  formatStatus,
  parseJsonOrText,
} from "@/components/product/persona-shared";
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
    <section className="persona-page agent-theme-criativo">
      <div className="persona-container">
        <div className="persona-card">
          <h2 className="sr-only">Criativos</h2>

          <div className="persona-section-header">
            <div className="persona-header-icon" aria-hidden="true">
              <PersonaCriativoIcon />
            </div>
            <h2>Meus criativos</h2>
            <p>
              Vídeos já produzidos com seus avatares por foto. Para gerar um novo, use um dos
              modelos Caricato, 3D ou Foto Real.
            </p>
          </div>

          <div className="persona-cta-row persona-top-gap">
            <Link href="/criativo/novo" className="persona-btn persona-btn-large">
              Novo criativo
            </Link>
            <Link href="/independente" className="persona-btn persona-btn-secondary">
              Conteúdo independente
            </Link>
          </div>

          <div className="persona-section-header persona-top-gap">
            <h2>Criativos gerados</h2>
          </div>

          {loadError ? (
            <p className="persona-helper-text persona-helper-highlight persona-top-gap">
              {loadError}
            </p>
          ) : null}

          {isLoading ? (
            <p className="persona-helper-text persona-top-gap">Carregando criativos...</p>
          ) : null}

          {!isLoading && !loadError && projects.length === 0 ? (
            <p className="persona-helper-text persona-top-gap">
              Nenhum criativo gerado ainda. Clique em Novo criativo para começar.
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
                        {project.voiceTones.length > 0
                          ? ` · ${project.voiceTones.join(", ")}`
                          : ""}
                      </p>
                    ) : null}
                  </div>
                  {project.videoUrl ? (
                    <span className="flex items-center gap-2">
                      <a
                        href={project.videoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="persona-btn persona-btn-secondary"
                      >
                        Ver vídeo
                      </a>
                      {project.captionUrl ? (
                        <button
                          type="button"
                          className="text-xs text-cyan-400 hover:underline"
                          onClick={() => void navigator.clipboard.writeText(project.captionUrl)}
                        >
                          Copiar legenda
                        </button>
                      ) : null}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </section>
  );
}
