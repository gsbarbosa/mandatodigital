"use client";

import {
  AppLoadingStatus,
  SentinelSuggestionsSkeleton,
} from "@/components/product/app-loading";
import Link from "next/link";
import type { Route } from "next";
import { SentinelInsightBody } from "@/components/product/sentinel-insight-body";
import {
  buildCriativoNovoHref,
  type MockSentinelSuggestion,
} from "@/lib/sentinel-mock-suggestions";
import {
  creativeBlockMessage,
  isCreativeGenerationAllowed,
  partitionSentinelSuggestions,
} from "@/lib/sentinel-editorial-gate";
import type { SentinelSuggestionsMeta } from "@/lib/sentinel-suggestions";

export function SentinelSuggestionCard({
  suggestion,
  showAction = true,
  generationBlocked = false,
  generationBlockedMessage,
  allowMonitoringResponse = false,
}: {
  suggestion: MockSentinelSuggestion;
  showAction?: boolean;
  generationBlocked?: boolean;
  generationBlockedMessage?: string;
  allowMonitoringResponse?: boolean;
}) {
  const creativeAllowed = isCreativeGenerationAllowed(suggestion);
  const blocked = generationBlocked || !creativeAllowed;
  const blockTitle =
    generationBlocked && generationBlockedMessage
      ? generationBlockedMessage
      : creativeBlockMessage(suggestion);
  const criativoHref = `${buildCriativoNovoHref(suggestion.id)}${
    allowMonitoringResponse && !creativeAllowed ? "&monitoring=1" : ""
  }`;

  return (
    <article className="persona-sentinel-wire-item">
      <div
        className="persona-sentinel-wire-score"
        title={`Relevância editorial (${suggestion.relevanceScore}/100)${
          suggestion.editorial?.viralScore !== undefined
            ? ` · viral ${suggestion.editorial.viralScore}`
            : ""
        }`}
      >
        {suggestion.relevanceScore}
      </div>
      <div className="persona-sentinel-wire-card">
        <div className="persona-sentinel-wire-body">
          <SentinelInsightBody suggestion={suggestion} />
        </div>
        {showAction ? (
          blocked ? (
            allowMonitoringResponse && suggestion.pipeline === "social" ? (
              <Link
                href={criativoHref as Route}
                className="persona-sentinel-wire-action is-secondary"
                title={blockTitle}
              >
                <span>Preparar</span>
                <span>resposta</span>
              </Link>
            ) : (
              <span
                className="persona-sentinel-wire-action is-disabled"
                title={blockTitle}
                aria-disabled="true"
              >
                <span>Gerar</span>
                <span>criativo</span>
              </span>
            )
          ) : (
            <Link href={criativoHref as Route} className="persona-sentinel-wire-action">
              <span>Gerar</span>
              <span>criativo</span>
            </Link>
          )
        ) : null}
      </div>
    </article>
  );
}

/** Versão compacta para o editor do Criativo — sem wireframe nem posicionamento absoluto. */
export function SentinelContextPreview({
  suggestion,
}: {
  suggestion: MockSentinelSuggestion;
}) {
  return (
    <div className="persona-sentinel-context-preview">
      <div
        className="persona-sentinel-context-score"
        title={`Score calculado a partir dos temas do radar e recencia da materia (${suggestion.relevanceScore}/100)`}
      >
        {suggestion.relevanceScore}
      </div>
      <SentinelInsightBody suggestion={suggestion} />
    </div>
  );
}

export function SentinelSuggestionsList({
  suggestions,
  isLoading,
  loadError,
  emptyMessage = "Nenhum sinal do Sentinela disponivel. Configure o radar e atualize os sinais.",
  meta,
  loadingMessage,
  generationBlocked = false,
  generationBlockedMessage,
}: {
  suggestions: MockSentinelSuggestion[];
  isLoading: boolean;
  loadError: string | null;
  emptyMessage?: string;
  meta?: SentinelSuggestionsMeta | null;
  loadingMessage?: string;
  generationBlocked?: boolean;
  generationBlockedMessage?: string;
}) {
  if (isLoading) {
    const message = loadingMessage ?? "Carregando sinais do Sentinela...";

    if (suggestions.length > 0) {
      return (
        <>
          <AppLoadingStatus
            message={message}
            className="app-loading-status--compact persona-top-gap"
          />
          <ul className="persona-sentinel-wire-list persona-top-gap is-dimmed">
            {suggestions.map((suggestion) => (
              <li key={suggestion.id}>
                <SentinelSuggestionCard
                  suggestion={suggestion}
                  generationBlocked={generationBlocked}
                  generationBlockedMessage={generationBlockedMessage}
                />
              </li>
            ))}
          </ul>
        </>
      );
    }

    return (
      <div className="persona-top-gap">
        <AppLoadingStatus message={message} className="app-loading-status--compact" />
        <SentinelSuggestionsSkeleton count={3} />
      </div>
    );
  }

  if (loadError) {
    return (
      <p className="persona-helper-text persona-helper-highlight persona-top-gap">{loadError}</p>
    );
  }

  if (suggestions.length === 0) {
    return (
      <p className="persona-helper-text persona-top-gap">
        {meta?.emptyReason || emptyMessage}
      </p>
    );
  }

  const { opportunities, monitoring } = partitionSentinelSuggestions(suggestions);

  return (
    <div className="persona-top-gap">
      {opportunities.length > 0 ? (
        <>
          <p className="persona-sentinel-section-label">Oportunidades editoriais</p>
          <ul className="persona-sentinel-wire-list">
            {opportunities.map((suggestion) => (
              <li key={suggestion.id}>
                <SentinelSuggestionCard
                  suggestion={suggestion}
                  generationBlocked={generationBlocked}
                  generationBlockedMessage={generationBlockedMessage}
                />
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {monitoring.length > 0 ? (
        <>
          <p className="persona-sentinel-section-label persona-top-gap">
            Monitoramento social
          </p>
          <p className="persona-helper-text">
            Alta viralização sem crivo editorial completo — acompanhe a narrativa; use
            «Preparar resposta» se quiser montar posicionamento manualmente.
          </p>
          <ul className="persona-sentinel-wire-list">
            {monitoring.map((suggestion) => (
              <li key={suggestion.id}>
                <SentinelSuggestionCard
                  suggestion={suggestion}
                  generationBlocked={generationBlocked}
                  generationBlockedMessage={generationBlockedMessage}
                  allowMonitoringResponse
                />
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

/** @deprecated Use SentinelSuggestionsList com dados carregados pelo pai */
export function SentinelThemesSketch() {
  return null;
}
