"use client";

import type { Route } from "next";
import Link from "next/link";

import type {
  MockSentinelSuggestion,
  SentinelNewsArticle,
  SentinelSocialNetwork,
  SentinelVerifiedActor,
} from "@/lib/sentinel-mock-suggestions";
import { buildCriativoNovoHref } from "@/lib/sentinel-mock-suggestions";
import {
  articleOutletLabel,
  normalizeDomain,
  weightedEngagement,
} from "@/lib/sphere-classifier";

const NETWORK_LABELS: Record<SentinelSocialNetwork, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  x: "Twitter/X",
};

function formatSignalDate(iso?: string): string | null {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const day = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${day} - ${time}h`;
}

function formatCount(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1).replace(".", ",").replace(",0", "")}k`;
  }
  return String(value);
}

function ClockIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function CheckBadgeIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  );
}

export function primarySignalArticle(
  suggestion: MockSentinelSuggestion,
): SentinelNewsArticle | null {
  return suggestion.evidence.articles?.[0] ?? null;
}

export function primarySignalActor(
  suggestion: MockSentinelSuggestion,
): SentinelVerifiedActor | null {
  return suggestion.evidence.actors?.[0] ?? null;
}

function PautarButton({ suggestionId }: { suggestionId: string }) {
  return (
    <Link
      href={buildCriativoNovoHref(suggestionId) as Route}
      className="w-full md:w-auto bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold py-2.5 px-6 rounded-lg transition-all shadow-[0_0_15px_rgba(6,182,212,0.2)] flex items-center justify-center gap-2 no-underline"
    >
      Pautar
    </Link>
  );
}

export function MonitorSignalCard({
  suggestion,
  oppositionCard = false,
  showPautar = true,
  onOpenEvidence,
}: {
  suggestion: MockSentinelSuggestion;
  oppositionCard?: boolean;
  showPautar?: boolean;
  onOpenEvidence?: (suggestion: MockSentinelSuggestion) => void;
}) {
  const article = primarySignalArticle(suggestion);
  const actor = primarySignalActor(suggestion);
  const isNewsCard = Boolean(article);
  const dateLabel = formatSignalDate(article?.publishedAt);
  const engagement = suggestion.engagement;
  const engagementScore = weightedEngagement(
    engagement.likes,
    engagement.comments,
    engagement.shares,
  );

  return (
    <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5 hover:border-slate-600 transition-colors">
      <div className="flex flex-col md:flex-row justify-between gap-6">
        <div className="shrink-0 flex flex-col justify-center border-b md:border-b-0 md:border-r border-slate-700/50 pb-4 md:pb-0 md:pr-6 md:w-48">
          <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-1">
            {oppositionCard ? "Ação da Oposição" : "Tema Principal"}
          </span>
          {oppositionCard ? null : (
            <p className="text-cyan-400 text-sm font-medium mb-3">{suggestion.themeLabel}</p>
          )}
          {dateLabel ? (
            <div className={`flex items-center gap-2 text-slate-500 text-xs ${oppositionCard ? "mt-2" : ""}`}>
              <ClockIcon />
              {dateLabel}
            </div>
          ) : (
            <div className={`flex items-center gap-2 text-slate-500 text-xs ${oppositionCard ? "mt-2" : ""}`}>
              <ClockIcon />
              Sinal recente
            </div>
          )}
        </div>

        <div className="flex-1">
          {isNewsCard && article ? (
            <>
              <h3 className="text-lg font-bold text-slate-100 mb-1">{article.title}</h3>
              <p className="text-sm text-slate-400 mb-3 line-clamp-2">{suggestion.topic}</p>
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <span className="text-slate-500">
                  Fonte:{" "}
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-400 no-underline hover:underline"
                  >
                    {articleOutletLabel(article)}
                  </a>
                </span>
                <button
                  type="button"
                  onClick={() => onOpenEvidence?.(suggestion)}
                  className="flex items-center gap-1 text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-400/20 cursor-pointer hover:bg-emerald-400/20 transition-colors"
                >
                  <CheckBadgeIcon />
                  Notícia verificada
                </button>
              </div>
            </>
          ) : (
            <>
              <h3 className="text-lg font-bold text-slate-100 mb-1">{suggestion.topic}</h3>
              <p className="text-sm text-slate-400 mb-3">
                {actor
                  ? `Post de @${actor.handle} (${NETWORK_LABELS[actor.network]})`
                  : suggestion.themeLabel}
              </p>

              <div className="flex flex-wrap items-center gap-4 text-xs mb-3">
                <span className="text-slate-500">
                  Engajamento*: <strong className="text-white">{formatCount(engagementScore)}</strong>
                </span>
                {actor ? (
                  <a
                    href={actor.postUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-400 no-underline hover:underline flex items-center gap-1"
                  >
                    <LinkIcon />
                    Link do post
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() => onOpenEvidence?.(suggestion)}
                  className="flex items-center gap-1 text-slate-400 bg-slate-700/30 px-2 py-0.5 rounded border border-slate-600/50 cursor-pointer hover:text-white transition-colors"
                >
                  <SearchIcon />
                  Verificar notícia
                </button>
              </div>

              <div className="flex items-center gap-5 mt-2 pt-3 border-t border-slate-700/50 text-xs text-slate-400">
                <div className="flex items-center gap-1.5" title="Curtidas">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                  <span>{formatCount(engagement.likes)}</span>
                </div>
                <div className="flex items-center gap-1.5" title="Comentários">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z" />
                  </svg>
                  <span>{formatCount(engagement.comments)}</span>
                </div>
                <div className="flex items-center gap-1.5" title="Compartilhamentos">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  <span>{formatCount(engagement.shares)}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {showPautar ? (
          <div className="shrink-0 flex items-center justify-center md:pl-4">
            <PautarButton suggestionId={suggestion.id} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function SignalEvidenceDrawer({
  suggestion,
  onClose,
}: {
  suggestion: MockSentinelSuggestion | null;
  onClose: () => void;
}) {
  if (!suggestion) {
    return null;
  }
  const articles = suggestion.evidence.articles ?? [];
  const actors = suggestion.evidence.actors ?? [];
  const trend = suggestion.evidence.searchTrend;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Fechar evidências"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <aside className="relative w-full max-w-md h-full overflow-y-auto bg-[#0B0F19] border-l border-slate-800 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <p className="text-[10px] font-bold tracking-wider text-slate-500 uppercase mb-1">
              Evidências do sinal
            </p>
            <h3 className="text-lg font-bold text-white">{suggestion.themeLabel}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white text-sm border border-slate-700 rounded-lg px-3 py-1.5 transition-colors"
          >
            Fechar
          </button>
        </div>

        <p className="text-xs text-slate-500 mb-6">
          A verificação lista as fontes reais capturadas pelo monitoramento. O fact-check por IA do
          conteúdo acontece na aprovação do roteiro, antes da produção do vídeo.
        </p>

        {articles.length ? (
          <div className="mb-6">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
              Matérias detectadas ({articles.length})
            </h4>
            <ul className="space-y-3">
              {articles.map((item) => (
                <li key={item.url} className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-slate-200 hover:text-cyan-300 font-medium"
                  >
                    {item.title}
                  </a>
                  <p className="text-xs text-slate-500 mt-1">
                    {articleOutletLabel(item)}
                    {formatSignalDate(item.publishedAt) ? ` · ${formatSignalDate(item.publishedAt)}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {actors.length ? (
          <div className="mb-6">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
              Posts verificáveis ({actors.length})
            </h4>
            <ul className="space-y-2">
              {actors.map((item) => (
                <li key={`${item.handle}-${item.postUrl}`} className="flex items-center justify-between gap-3 bg-slate-800/40 border border-slate-700/50 rounded-lg p-3">
                  <span className="text-sm text-slate-300">
                    @{item.handle}
                    <span className="text-slate-500 text-xs"> · {NETWORK_LABELS[item.network]}</span>
                  </span>
                  <a
                    href={item.postUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-400 no-underline hover:underline shrink-0"
                  >
                    Abrir post
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="border-t border-slate-800 pt-4 space-y-2 text-xs text-slate-500">
          <p>Posts analisados: {suggestion.evidence.postsAnalyzed}</p>
          {typeof suggestion.evidence.outletCount === "number" ? (
            <p>Portais distintos: {suggestion.evidence.outletCount}</p>
          ) : null}
          <p>Tendência de engajamento: {suggestion.evidence.engagementTrendPercent}%</p>
          {trend ? (
            <p>
              Buscas &quot;{trend.keyword}&quot; ({trend.geoLabel}): {trend.changePercent > 0 ? "+" : ""}
              {trend.changePercent}% em {trend.periodDays} dias
            </p>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
