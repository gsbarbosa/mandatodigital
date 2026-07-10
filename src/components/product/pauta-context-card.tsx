"use client";

import type { MockSentinelSuggestion } from "@/lib/sentinel-mock-suggestions";
import { articleOutletLabel } from "@/lib/sphere-classifier";
import { resolveArticleMatchingSearchTerm } from "@/lib/sentinel-theme-synonyms";
import {
  primarySignalActor,
  primarySignalArticle,
} from "@/components/product/monitor-signal-card";

function formatPautaDate(iso?: string): string | null {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const day = date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${day} - ${time}h`;
}

function ClockIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function CheckBadgeIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function buildSuggestionHaystack(suggestion: MockSentinelSuggestion): string {
  const article = primarySignalArticle(suggestion);
  if (article) {
    return `${article.title} ${article.sourceName ?? ""}`;
  }
  return suggestion.topic;
}

function resolveDisplayMatchingTerm(suggestion: MockSentinelSuggestion): string | null {
  const persisted = suggestion.matchingSearchTerm?.trim();
  if (persisted) {
    return persisted.toLowerCase() === suggestion.themeLabel.trim().toLowerCase() ? null : persisted;
  }

  return resolveArticleMatchingSearchTerm(
    buildSuggestionHaystack(suggestion),
    suggestion.themeLabel,
  );
}

export function PautaContextCard({ suggestion }: { suggestion: MockSentinelSuggestion }) {
  const article = primarySignalArticle(suggestion);
  const actor = primarySignalActor(suggestion);
  const dateLabel = formatPautaDate(article?.publishedAt ?? actor?.publishedAt);
  const matchingTerm = resolveDisplayMatchingTerm(suggestion);
  const isNewsCard = Boolean(article);

  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-slate-800 bg-gradient-to-b from-slate-900/50 to-slate-900/20 backdrop-blur-xl shadow-xl mb-8">
      <div
        className="h-1 w-full bg-gradient-to-r from-purple-500 via-cyan-500 to-amber-500"
        aria-hidden="true"
      />
      <div className="p-6 md:p-8">
        <div className="flex flex-col md:flex-row justify-between gap-6">
          <div className="shrink-0 flex flex-col justify-center border-b md:border-b-0 md:border-r border-slate-700/50 pb-4 md:pb-0 md:pr-6 md:w-52">
            <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-1">
              Tema principal
            </span>
            <p className="text-cyan-400 text-sm font-semibold mb-1">{suggestion.themeLabel}</p>
            {matchingTerm ? (
              <p className="text-slate-300 text-xs leading-relaxed mb-3">{matchingTerm}</p>
            ) : (
              <div className="mb-3" />
            )}
            {dateLabel ? (
              <div className="flex items-center gap-2 text-slate-500 text-xs">
                <ClockIcon />
                {dateLabel}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-slate-500 text-xs">
                <ClockIcon />
                Pauta recente
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            {isNewsCard && article ? (
              <>
                <h2 className="text-lg font-bold text-slate-100 mb-2 leading-snug">{article.title}</h2>
                <p className="text-sm text-slate-400 mb-4 line-clamp-3">{suggestion.topic}</p>
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <span className="text-slate-500">
                    Fonte:{" "}
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-cyan-400 no-underline hover:underline"
                    >
                      {articleOutletLabel(article)}
                    </a>
                  </span>
                  <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-400/20">
                    <CheckBadgeIcon />
                    Notícia verificada
                  </span>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-bold text-slate-100 mb-2 leading-snug">
                  {suggestion.topic}
                </h2>
                {actor ? (
                  <p className="text-sm text-slate-400 mb-4">
                    @{actor.handle} · {actor.network}
                  </p>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
