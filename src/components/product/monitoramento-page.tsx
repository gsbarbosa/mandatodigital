"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  MonitorSignalCard,
  SignalEvidenceDrawer,
  primarySignalActor,
  primarySignalArticle,
} from "@/components/product/monitor-signal-card";
import { RefreshPautasButton } from "@/components/product/refresh-pautas-button";
import { ProductPageHeader } from "@/components/product/product-page-header";
import { SentinelRefreshProgress } from "@/components/product/sentinel-refresh-progress";
import { useOnboarding } from "@/components/product/onboarding-provider";
import { useProductApp } from "@/components/product/provider";
import { DEMO_REFRESH_PAUTA_HINT, isDemoModeActiveForEmail } from "@/lib/demo-mode";
import {
  GUEST_CREDITS_EXHAUSTED_ACTION_MESSAGE,
  needsDailySentinelRefresh,
  type GuestSentinelCredits,
} from "@/lib/guest-limits";
import type { MockSentinelSuggestion } from "@/lib/sentinel-mock-suggestions";
import type { SentinelSuggestionsMeta } from "@/lib/sentinel-types";
import { groupSuggestionsBySphere, type MonitorSphere } from "@/lib/sphere-classifier";
import {
  hasAnyMonitoringRadarConfigured,
  resolveSentinelThemeSpheres,
} from "@/lib/sentinel-profile-themes";
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
  { sphere: "interesse", title: "Interesse", dotClass: "bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.8)]" },
  { sphere: "adversarios", title: "Adversários", dotClass: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" },
];

/** Mesma origem de data usada no card (artigo ou ator primário) para ordenar por publicação. */
function suggestionPublishedAtMs(suggestion: MockSentinelSuggestion): number {
  const iso = primarySignalArticle(suggestion)?.publishedAt ?? primarySignalActor(suggestion)?.publishedAt;
  if (!iso) {
    return 0;
  }
  const time = new Date(iso).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function sortByPublishedAtDesc(items: MockSentinelSuggestion[]): MockSentinelSuggestion[] {
  return [...items].sort((a, b) => suggestionPublishedAtMs(b) - suggestionPublishedAtMs(a));
}

function ThemeChips({ themes }: { themes: string[] }) {
  const uniqueThemes = Array.from(new Set(themes.map((theme) => theme.trim()).filter(Boolean)));
  if (!uniqueThemes.length) {
    return null;
  }
  return (
    <div className="flex flex-wrap gap-2 mb-6 items-center">
      {uniqueThemes.map((theme) => (
        <span
          key={theme}
          className="px-3 py-1.5 bg-[var(--sentinela-soft)] border border-[var(--sentinela-border)] text-[var(--sentinela-text)] rounded-full text-xs font-medium"
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
    interesse: INITIAL_VISIBLE,
    adversarios: INITIAL_VISIBLE,
  });
  const [evidenceSuggestion, setEvidenceSuggestion] = useState<MockSentinelSuggestion | null>(null);
  const dailyCheckInFlight = useRef(false);
  /**
   * Falha do daily (rate limit, rede etc.) não deve virar loop: o efeito abaixo
   * refaz a chamada toda vez que isRefreshing volta a false, e a resposta de erro
   * nunca atualiza meta.refreshedAt — sem essa trava, tentava de novo a cada ciclo,
   * infinitamente, mesmo quando o servidor pede pra esperar ~24h (platform_rate_limit).
   */
  const dailyAttemptBlocked = useRef(false);

  /**
   * Sem nenhum radar configurado, o refresh automático nunca encontra nada pra marcar
   * como concluído (meta.refreshedAt fica vazio) e o efeito abaixo tenta de novo a cada
   * ciclo — a animação de progresso ficaria girando pra sempre. O layout já redireciona
   * pra `/monitoramento/temas` nesse caso, mas isso é uma trava extra do próprio componente.
   */
  const hasRadarConfigured = useMemo(
    () => hasAnyMonitoringRadarConfigured(profileForm),
    [profileForm],
  );

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
      if (!hasRadarConfigured || dailyCheckInFlight.current || dailyAttemptBlocked.current) {
        return;
      }
      if (!needsDailySentinelRefresh(refreshedAt)) {
        return;
      }
      dailyCheckInFlight.current = true;
      setIsRefreshing(true);
      setLoadMessage(null);
      setRefreshMessage(null);
      try {
        const response = await fetch("/api/sentinel/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "daily" }),
        });
        const payload = (await response.json()) as SuggestionsPayload;
        if (!response.ok) {
          dailyAttemptBlocked.current = true;
          setLoadMessage(
            payload.message || "Não foi possível atualizar as pautas automaticamente.",
          );
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
        } else {
          setLoadMessage(
            payload.meta?.emptyReason ||
              "Nenhuma pauta capturada nesta rodada para o radar atual.",
          );
        }
      } catch {
        dailyAttemptBlocked.current = true;
        setLoadMessage("Não foi possível atualizar as pautas automaticamente.");
      } finally {
        dailyCheckInFlight.current = false;
        setIsRefreshing(false);
      }
    },
    [hasRadarConfigured],
  );

  useEffect(() => {
    void (async () => {
      await loadSuggestions();
    })();
  }, [loadSuggestions]);

  // Após carregar meta, dispara daily se necessário (inclui 1º acesso sem cache).
  useEffect(() => {
    if (isLoading || isRefreshing) {
      return;
    }
    // refreshedAt vazio / inválido = cache miss → precisa coletar.
    const stamp = meta?.refreshedAt?.trim() || null;
    void runDailyRefreshIfNeeded(stamp);
  }, [isLoading, isRefreshing, meta?.refreshedAt, runDailyRefreshIfNeeded]);

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

  const creditsExhausted = Boolean(isGuestUi && credits && credits.remaining <= 0);

  async function handleRefresh() {
    if (!hasRadarConfigured || isRefreshing || isDemoModeActiveForEmail(sessionUser?.email) || creditsExhausted) {
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
    const groups = groupSuggestionsBySphere(
      suggestions,
      profileForm.interestSites,
      profileForm.state,
      profileForm.customRadarThemes,
      {
        federal: themeSpheres.federal,
        estadual: themeSpheres.estadual,
      },
      profileForm.municipalCities,
    );
    return Object.fromEntries(
      Object.entries(groups).map(([sphere, items]) => [sphere, sortByPublishedAtDesc(items)]),
    ) as Record<MonitorSphere, MockSentinelSuggestion[]>;
  }, [
    suggestions,
    profileForm.interestSites,
    profileForm.state,
    profileForm.customRadarThemes,
    profileForm.municipalCities,
    profileForm.sentinelThemesFederal,
    profileForm.sentinelThemesEstadual,
    profileForm.sentinelThemes,
  ]);

  const chipsBySphere = useMemo<Record<MonitorSphere, string[]>>(() => {
    function themesFromCards(cards: typeof suggestions) {
      return Array.from(
        new Set(
          cards.flatMap((item) =>
            [item.themeLabel, ...(item.matchedThemes ?? [])]
              .map((theme) => theme.trim())
              .filter(Boolean),
          ),
        ),
      ).slice(0, 8);
    }

    return {
      federal: themesFromCards(grouped.federal),
      estadual: themesFromCards(grouped.estadual),
      municipal: themesFromCards(grouped.municipal),
      interesse: Array.from(
        new Set([
          ...themesFromCards(grouped.interesse),
          ...profileForm.interestProfiles
            .map((row) => row.handle.trim())
            .filter(Boolean)
            .map((handle) => (handle.startsWith("@") ? handle : `@${handle}`)),
        ]),
      ).slice(0, 8),
      adversarios: Array.from(
        new Set([
          ...themesFromCards(grouped.adversarios),
          ...profileForm.oppositionProfiles
            .map((row) => row.handle.trim())
            .filter(Boolean)
            .map((handle) => (handle.startsWith("@") ? handle : `@${handle}`)),
        ]),
      ).slice(0, 8),
    };
  }, [grouped, profileForm.interestProfiles, profileForm.oppositionProfiles]);

  const interestSitesLabel = profileForm.interestSites.filter(Boolean).join(", ");
  const municipalCitiesLabel = profileForm.municipalCities.filter(Boolean).join(", ");

  function emptyMessageForSphere(sphere: MonitorSphere): string {
    if (sphere === "municipal") {
      const hasCities = profileForm.municipalCities.some((city) => city.trim());
      const hasPortals = profileForm.interestSites.some((site) => site.trim());
      if (hasCities && !hasPortals) {
        return "Nenhuma pauta municipal ainda. Adicione links de portais regionais para ampliar a cobertura.";
      }
      if (hasCities || hasPortals) {
        return "Nenhuma pauta municipal capturada nesta rodada. Tente atualizar as pautas mais tarde.";
      }
      return "Configure cidades e portais municipais no radar de temas.";
    }
    if (sphere === "interesse") {
      const hasProfiles = profileForm.interestProfiles.some((row) => row.handle.trim());
      if (hasProfiles) {
        return "Nenhuma pauta de interesse capturada nesta rodada.";
      }
      return "Configure perfis @ de interesse no radar de temas.";
    }
    return "Nenhuma pauta nesta esfera ainda.";
  }

  const firstPautarSuggestionId = useMemo(() => {
    for (const { sphere } of SECTIONS) {
      const first = grouped[sphere][0];
      if (first) {
        return first.id;
      }
    }
    return null;
  }, [grouped]);

  const refreshedDate = (() => {
    const raw = meta?.refreshedAt?.trim();
    if (!raw) {
      return null;
    }
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  })();
  const refreshedIsToday = refreshedDate
    ? refreshedDate.toDateString() === new Date().toDateString()
    : false;

  return (
    <div className="relative z-10 mx-auto max-w-5xl px-4 py-6 pb-20 sm:px-6 sm:py-8 lg:px-8" data-testid="monitoramento-page">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-64 bg-cyan-500/5 blur-[120px] pointer-events-none rounded-full" />

      <ProductPageHeader
        title="Monitoramento de Pautas"
        description="Defina pautas, assuntos, temas para monitoramento e criação de conteúdo com seu avatar."
        actions={
          <div
            data-onboarding-anchor="pautas-radar"
            className="flex w-full shrink-0 flex-col gap-1 sm:w-[10.5rem] md:pt-1"
          >
            <RefreshPautasButton
              variant="monitor"
              isLoading={isRefreshing}
              disabled={isDemoModeActiveForEmail(sessionUser?.email) || creditsExhausted}
              disabledTitle={
                isDemoModeActiveForEmail(sessionUser?.email)
                  ? DEMO_REFRESH_PAUTA_HINT
                  : creditsExhausted
                    ? GUEST_CREDITS_EXHAUSTED_ACTION_MESSAGE
                    : undefined
              }
              onClick={() => void handleRefresh()}
            />
            {refreshedDate ? (
              <span className="text-center text-xs text-md-text-soft">
                Atualizado {refreshedIsToday ? "hoje" : refreshedDate.toLocaleDateString("pt-BR")} às{" "}
                {refreshedDate.toLocaleTimeString("pt-BR")}
              </span>
            ) : null}
            <span className="text-center text-xs text-md-text-soft">Próx atualização às 08:00h</span>
            {isDemoModeActiveForEmail(sessionUser?.email) ? (
              <span className="text-center text-[10px] leading-snug text-[var(--distribuidor-text)]">
                {DEMO_REFRESH_PAUTA_HINT}
              </span>
            ) : creditsExhausted ? (
              <span className="text-center text-[10px] leading-snug text-[var(--distribuidor-text)]">
                {GUEST_CREDITS_EXHAUSTED_ACTION_MESSAGE}
              </span>
            ) : (
              <span className="text-center text-[10px] leading-snug text-md-text-soft">
                Atualizações antecipadas consomem créditos (
                {credits ? `${credits.remaining} restantes` : "1 de 5"}).
              </span>
            )}
          </div>
        }
      />

      <div className="mb-10 space-y-4 relative z-10">
        {refreshMessage && !isRefreshing ? (
          <p className="text-sm text-[var(--sentinela-text)] px-1" role="status">
            {refreshMessage}
          </p>
        ) : null}

        <SentinelRefreshProgress active={isRefreshing} />

        {isLoading && !isRefreshing ? (
          <div
            className="flex flex-col items-center justify-center gap-4 rounded-xl border border-md-border bg-md-surface px-5 py-8 text-center shadow-sm"
            role="status"
          >
            <span
              className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-md-border border-t-[var(--sentinela)]"
              aria-hidden="true"
            />
            <p className="text-sm leading-relaxed text-md-text-muted">
              Carregando pautas do monitoramento…
              <br />
              A primeira busca pode levar até 2 minutos enquanto consultamos portais e redes.
            </p>
          </div>
        ) : null}

        {!isLoading && !isRefreshing && !suggestions.length ? (
          <div className="rounded-xl border border-[var(--curador-border)] bg-[var(--curador-soft)] px-5 py-4">
            <p className="text-sm leading-relaxed text-md-text">
              {loadMessage || "Nenhuma pauta capturada ainda."}{" "}
              <Link
                href="/monitoramento/temas"
                className="font-semibold text-[var(--curador-text)] underline underline-offset-2 hover:opacity-80"
              >
                Selecionar temas
              </Link>
            </p>
          </div>
        ) : null}

        {meta?.oppositionUnavailableReason ? (
          <div
            className="rounded-xl border border-[var(--distribuidor-border)] bg-[var(--distribuidor-soft)] px-5 py-3"
            role="status"
            data-testid="opposition-unavailable-banner"
          >
            <p className="text-sm leading-relaxed text-md-text">
              <span className="font-semibold text-[var(--distribuidor-text)]">Adversários: </span>
              {meta.oppositionUnavailableReason}
            </p>
          </div>
        ) : null}
      </div>

      <div className="space-y-12 relative z-10">
        {SECTIONS.map(({ sphere, title, dotClass }) => {
          const items = grouped[sphere];
          const visible = visibleBySphere[sphere];
          const shown = items.slice(0, visible);
          const municipalFallback =
            sphere === "municipal" ? meta?.municipalFallback : undefined;
          return (
            <section key={sphere} id={sphere}>
              <h2 className="text-lg font-semibold text-md-text border-b border-md-border pb-3 mb-5 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${dotClass}`} />
                {title}
              </h2>

              {municipalFallback ? (
                <div
                  className="mb-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-3"
                  role="status"
                  data-testid="municipal-fallback-banner"
                >
                  <p className="text-sm leading-relaxed text-md-text">
                    <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                      Cobertura municipal ampliada:{" "}
                    </span>
                    Não encontramos reportagens recentes na(s) sua(s) Cidade(s) nos temas que você
                    selecionou
                    {municipalFallback.themesMissed.length
                      ? ` (${municipalFallback.themesMissed.slice(0, 4).join(", ")}${municipalFallback.themesMissed.length > 4 ? "…" : ""})`
                      : ""}
                    . Listamos o que há de atual na cidade
                    {municipalFallback.promotedCount
                      ? ` (${municipalFallback.promotedCount} ${municipalFallback.promotedCount === 1 ? "pauta" : "pautas"})`
                      : ""}
                    .
                  </p>
                  {municipalFallback.foundTopics.length ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-md-text-soft">
                      {municipalFallback.foundTopics.slice(0, 5).map((topic) => (
                        <li key={topic}>{topic}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}

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
                  className="mt-4 text-sm font-medium text-[var(--curador-text)] hover:underline underline-offset-2"
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

              {!isLoading && !isRefreshing && !items.length ? (
                <div className="rounded-xl border border-md-border bg-md-surface px-5 py-6 shadow-sm">
                  <p className="text-sm text-md-text-muted m-0">
                    {municipalFallback
                      ? "Não encontramos reportagens locais recentes nos temas selecionados nem outras notícias do município nesta rodada."
                      : emptyMessageForSphere(sphere)}
                  </p>
                  {sphere !== "adversarios" ? (
                    <Link
                      href="/monitoramento/temas"
                      className="mt-3 inline-block text-sm font-medium text-[var(--curador-text)] underline underline-offset-2 hover:opacity-80"
                    >
                      Configurar temas
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      {municipalCitiesLabel || interestSitesLabel ? (
        <p className="mt-10 text-xs text-md-text-soft relative z-10">
          {[
            municipalCitiesLabel ? `Cidades: ${municipalCitiesLabel}` : null,
            interestSitesLabel ? `Portais municipais: ${interestSitesLabel}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      ) : null}

      <p className="mt-2 text-xs text-md-text-soft relative z-10">
        * Score de Engajamento = curtidas + (2 × comentários).
      </p>

      <SignalEvidenceDrawer
        suggestion={evidenceSuggestion}
        onClose={() => setEvidenceSuggestion(null)}
      />
    </div>
  );
}
