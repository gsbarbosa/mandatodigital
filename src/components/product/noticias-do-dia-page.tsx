"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";

import { MonitorSignalCard, SignalEvidenceDrawer } from "@/components/product/monitor-signal-card";
import { ProductPageHeader } from "@/components/product/product-page-header";
import { RefreshPautasButton } from "@/components/product/refresh-pautas-button";
import { useProductApp } from "@/components/product/provider";
import type { MockSentinelSuggestion } from "@/lib/sentinel-mock-suggestions";

type NoticiaDoDiaSphere = "nacional" | "estadual" | "municipal";

type NoticiasMeta = {
  generatedAt: string;
  stateUf: string | null;
  nationalPortalCount: number;
  statePortalCount: number;
  municipalPortalCount: number;
  municipalFailedPortals?: string[];
} | null;

type NoticiasPayload = {
  message?: string;
  nacional?: MockSentinelSuggestion[];
  estadual?: MockSentinelSuggestion[];
  municipal?: MockSentinelSuggestion[];
  meta?: NoticiasMeta;
};

const SECTIONS: Array<{ sphere: NoticiaDoDiaSphere; title: string; dotClass: string }> = [
  { sphere: "nacional", title: "Nacional", dotClass: "bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]" },
  { sphere: "estadual", title: "Estadual", dotClass: "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" },
  { sphere: "municipal", title: "Municipal", dotClass: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" },
];

const VISIBLE_STEP = 5;

/**
 * O backend entrega os itens em rodadas (1ª manchete de cada fonte, depois a 2ª
 * de quem tiver, etc. — ver roundRobin em noticias-do-dia.ts), então o prefixo
 * sem fonte repetida É a 1ª rodada inteira. Mostrar só esse prefixo de cara
 * garante fontes diferentes na tela sem esconder volume: o resto (repetições de
 * fonte) fica atrás do "Ver mais".
 */
function diverseInitialCount(items: MockSentinelSuggestion[]): number {
  const seen = new Set<string>();
  let count = 0;
  for (const item of items) {
    if (seen.has(item.themeLabel)) {
      break;
    }
    seen.add(item.themeLabel);
    count += 1;
  }
  return count;
}

/** "Do dia" em America/Sao_Paulo — mesma régua usada no cache do servidor (noticias-do-dia-storage.ts). */
function saoPauloDateStamp(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function isCacheStale(generatedAt: string | null | undefined): boolean {
  if (!generatedAt) {
    return true;
  }
  const generated = new Date(generatedAt);
  if (Number.isNaN(generated.getTime())) {
    return true;
  }
  return saoPauloDateStamp(generated) !== saoPauloDateStamp(new Date());
}

function joinPortalNames(names: string[]): string {
  if (names.length <= 1) {
    return names[0] ?? "";
  }
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

/**
 * Aviso pra portal municipal cadastrado que não retornou nada — alguns sites
 * bloqueiam esse tipo de busca automática (ver docs/noticias-do-dia.md §3).
 * Termina sem pontuação de propósito: o "Configurar temas" clicável (JSX) entra
 * na mesma frase, como continuação natural, não como link solto depois.
 */
function municipalFailedPortalsMessage(names: string[]): string {
  const plural = names.length > 1;
  const list = joinPortalNames(names);
  const portalWord = plural ? "Os portais" : "O portal";
  const permiteWord = plural ? "não permitem" : "não permite";
  const delesWord = plural ? "deles" : "dele";
  const substituiWord = plural ? "substituí-los" : "substituí-lo";
  const outrosWord = plural ? "outros portais" : "outro portal";
  return `${portalWord} ${list} ${permiteWord} esse tipo de busca automática, então não conseguimos trazer notícias ${delesWord}. Recomendamos ${substituiWord} por ${outrosWord} em`;
}

export function NoticiasDoDiaPage() {
  const { profileForm } = useProductApp();
  const [sections, setSections] = useState<Record<NoticiaDoDiaSphere, MockSentinelSuggestion[]>>({
    nacional: [],
    estadual: [],
    municipal: [],
  });
  const [meta, setMeta] = useState<NoticiasMeta>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [visible, setVisible] = useState<Record<NoticiaDoDiaSphere, number>>({
    nacional: 0,
    estadual: 0,
    municipal: 0,
  });
  const [evidenceSuggestion, setEvidenceSuggestion] = useState<MockSentinelSuggestion | null>(null);
  const autoRefreshTried = useRef(false);

  const applyPayload = useCallback((payload: NoticiasPayload) => {
    const nextSections: Record<NoticiaDoDiaSphere, MockSentinelSuggestion[]> = {
      nacional: payload.nacional ?? [],
      estadual: payload.estadual ?? [],
      municipal: payload.municipal ?? [],
    };
    setSections(nextSections);
    setVisible({
      nacional: diverseInitialCount(nextSections.nacional),
      estadual: diverseInitialCount(nextSections.estadual),
      municipal: diverseInitialCount(nextSections.municipal),
    });
    setMeta(payload.meta ?? null);
  }, []);

  const load = useCallback(async () => {
    setIsLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/noticias-do-dia");
      const payload = (await response.json()) as NoticiasPayload;
      if (!response.ok) {
        setMessage(payload.message || "Não foi possível carregar as notícias do dia.");
        return;
      }
      applyPayload(payload);
    } catch {
      setMessage("Não foi possível carregar as notícias do dia.");
    } finally {
      setIsLoading(false);
    }
  }, [applyPayload]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing((current) => {
      if (current) {
        return current;
      }
      return true;
    });
    setMessage(null);
    try {
      const response = await fetch("/api/noticias-do-dia/refresh", { method: "POST" });
      const payload = (await response.json()) as NoticiasPayload;
      if (!response.ok) {
        setMessage(payload.message || "Não foi possível atualizar as notícias do dia.");
        return;
      }
      applyPayload(payload);
    } catch {
      setMessage("Não foi possível atualizar as notícias do dia.");
    } finally {
      setIsRefreshing(false);
    }
  }, [applyPayload]);

  useEffect(() => {
    void load();
  }, [load]);

  // Primeira visita do dia (ou cache vencido de ontem): atualiza uma vez, automaticamente.
  useEffect(() => {
    if (isLoading || isRefreshing || autoRefreshTried.current) {
      return;
    }
    if (isCacheStale(meta?.generatedAt)) {
      autoRefreshTried.current = true;
      void handleRefresh();
    }
  }, [isLoading, isRefreshing, meta?.generatedAt, handleRefresh]);

  const generatedDate = (() => {
    const raw = meta?.generatedAt;
    if (!raw) {
      return null;
    }
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  })();
  const generatedIsToday = generatedDate ? !isCacheStale(generatedDate.toISOString()) : false;

  function emptyMessageForSphere(sphere: NoticiaDoDiaSphere): string {
    if (sphere === "estadual" && !profileForm.state.trim()) {
      return "Defina o estado (UF) do mandato para monitorar os portais estaduais.";
    }
    if (sphere === "municipal" && !profileForm.interestSites.some((site) => site.trim())) {
      return "Nenhum portal municipal cadastrado. Adicione portais regionais em Configurar temas.";
    }
    return "Nenhuma notícia encontrada nesta rodada.";
  }

  return (
    <div
      className="relative z-10 mx-auto max-w-5xl px-4 py-6 pb-20 sm:px-6 sm:py-8 lg:px-8"
      data-testid="noticias-do-dia-page"
    >
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-64 bg-cyan-500/5 blur-[120px] pointer-events-none rounded-full" />

      <ProductPageHeader
        title="Notícias do Dia"
        description="As manchetes de hoje dos portais nacionais, estaduais e municipais das principais fontes de informação - sem filtro de temas."
        actions={
          <div className="flex w-full shrink-0 flex-col gap-1 sm:w-[10.5rem] md:pt-1">
            <RefreshPautasButton
              variant="monitor"
              className="refresh-pautas-btn--blue"
              isLoading={isRefreshing}
              label="Atualizar notícias"
              loadingLabel="Atualizando notícias..."
              onClick={() => void handleRefresh()}
            />
            {generatedDate ? (
              <span className="text-center text-xs text-md-text-soft">
                Atualizado {generatedIsToday ? "hoje" : generatedDate.toLocaleDateString("pt-BR")} às{" "}
                {generatedDate.toLocaleTimeString("pt-BR")}
              </span>
            ) : null}
          </div>
        }
      />

      {message ? (
        <div className="mb-8 rounded-xl border border-[var(--curador-border)] bg-[var(--curador-soft)] px-5 py-4 relative z-10">
          <p className="text-sm leading-relaxed text-md-text">{message}</p>
        </div>
      ) : null}

      {isLoading || isRefreshing ? (
        <div
          className="mb-8 flex items-center justify-center gap-3 rounded-xl border border-md-border bg-md-surface px-5 py-6 text-center shadow-sm relative z-10"
          role="status"
        >
          <span
            className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-md-border border-t-[var(--sentinela)]"
            aria-hidden="true"
          />
          <p className="text-sm leading-relaxed text-md-text-muted">
            {isRefreshing ? "Buscando as manchetes de hoje nos portais…" : "Carregando notícias do dia…"}
          </p>
        </div>
      ) : null}

      <div className="space-y-12 relative z-10">
        {SECTIONS.map(({ sphere, title, dotClass }) => {
          const items = sections[sphere];
          const visibleCount = visible[sphere];
          const shown = items.slice(0, visibleCount);
          return (
            <section key={sphere} id={sphere}>
              <h2 className="text-lg font-semibold text-md-text border-b border-md-border pb-3 mb-5 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${dotClass}`} />
                {title}
                <span className="text-xs font-normal text-md-text-soft">({items.length})</span>
              </h2>

              {!isLoading && sphere === "municipal" && meta?.municipalFailedPortals?.length ? (
                <div
                  className="mb-5 rounded-xl border border-[var(--distribuidor-border)] bg-[var(--distribuidor-soft)] px-5 py-3"
                  role="status"
                >
                  <p className="text-sm leading-relaxed text-md-text m-0">
                    {municipalFailedPortalsMessage(meta.municipalFailedPortals)}{" "}
                    <Link
                      href={"/monitoramento/temas" as Route}
                      className="font-semibold text-[var(--curador-text)] underline underline-offset-2 hover:opacity-80"
                    >
                      Configurar temas
                    </Link>
                    .
                  </p>
                </div>
              ) : null}

              {!isLoading && shown.length ? (
                <div className="space-y-4">
                  {shown.map((suggestion) => (
                    <MonitorSignalCard
                      key={suggestion.id}
                      suggestion={suggestion}
                      onOpenEvidence={(item) => setEvidenceSuggestion(item)}
                      themeCaption="Publicada hoje"
                      noDateFallbackToToday
                    />
                  ))}
                </div>
              ) : null}

              {!isLoading && items.length > visibleCount ? (
                <button
                  type="button"
                  className="mt-4 text-sm font-medium text-[var(--curador-text)] hover:underline underline-offset-2"
                  onClick={() =>
                    setVisible((current) => ({ ...current, [sphere]: current[sphere] + VISIBLE_STEP }))
                  }
                >
                  Ver mais ({items.length - visibleCount})
                </button>
              ) : null}

              {!isLoading && !isRefreshing && !items.length ? (
                <div className="rounded-xl border border-md-border bg-md-surface px-5 py-6 shadow-sm">
                  <p className="text-sm text-md-text-muted m-0">{emptyMessageForSphere(sphere)}</p>
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      <SignalEvidenceDrawer suggestion={evidenceSuggestion} onClose={() => setEvidenceSuggestion(null)} />
    </div>
  );
}
