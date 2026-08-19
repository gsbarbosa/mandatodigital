"use client";

import { useEffect, useState } from "react";

import { SegmentFilterForm } from "@/components/admin/marketing/segment-filter-form";
import type { MarketingContactStats } from "@/lib/outbound/contacts-storage";
import {
  CONTACT_SOURCE_LABELS,
  EMPTY_SEGMENT_FILTER,
  type MarketingContact,
  type SegmentFilter,
} from "@/lib/outbound/types";

type ContactsResponse = {
  stats: MarketingContactStats;
  matched: number;
  contacts: MarketingContact[];
  truncated: boolean;
  message?: string;
};

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-md-border bg-md-surface px-4 py-3">
      <p className="text-[11px] uppercase tracking-wider text-md-text-soft">{label}</p>
      <p className="mt-1 text-xl font-bold text-md-text">{value}</p>
    </div>
  );
}

export function ContactsTab({
  filter,
  onFilterChange,
  onStatsLoaded,
}: {
  filter: SegmentFilter;
  onFilterChange: (next: SegmentFilter) => void;
  onStatsLoaded: (stats: MarketingContactStats) => void;
}) {
  const [data, setData] = useState<ContactsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // Debounce: o filtro muda a cada tecla na busca livre.
    const timer = setTimeout(() => {
      void (async () => {
        setLoading(true);
        try {
          const query = encodeURIComponent(JSON.stringify(filter));
          const response = await fetch(`/api/admin/marketing/contacts?filter=${query}`);
          const payload = (await response.json()) as ContactsResponse;
          if (!response.ok) {
            throw new Error(payload.message || "Falha ao carregar contatos.");
          }
          if (!cancelled) {
            setData(payload);
            setError(null);
            onStatsLoaded(payload.stats);
          }
        } catch (err) {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : "Erro.");
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      })();
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [filter, onStatsLoaded]);

  const stats = data?.stats;

  return (
    <div className="space-y-6">
      {stats ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Base total" value={stats.total} />
          <StatCard label="Com e-mail" value={stats.withEmail} />
          <StatCard label="Com WhatsApp" value={stats.withWhatsapp} />
          <StatCard label="Candidatos 2026" value={stats.candidates2026} />
          <StatCard label="Opt-out" value={stats.optOut} />
        </div>
      ) : null}

      <div className="rounded-2xl border border-md-border bg-md-surface/50 p-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-md-text">Filtro</h3>
          <button
            type="button"
            onClick={() => onFilterChange(EMPTY_SEGMENT_FILTER)}
            className="text-xs text-md-text-soft underline-offset-2 hover:text-md-text hover:underline"
          >
            Limpar
          </button>
        </div>
        <SegmentFilterForm
          value={filter}
          parties={stats?.parties ?? []}
          onChange={onFilterChange}
        />
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      <div>
        <p className="mb-3 text-sm text-md-text-soft">
          {loading ? "Carregando…" : `${data?.matched ?? 0} contatos no filtro`}
          {data?.truncated ? ` (mostrando os primeiros ${data.contacts.length})` : ""}
        </p>

        <div className="overflow-x-auto rounded-2xl border border-md-border">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-md-surface/80 text-[11px] uppercase tracking-wider text-md-text-soft">
              <tr>
                <th className="px-4 py-3 font-semibold">Contato</th>
                <th className="px-4 py-3 font-semibold">Partido / UF</th>
                <th className="px-4 py-3 font-semibold">Cargo</th>
                <th className="px-4 py-3 font-semibold">Origem</th>
                <th className="px-4 py-3 font-semibold">Canais</th>
                <th className="px-4 py-3 font-semibold">Último disparo</th>
              </tr>
            </thead>
            <tbody>
              {!loading && (data?.contacts.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-md-text-soft">
                    Nenhum contato ainda. Eles entram aqui só depois do primeiro disparo.
                  </td>
                </tr>
              ) : null}
              {data?.contacts.map((contact) => (
                <tr key={contact.id} className="border-t border-md-border text-md-text-muted">
                  <td className="px-4 py-3">
                    <p className="text-md-text">{contact.name || "—"}</p>
                    <p className="text-xs text-md-text-soft">{contact.email || "—"}</p>
                  </td>
                  <td className="px-4 py-3">
                    {[contact.parties.join(", "), contact.uf].filter(Boolean).join(" / ") || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span>{contact.candidateRole || contact.roles[0] || "—"}</span>
                    {contact.isCandidate2026 ? (
                      <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                        candidato 2026
                      </span>
                    ) : null}
                    {contact.optOut ? (
                      <span className="ml-2 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-200">
                        opt-out
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-xs">{CONTACT_SOURCE_LABELS[contact.source]}</td>
                  <td className="px-4 py-3 text-xs">
                    {[contact.email ? "e-mail" : null, contact.phoneE164 ? "WhatsApp" : null]
                      .filter(Boolean)
                      .join(" + ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-md-text-soft">
                    {contact.lastTemplate
                      ? `${contact.lastTemplate} · ${contact.lastStatus || "—"}`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
