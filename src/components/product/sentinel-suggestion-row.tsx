import Link from "next/link";
import type { Route } from "next";

import { SentinelInsightBody } from "@/components/product/sentinel-insight-body";
import {
  buildCriativoNovoHref,
  mockSentinelSuggestions,
  type MockSentinelSuggestion,
} from "@/lib/sentinel-mock-suggestions";

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
        title={`Score calculado a partir de engajamento e temas do radar (${suggestion.relevanceScore}/100)`}
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
        title={`Score calculado a partir de engajamento e temas do radar (${suggestion.relevanceScore}/100)`}
      >
        {suggestion.relevanceScore}
      </div>
      <SentinelInsightBody suggestion={suggestion} />
    </div>
  );
}

export function SentinelThemesSketch() {
  return (
    <ul className="persona-sentinel-wire-list persona-top-gap">
      {mockSentinelSuggestions.map((suggestion) => (
        <li key={suggestion.id}>
          <SentinelSuggestionCard suggestion={suggestion} />
        </li>
      ))}
    </ul>
  );
}
