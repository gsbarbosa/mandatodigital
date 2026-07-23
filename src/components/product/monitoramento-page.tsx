"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  MonitorSignalCard,
  SignalEvidenceDrawer,
} from "@/components/product/monitor-signal-card";
import { RefreshPautasButton } from "@/components/product/refresh-pautas-button";
import { SentinelRefreshProgress } from "@/components/product/sentinel-refresh-progress";
import { useOnboarding } from "@/components/product/onboarding-provider";
import { useProductApp } from "@/components/product/provider";
import type { GuestSentinelCredits } from "@/lib/guest-limits";
import { needsDailySentinelRefresh } from "@/lib/guest-limits";
import type { MockSentinelSuggestion } from "@/lib/sentinel-mock-suggestions";
import type { SentinelSuggestionsMeta } from "@/lib/sentinel-types";
import { groupSuggestionsBySphere, type MonitorSphere } from "@/lib/sphere-classifier";
import { resolveSentinelThemeSpheres } from "@/lib/sentinel-profile-themes";
import {
  isDevAccountModeEmail,
  readDevAccountModeFromDocumentCookie,
} from "@/lib/dev-account-mode";

const INITIAL_VISIBLE = 3;
const VISIBLE_STEP = 5;

type SuggestionsPayload = {
  message?: string;
  suggestions?: MockSentinelSuggestion[];
  meta?: SentinelSuggestionsMeta;
  credits?: GuestSentinelCredits | null;
  skipped?: boolean;
};

const SECTIONS: Array<{
  sphere: MonitorSphere;
  title: string;
  dotClass: string;
}> = [
  { sphere: "federal", title: "Nacional", dotClass: "bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]" },
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
  const { profileForm, sessionUser } = useProductApp();
  const { guideOpen, guideStepId, markStepDone } = useOnboarding();
  const [suggestions, setSuggestions] = useState<MockSentinelSuggestion[]>([]);
  const [meta, setMeta] = useState<SentinelSuggestionsMeta | null>(null);
  const [credits, setCredits] = useState<GuestSentinelCredits | null>(null);
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
  const dailyCheckInFlight = useRef(false);

  const isGuestUi = useMemo(() => {
    const email = sessionUser?.email ?? "";
    if (isDevAccountModeEmail(email)) {
      return readDevAccountModeFromDocumentCookie() !== "premium";
    }
    return true;
  }, [sessionUser?.email]);

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
      if (payload.credits) {
        setCredits(payload.credits);
      }
      if (!payload.suggestions?.length) {
        setLoadMessage(payload.meta?.emptyReason || "Nenhuma pauta capturada para o radar atual.");
      }
    } catch {
      setSuggestions([]);
      setLoadMessage("Não foi possível carregar as pautas do monitoramento.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const runDailyRefreshIfNeeded = useCallback(
    async (refreshedAt: string | null | undefined) => {
      if (dailyCheckInFlight.current) {
        return;
      }
      if (!needsDailySentinelRefresh(refreshedAt)) {
        return;
      }
      dailyCheckInFlight.current = true;
      setIsRefreshing(true);
      try {
        const response = await fetch("/api/sentinel/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "daily" }),
        });
        const payload = (await response.json()) as SuggestionsPayload;
        if (!response.ok) {
          return;
        }
        if (payload.skipped) {
          if (payload.credits) {
            setCredits(payload.credits);
          }
          return;
        }
        setSuggestions(payload.suggestions ?? []);
        setMeta(payload.meta ?? null);
        if (payload.credits) {
          setCredits(payload.credits);
        }
        const count = payload.suggestions?.length ?? 0;
        if (count > 0) {
          setRefreshMessage(`Pautas atualizadas automaticamente (${count}).`);
          window.setTimeout(() => setRefreshMessage(null), 4200);
        }
      } catch {
        // Silencioso — usuário ainda vê o cache.
      } finally {
        dailyCheckInFlight.current = false;
        setIsRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void (async () => {
      await loadSuggestions();
    })();
  }, [loadSuggestions]);

  // Após carregar meta, dispara daily se necessário.
  useEffect(() => {
    if (isLoading) {
      return;
    }
    void runDailyRefreshIfNeeded(meta?.refreshedAt);
  }, [isLoading, meta?.refreshedAt, runDailyRefreshIfNeeded]);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== "visible") {
        return;
      }
      void runDailyRefreshIfNeeded(meta?.refreshedAt);
    }
    function onFocus() {
      void runDailyRefreshIfNeeded(meta?.refreshedAt);
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [meta?.refreshedAt, runDailyRefreshIfNeeded]);

  async function handleRefresh() {
    if (isRefreshing) {
      return;
    }

    setIsRefreshing(true);
    setRefreshMessage(null);
    try {
      const response = await fetch("/api/sentinel/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "manual" }),
      });
      const payload = (await response.json()) as SuggestionsPayload;
      if (payload.credits) {
        setCredits(payload.credits);
      }
      if (!response.ok) {
        throw new Error(payload.message || "Não foi possível atualizar as pautas.");
      }
      setSuggestions(payload.suggestions ?? []);
      setMeta(payload.meta ?? null);
      const count = payload.suggestions?.length ?? 0;
      setRefreshMessage(
        count > 0
          ? `${count} pauta(s) atualizada(s).`
          : payload.meta?.emptyReason || "Nenhuma pauta nova encontrada para o radar atual.",
      );
      window.setTimeout(() => setRefreshMessage(null), 4200);
    } catch (error) {
      setRefreshMessage(
        error instanceof Error ? error.message : "Não foi possível atualizar as pautas.",
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  const grouped = useMemo(() => {
    const themeSpheres = resolveSentinelThemeSpheres(profileForm);
    return groupSuggestionsBySphere(
      suggestions,
      profileForm.interestSites,
      profileForm.state,
      profileForm.customRadarThemes,
      {
        federal: themeSpheres.federal,
        estadual: themeSpheres.estadual,
      },
    );
  }, [
    suggestions,
    profileForm.interestSites,
    profileForm.state,
    profileForm.customRadarThemes,
    profileForm.sentinelThemesFederal,
    profileForm.sentinelThemesEstadual,
    profileForm.sentinelThemes,
  ]);

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
      adversarios: [
        ...profileForm.oppositionThemes.filter((theme) => theme.trim()),
        ...profileForm.oppositionProfiles
          .map((row) => row.handle.trim())
          .filter(Boolean)
          .map((handle) => (handle.startsWith("@") ? handle : `@${handle}`)),
      ],
    };
  }, [
    profileForm.customRadarThemes,
    profileForm.oppositionProfiles,
    profileForm.oppositionThemes,
    profileForm.sentinelThemesFederal,
    profileForm.sentinelThemesEstadual,
    grouped.municipal,
  ]);

  const interestSitesLabel = profileForm.interestSites.filter(Boolean).join(", ");

  const firstPautarSuggestionId = useMemo(() => {
    for (const { sphere } of SECTIONS) {
      const first = grouped[sphere][0];
      if (first) {
        return first.id;
      }
    }
    return null;
  }, [grouped]);

  const creditsLabel =
    isGuestUi && credits
      ? `${credits.remaining}/${credits.limit} créditos`
      : undefined;

  return (
    <div className="max-w-5xl mx-auto p-8 relative z-10 pb-20">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-64 bg-cyan-500/5 blur-[120px] pointer-events-none rounded-full" />

      <header className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8 relative z-10">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight mb-2">
            Monitoramento de Pautas
          </h1>
          <p className="text-sm leading-snug text-slate-300">
            Defina pautas, assuntos, temas para monitoramento e criação de conteúdo com seu avatar.
          </p>
          <p className="text-xs leading-snug text-slate-400">
            <span className="font-semibold text-slate-300">Aviso:</span> atualização automática
            diária após as 8h.{" "}
            {isGuestUi ? (
              <>
                Na versão convidados, o botão <strong className="font-semibold text-cyan-300/90">Atualizar pautas</strong>{" "}
                usa créditos ({credits ? `${credits.remaining} restantes` : "até 5"}).
              </>
            ) : (
              <>Assinantes podem forçar atualização a qualquer momento.</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0 md:pt-1">
          {meta?.refreshedAt ? (
            <span className="text-xs text-slate-500">
              Atualizado em {new Date(meta.refreshedAt).toLocaleString("pt-BR")}
            </span>
          ) : null}
          <RefreshPautasButton
            variant="monitor"
            isLoading={isRefreshing}
            creditsLabel={creditsLabel}
            disabled={Boolean(isGuestUi && credits && credits.remaining <= 0)}
            onClick={() => void handleRefresh()}
          />
        </div>
      </header>

      <div className="mb-10 space-y-4 relative z-10">
        {refreshMessage && !isRefreshing ? (
          <p className="text-sm text-cyan-300 px-1" role="status">
            {refreshMessage}
          </p>
        ) : null}

        <SentinelRefreshProgress active={isRefreshing} />

        {isLoading && !isRefreshing ? (
          <div
            className="flex flex-col items-center justify-center gap-4 rounded-xl border border-cyan-500/20 bg-cyan-950/20 px-5 py-8 text-center"
            role="status"
          >
            <span
              className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-400"
              aria-hidden="true"
            />
            <p className="text-sm leading-relaxed text-slate-300">
              Carregando pautas do monitoramento…
              <br />
              A primeira busca pode levar até 2 minutos enquanto consultamos portais e redes.
            </p>
          </div>
        ) : null}

        {!isLoading && !suggestions.length ? (
          <div className="rounded-xl border border-blue-500/25 bg-blue-900/20 px-5 py-4">
            <p className="text-sm leading-relaxed text-blue-200">
              {loadMessage || "Nenhuma pauta capturada ainda."}{" "}
              <Link href="/monitoramento/temas" className="text-cyan-300 underline hover:text-cyan-200">
                Selecionar temas
              </Link>
            </p>
          </div>
        ) : null}
      </div>

      <div className="space-y-12 relative z-10">
        {SECTIONS.map(({ sphere, title, dotClass }) => {
          const items = grouped[sphere];
          const visible = visibleBySphere[sphere];
          const shown = items.slice(0, visible);
          return (
            <section key={sphere} id={sphere}>
              <h2 className="text-lg font-semibold text-white border-b border-slate-800 pb-3 mb-5 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${dotClass}`} />
                {title}
              </h2>

              <ThemeChips themes={chipsBySphere[sphere]} />

              {!isLoading && shown.length ? (
                <div className="space-y-4">
                  {shown.map((suggestion) => (
                    <MonitorSignalCard
                      key={suggestion.id}
                      suggestion={suggestion}
                      oppositionCard={sphere === "adversarios"}
                      onOpenEvidence={setEvidenceSuggestion}
                      pautarOnboardingAnchor={
                        guideOpen &&
                        guideStepId === "pautas-pautar" &&
                        suggestion.id === firstPautarSuggestionId
                          ? "pautas-pautar"
                          : undefined
                      }
                      onPautar={
                        guideOpen && guideStepId === "pautas-pautar"
                          ? () => markStepDone("pautas-pautar")
                          : undefined
                      }
                    />
                  ))}
                </div>
              ) : null}

              {!isLoading && items.length > visible ? (
                <button
                  type="button"
                  className="mt-4 text-sm text-cyan-400 hover:text-cyan-300"
                  onClick={() =>
                    setVisibleBySphere((current) => ({
                      ...current,
                      [sphere]: current[sphere] + VISIBLE_STEP,
                    }))
                  }
                >
                  Ver mais ({items.length - visible})
                </button>
              ) : null}

              {!isLoading && !items.length ? (
                <p className="text-sm text-slate-500">Nenhuma pauta nesta esfera ainda.</p>
              ) : null}
            </section>
          );
        })}
      </div>

      {interestSitesLabel ? (
        <p className="mt-10 text-xs text-slate-500 relative z-10">
          Portais municipais: {interestSitesLabel}
        </p>
      ) : null}

      <SignalEvidenceDrawer
        suggestion={evidenceSuggestion}
        onClose={() => setEvidenceSuggestion(null)}
      />
    </div>
  );
}
