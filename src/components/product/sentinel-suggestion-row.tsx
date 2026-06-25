"use client";

import Link from "next/link";
import type { Route } from "next";
import { SentinelInsightBody } from "@/components/product/sentinel-insight-body";
import {
  buildCriativoNovoHref,
  type MockSentinelSuggestion,
} from "@/lib/sentinel-mock-suggestions";
import type { SentinelSuggestionsMeta } from "@/lib/sentinel-suggestions";

export function SentinelSuggestionCard({
  suggestion,
  showAction = true,
}: {
  suggestion: MockSentinelSuggestion;
  showAction?: boolean;
}) {
  return (
    <article className="persona-sentinel-wire-item">
      <div
        className="persona-sentinel-wire-score"
        title={`Score calculado a partir dos temas do radar e recencia da materia (${suggestion.relevanceScore}/100)`}
      >
        {suggestion.relevanceScore}
      </div>
      <div className="persona-sentinel-wire-card">
        <div className="persona-sentinel-wire-body">
          <SentinelInsightBody suggestion={suggestion} />
        </div>
        {showAction ? (
          <Link
            href={buildCriativoNovoHref(suggestion.id) as Route}
            className="persona-sentinel-wire-action"
          >
            <span>Gerar</span>
            <span>criativo</span>
          </Link>
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
}: {
  suggestions: MockSentinelSuggestion[];
  isLoading: boolean;
  loadError: string | null;
  emptyMessage?: string;
  meta?: SentinelSuggestionsMeta | null;
}) {
  if (isLoading) {
    return <p className="persona-helper-text persona-top-gap">Carregando sinais do Sentinela...</p>;
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

  return (
    <ul className="persona-sentinel-wire-list persona-top-gap">
      {suggestions.map((suggestion) => (
        <li key={suggestion.id}>
          <SentinelSuggestionCard suggestion={suggestion} />
        </li>
      ))}
    </ul>
  );
}

/** @deprecated Use SentinelSuggestionsList com dados carregados pelo pai */
export function SentinelThemesSketch() {
  return null;
}
