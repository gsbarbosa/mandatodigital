"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  MonitorSignalCard,
  SignalEvidenceDrawer,
} from "@/components/product/monitor-signal-card";
import { useProductApp } from "@/components/product/provider";
import type { MockSentinelSuggestion } from "@/lib/sentinel-mock-suggestions";
import type { SentinelSuggestionsMeta } from "@/lib/sentinel-types";
import { groupSuggestionsBySphere, type MonitorSphere } from "@/lib/sphere-classifier";
import { resolveSentinelThemeSpheres } from "@/lib/sentinel-profile-themes";

const INITIAL_VISIBLE = 3;
const VISIBLE_STEP = 5;

type SuggestionsPayload = {
  message?: string;
  suggestions?: MockSentinelSuggestion[];
  meta?: SentinelSuggestionsMeta;
};

const SECTIONS: Array<{
  sphere: MonitorSphere;
  title: string;
  dotClass: string;
}> = [
  { sphere: "federal", title: "Federal", dotClass: "bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]" },
  { sphere: "estadual", title: "Estadual", dotClass: "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" },
  { sphere: "municipal", title: "Municipal", dotClass: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" },
  { sphere: "adversarios", title: "Adversários", dotClass: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" },
];

function ThemeChips({ themes }: { themes: string[] }) {
  if (!themes.length) {
    return null;
  }
  return (
    <div className="flex flex-wrap gap-2 mb-6 items-center">
      {themes.map((theme) => (
        <span
          key={theme}
          className="px-3 py-1.5 bg-cyan-950/30 border border-cyan-800/50 text-cyan-300 rounded-full text-xs font-medium"
        >
          {theme}
        </span>
      ))}
    </div>
  );
}

export function MonitoramentoPage() {
  const { profileForm } = useProductApp();
  const [suggestions, setSuggestions] = useState<MockSentinelSuggestion[]>([]);
  const [meta, setMeta] = useState<SentinelSuggestionsMeta | null>(null);
  const [loadMessage, setLoadMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [visibleBySphere, setVisibleBySphere] = useState<Record<MonitorSphere, number>>({
    federal: INITIAL_VISIBLE,
    estadual: INITIAL_VISIBLE,
    municipal: INITIAL_VISIBLE,
    adversarios: INITIAL_VISIBLE,
  });
  const [evidenceSuggestion, setEvidenceSuggestion] = useState<MockSentinelSuggestion | null>(null);

  const loadSuggestions = useCallback(async () => {
    setIsLoading(true);
    setLoadMessage(null);
    try {
      const response = await fetch("/api/sentinel/suggestions");
      const payload = (await response.json()) as SuggestionsPayload;
      if (!response.ok) {
        setSuggestions([]);
        setLoadMessage(payload.message || "Configure o radar para começar o monitoramento.");
        return;
      }
      setSuggestions(payload.suggestions ?? []);
      setMeta(payload.meta ?? null);
      if (!payload.suggestions?.length) {
        setLoadMessage(payload.meta?.emptyReason || "Nenhum sinal capturado para o radar atual.");
      }
    } catch {
      setSuggestions([]);
      setLoadMessage("Não foi possível carregar os sinais do monitoramento.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSuggestions();
  }, [loadSuggestions]);

  async function handleRefresh() {
    setIsRefreshing(true);
    setRefreshMessage(null);
    try {
      const response = await fetch("/api/sentinel/refresh", { method: "POST" });
      const payload = (await response.json()) as SuggestionsPayload;
      if (!response.ok) {
        throw new Error(payload.message || "Não foi possível atualizar os sinais.");
      }
      setSuggestions(payload.suggestions ?? []);
      setMeta(payload.meta ?? null);
      const count = payload.suggestions?.length ?? 0;
      setRefreshMessage(
        count > 0
          ? `${count} sinal(is) atualizado(s).`
          : payload.meta?.emptyReason || "Nenhum sinal novo encontrado para o radar atual.",
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

  const grouped = useMemo(
    () => groupSuggestionsBySphere(suggestions, profileForm.interestSites, profileForm.state),
    [suggestions, profileForm.interestSites, profileForm.state],
  );

  const chipsBySphere = useMemo<Record<MonitorSphere, string[]>>(() => {
    const customThemes = profileForm.customRadarThemes.filter((theme) => theme.trim().length > 0);
    const municipalThemes = Array.from(
      new Set(grouped.municipal.flatMap((item) => item.matchedThemes)),
    ).slice(0, 8);
    const themeSpheres = resolveSentinelThemeSpheres(profileForm);
    return {
      federal: [...themeSpheres.federal, ...customThemes],
      estadual: themeSpheres.estadual,
      municipal: municipalThemes,
      adversarios: profileForm.oppositionProfiles
        .map((row) => row.handle.trim())
        .filter(Boolean)
        .map((handle) => (handle.startsWith("@") ? handle : `@${handle}`)),
    };
  }, [
    profileForm.customRadarThemes,
    profileForm.oppositionProfiles,
    profileForm.sentinelThemesFederal,
    profileForm.sentinelThemesEstadual,
    grouped.municipal,
  ]);

  const interestSitesLabel = profileForm.interestSites.filter(Boolean).join(", ");

  return (
    <div className="max-w-5xl mx-auto p-8 relative z-10 pb-20">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-64 bg-cyan-500/5 blur-[120px] pointer-events-none rounded-full" />

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10 relative z-10">
        <h1 className="text-2xl font-bold text-white tracking-tight">Monitoramento de Pautas</h1>
        <div className="flex items-center gap-3">
          {meta?.refreshedAt ? (
            <span className="text-xs text-slate-500">
              Atualizado em {new Date(meta.refreshedAt).toLocaleString("pt-BR")}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={isRefreshing}
            className="px-4 py-2 bg-slate-800/80 text-slate-300 border border-slate-700 rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            {isRefreshing ? "Atualizando sinais..." : "Atualizar sinais"}
          </button>
        </div>
      </header>

      {refreshMessage ? (
        <p className="text-sm text-cyan-300 mb-6 relative z-10" role="status">
          {refreshMessage}
        </p>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-slate-400 relative z-10" role="status">
          Carregando sinais do monitoramento… A primeira busca pode levar até 2 minutos enquanto
          consultamos portais e redes.
        </p>
      ) : null}

      {!isLoading && !suggestions.length ? (
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl py-4 px-5 mb-10 relative z-10">
          <p className="text-sm text-blue-200">
            {loadMessage || "Nenhum sinal capturado ainda."}{" "}
            <Link href="/monitoramento/temas" className="text-cyan-300 underline hover:text-cyan-200">
              Redefinir temas do radar
            </Link>
          </p>
        </div>
      ) : null}

      <div className="space-y-16 relative z-10">
        {SECTIONS.map(({ sphere, title, dotClass }) => {
          const items = grouped[sphere];
          const visible = visibleBySphere[sphere];
          const shown = items.slice(0, visible);
          return (
            <section key={sphere} id={sphere}>
              <h2 className="text-lg font-semibold text-white border-b border-slate-800 pb-2 mb-4 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${dotClass}`} />
                {title}
              </h2>

              <ThemeChips themes={chipsBySphere[sphere]} />

              {isLoading ? (
                <p className="text-sm text-slate-500">Buscando sinais para esta esfera…</p>
              ) : shown.length ? (
                <div className="space-y-4">
                  {shown.map((suggestion) => (
                    <MonitorSignalCard
                      key={suggestion.id}
                      suggestion={suggestion}
                      oppositionCard={sphere === "adversarios"}
                      onOpenEvidence={setEvidenceSuggestion}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  Nenhum sinal nesta esfera por enquanto.{" "}
                  <Link href="/monitoramento/temas" className="text-cyan-400 no-underline hover:underline">
                    Ajustar radar
                  </Link>
                </p>
              )}

              {items.length > visible ? (
                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={() =>
                      setVisibleBySphere((current) => ({
                        ...current,
                        [sphere]: current[sphere] + VISIBLE_STEP,
                      }))
                    }
                    className="px-6 py-2 bg-slate-800/80 text-slate-300 border border-slate-700 rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors flex items-center gap-2"
                  >
                    Ver Mais
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              ) : null}
            </section>
          );
        })}

        <footer className="mt-12 pt-8 border-t border-slate-800 text-xs text-slate-500 space-y-2">
          <p>
            * Engajamento é a métrica que reflete o acúmulo de interações e movimentações nas redes
            sociais (soma de curtidas, comentários e compartilhamentos), considerando: (Curtidas) +
            (2 × Comentários) + (3 × Compartilhamentos)
          </p>
          <p>
            Esfera Federal: www.cnn.com.br, www.bandnews.com.br, www.jovempan.com.br,
            https://g1.globo.com, www.estadao.com.br
          </p>
          <p>
            Esfera Estadual: consideramos os principais portais de notícias de cada Estado (mínimo de
            5 portais por Estado)
          </p>
          {interestSitesLabel ? <p>Esfera Municipal: {interestSitesLabel}</p> : null}
        </footer>
      </div>

      <SignalEvidenceDrawer
        suggestion={evidenceSuggestion}
        onClose={() => setEvidenceSuggestion(null)}
      />
    </div>
  );
}
