"use client";

import { useState } from "react";

import { SegmentFilterForm } from "@/components/admin/marketing/segment-filter-form";
import {
  CAMPAIGN_CHANNEL_LABELS,
  CONTACT_SOURCE_LABELS,
  EMPTY_SEGMENT_FILTER,
  type MarketingSegment,
  type SegmentFilter,
} from "@/lib/outbound/types";

export type SegmentWithCount = MarketingSegment & { matched: number };

/** Resumo legível do filtro, para não abrir o editor só para saber o que é. */
function describeFilter(filter: SegmentFilter): string {
  const parts: string[] = [];
  if (filter.sources.length > 0) {
    parts.push(filter.sources.map((source) => CONTACT_SOURCE_LABELS[source]).join(" + "));
  }
  if (filter.channel) {
    parts.push(CAMPAIGN_CHANNEL_LABELS[filter.channel]);
  }
  if (filter.ufs.length > 0) {
    parts.push(filter.ufs.join(", "));
  }
  if (filter.parties.length > 0) {
    parts.push(filter.parties.join(", "));
  }
  if (filter.onlyCandidates2026) {
    parts.push("candidatos 2026");
  }
  if (filter.search) {
    parts.push(`busca: "${filter.search}"`);
  }
  return parts.length > 0 ? parts.join(" · ") : "Base inteira";
}

export function SegmentsTab({
  segments,
  parties,
  initialFilter,
  onChanged,
}: {
  segments: SegmentWithCount[];
  parties: string[];
  initialFilter: SegmentFilter;
  onChanged: () => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [filter, setFilter] = useState<SegmentFilter>(initialFilter);
  const [editingId, setEditingId] = useState<string | null>(null);

  function resetForm() {
    setName("");
    setDescription("");
    setFilter(EMPTY_SEGMENT_FILTER);
    setEditingId(null);
  }

  async function handleSubmit() {
    if (name.trim().length < 2) {
      setError("Nome do segmento precisa de pelo menos 2 caracteres.");
      return;
    }

    setBusy(true);
    try {
      const url = editingId
        ? `/api/admin/marketing/segments/${editingId}`
        : "/api/admin/marketing/segments";
      const response = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, filter }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message || "Falha ao salvar segmento.");
      }
      resetForm();
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/marketing/segments/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        throw new Error(payload.message || "Falha ao remover segmento.");
      }
      if (editingId === id) {
        resetForm();
      }
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro.");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(segment: SegmentWithCount) {
    setEditingId(segment.id);
    setName(segment.name);
    setDescription(segment.description);
    setFilter(segment.filter);
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      <div className="rounded-2xl border border-md-border bg-md-surface/50 p-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-md-text">
            {editingId ? "Editar segmento" : "Novo segmento"}
          </h3>
          {editingId ? (
            <button
              type="button"
              onClick={resetForm}
              className="text-xs text-md-text-soft underline-offset-2 hover:text-md-text hover:underline"
            >
              Cancelar edição
            </button>
          ) : null}
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nome (ex.: Presidentes de diretório — Sul)"
            className="rounded-xl border border-md-border bg-md-surface px-3 py-2 text-sm text-md-text placeholder:text-md-text-soft"
          />
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Descrição (opcional)"
            className="rounded-xl border border-md-border bg-md-surface px-3 py-2 text-sm text-md-text placeholder:text-md-text-soft"
          />
        </div>

        <SegmentFilterForm value={filter} parties={parties} onChange={setFilter} />

        <button
          type="button"
          disabled={busy}
          onClick={() => void handleSubmit()}
          className="mt-4 rounded-xl bg-cyan-500/20 px-4 py-2 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/30 disabled:opacity-50"
        >
          {editingId ? "Salvar alterações" : "Criar segmento"}
        </button>
      </div>

      <div className="space-y-3">
        {segments.length === 0 ? (
          <p className="rounded-2xl border border-md-border px-4 py-8 text-center text-sm text-md-text-soft">
            Nenhum segmento salvo ainda.
          </p>
        ) : null}

        {segments.map((segment) => (
          <div
            key={segment.id}
            className="flex flex-col gap-2 rounded-2xl border border-md-border bg-md-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="font-medium text-md-text">{segment.name}</p>
              {segment.description ? (
                <p className="text-xs text-md-text-soft">{segment.description}</p>
              ) : null}
              <p className="mt-1 truncate text-xs text-md-text-soft">
                {describeFilter(segment.filter)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="rounded-full bg-cyan-500/15 px-3 py-1 text-xs font-semibold text-cyan-300">
                {segment.matched} contatos
              </span>
              <button
                type="button"
                onClick={() => startEdit(segment)}
                className="text-xs text-md-text-soft underline-offset-2 hover:text-md-text hover:underline"
              >
                Editar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleDelete(segment.id)}
                className="text-xs text-rose-300 underline-offset-2 hover:underline disabled:opacity-50"
              >
                Remover
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
