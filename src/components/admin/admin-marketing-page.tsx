"use client";

import { useCallback, useEffect, useState } from "react";

import { CampaignsTab } from "@/components/admin/marketing/campaigns-tab";
import { ContactsTab } from "@/components/admin/marketing/contacts-tab";
import { SegmentsTab, type SegmentWithCount } from "@/components/admin/marketing/segments-tab";
import type { MarketingContactStats } from "@/lib/outbound/contacts-storage";
import { EMPTY_SEGMENT_FILTER, type SegmentFilter } from "@/lib/outbound/types";

const TABS = [
  { id: "contatos", label: "Contatos" },
  { id: "segmentos", label: "Segmentos" },
  { id: "campanhas", label: "Campanhas" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function AdminMarketingPage() {
  const [tab, setTab] = useState<TabId>("contatos");
  const [filter, setFilter] = useState<SegmentFilter>(EMPTY_SEGMENT_FILTER);
  const [stats, setStats] = useState<MarketingContactStats | null>(null);
  const [segments, setSegments] = useState<SegmentWithCount[]>([]);
  const [segmentsError, setSegmentsError] = useState<string | null>(null);

  // Segmentos vivem aqui (e não na aba) porque a aba de campanhas também
  // depende deles — abrir "Campanhas" direto não pode vir com a lista vazia.
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/api/admin/marketing/segments");
        const payload = (await response.json()) as {
          segments?: SegmentWithCount[];
          message?: string;
        };
        if (!response.ok) {
          throw new Error(payload.message || "Falha ao carregar segmentos.");
        }
        if (!cancelled) {
          setSegments(payload.segments ?? []);
          setSegmentsError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setSegmentsError(err instanceof Error ? err.message : "Erro.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const reloadSegments = useCallback(async () => {
    setReloadToken((token) => token + 1);
  }, []);

  const handleStatsLoaded = useCallback((next: MarketingContactStats) => {
    setStats(next);
  }, []);

  return (
    <div>
      <header className="mb-6">
        <h2 className="text-2xl font-bold text-md-text">Marketing</h2>
        <p className="mt-1 text-sm text-md-text-soft">
          Base de prospects, segmentação de público e campanhas de e-mail/WhatsApp.
        </p>
      </header>

      <div className="mb-6 flex gap-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              tab === item.id
                ? "bg-cyan-500/20 text-cyan-300"
                : "bg-md-surface text-md-text-soft hover:text-md-text"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {segmentsError ? (
        <p className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {segmentsError}
        </p>
      ) : null}

      {tab === "contatos" ? (
        <ContactsTab filter={filter} onFilterChange={setFilter} onStatsLoaded={handleStatsLoaded} />
      ) : null}

      {tab === "segmentos" ? (
        <SegmentsTab
          segments={segments}
          parties={stats?.parties ?? []}
          initialFilter={filter}
          onChanged={reloadSegments}
        />
      ) : null}

      {tab === "campanhas" ? <CampaignsTab segments={segments} /> : null}
    </div>
  );
}
