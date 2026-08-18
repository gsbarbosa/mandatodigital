"use client";

import { UF_LIST } from "@/lib/eleicao-2026";
import {
  CAMPAIGN_CHANNEL_LABELS,
  CAMPAIGN_CHANNELS,
  CONTACT_SOURCE_LABELS,
  CONTACT_SOURCES,
  OFFICE_KEY_LABELS,
  OFFICE_KEYS,
  RELEVANCE_TIER_LABELS,
  RELEVANCE_TIERS,
  type SegmentFilter,
} from "@/lib/outbound/types";

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

const chipClass = (active: boolean) =>
  `rounded-full px-3 py-1 text-xs font-medium transition ${
    active ? "bg-cyan-500/20 text-cyan-300" : "bg-md-surface text-md-text-soft hover:text-md-text"
  }`;

export function SegmentFilterForm({
  value,
  parties,
  onChange,
}: {
  value: SegmentFilter;
  parties: string[];
  onChange: (next: SegmentFilter) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-md-text-soft">
          Origem
        </p>
        <div className="flex flex-wrap gap-2">
          {CONTACT_SOURCES.map((source) => (
            <button
              key={source}
              type="button"
              className={chipClass(value.sources.includes(source))}
              onClick={() => onChange({ ...value, sources: toggle(value.sources, source) })}
            >
              {CONTACT_SOURCE_LABELS[source]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-md-text-soft">
          Canal
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={chipClass(value.channel === null)}
            onClick={() => onChange({ ...value, channel: null })}
          >
            Qualquer
          </button>
          {CAMPAIGN_CHANNELS.map((channel) => (
            <button
              key={channel}
              type="button"
              className={chipClass(value.channel === channel)}
              onClick={() => onChange({ ...value, channel })}
            >
              {CAMPAIGN_CHANNEL_LABELS[channel]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-md-text-soft">
          UF {value.ufs.length > 0 ? `(${value.ufs.length})` : ""}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {UF_LIST.map((uf) => (
            <button
              key={uf}
              type="button"
              className={chipClass(value.ufs.includes(uf))}
              onClick={() => onChange({ ...value, ufs: toggle(value.ufs, uf) })}
            >
              {uf}
            </button>
          ))}
        </div>
      </div>

      {parties.length > 0 ? (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-md-text-soft">
            Partido {value.parties.length > 0 ? `(${value.parties.length})` : ""}
          </p>
          <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
            {parties.map((party) => (
              <button
                key={party}
                type="button"
                className={chipClass(value.parties.includes(party))}
                onClick={() => onChange({ ...value, parties: toggle(value.parties, party) })}
              >
                {party}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-md-text-soft">
          Cargo
        </p>
        <div className="flex flex-wrap gap-2">
          {OFFICE_KEYS.map((office) => (
            <button
              key={office}
              type="button"
              className={chipClass(value.offices.includes(office))}
              onClick={() => onChange({ ...value, offices: toggle(value.offices, office) })}
            >
              {OFFICE_KEY_LABELS[office]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-md-text-soft">
          Relevância
        </p>
        <div className="flex flex-wrap gap-2">
          {RELEVANCE_TIERS.map((tier) => (
            <button
              key={tier}
              type="button"
              className={chipClass(value.relevanceTiers.includes(tier))}
              onClick={() =>
                onChange({ ...value, relevanceTiers: toggle(value.relevanceTiers, tier) })
              }
            >
              {RELEVANCE_TIER_LABELS[tier]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-md-text-muted">
          <input
            type="checkbox"
            checked={value.onlyCandidates2026}
            onChange={(event) =>
              onChange({ ...value, onlyCandidates2026: event.target.checked })
            }
            className="accent-cyan-500"
          />
          Só candidatos 2026
        </label>
        <label className="flex items-center gap-2 text-sm text-md-text-muted">
          <input
            type="checkbox"
            checked={value.onlyWomen}
            onChange={(event) =>
              onChange({
                ...value,
                onlyWomen: event.target.checked,
                onlyMen: event.target.checked ? false : value.onlyMen,
              })
            }
            className="accent-cyan-500"
          />
          Só mulheres
        </label>
        <label className="flex items-center gap-2 text-sm text-md-text-muted">
          <input
            type="checkbox"
            checked={value.onlyMen}
            onChange={(event) =>
              onChange({
                ...value,
                onlyMen: event.target.checked,
                onlyWomen: event.target.checked ? false : value.onlyWomen,
              })
            }
            className="accent-cyan-500"
          />
          Só homens
        </label>
        <label className="flex items-center gap-2 text-sm text-md-text-muted">
          <input
            type="checkbox"
            checked={value.onlyReelection}
            onChange={(event) =>
              onChange({
                ...value,
                onlyReelection: event.target.checked,
                excludeReelection: event.target.checked ? false : value.excludeReelection,
              })
            }
            className="accent-cyan-500"
          />
          Só reeleição
        </label>
        <label className="flex items-center gap-2 text-sm text-md-text-muted">
          <input
            type="checkbox"
            checked={value.excludeReelection}
            onChange={(event) =>
              onChange({
                ...value,
                excludeReelection: event.target.checked,
                onlyReelection: event.target.checked ? false : value.onlyReelection,
              })
            }
            className="accent-cyan-500"
          />
          Excluir reeleição
        </label>
        <label className="flex items-center gap-2 text-sm text-md-text-muted">
          <input
            type="checkbox"
            checked={value.onlyPartyPresidents}
            onChange={(event) => onChange({ ...value, onlyPartyPresidents: event.target.checked })}
            className="accent-cyan-500"
          />
          Só presidentes de partido
        </label>
        <label className="flex items-center gap-2 text-sm text-md-text-muted">
          <input
            type="checkbox"
            checked={value.excludeVip}
            onChange={(event) => onChange({ ...value, excludeVip: event.target.checked })}
            className="accent-cyan-500"
          />
          Excluir VIP (contato pessoal)
        </label>
        <label className="flex items-center gap-2 text-sm text-md-text-muted">
          <input
            type="checkbox"
            checked={value.excludeSuspended}
            onChange={(event) => onChange({ ...value, excludeSuspended: event.target.checked })}
            className="accent-cyan-500"
          />
          Excluir diretório suspenso
        </label>
      </div>

      <input
        value={value.search}
        onChange={(event) => onChange({ ...value, search: event.target.value })}
        placeholder="Buscar nome, e-mail, município…"
        className="w-full rounded-xl border border-md-border bg-md-surface px-3 py-2 text-sm text-md-text placeholder:text-md-text-soft"
      />
    </div>
  );
}
