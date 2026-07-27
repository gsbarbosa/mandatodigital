"use client";

import { useEffect, useMemo, useState } from "react";

import { BRAZIL_UF_NAME_BY_SIGLA } from "@/lib/geo/brazil-uf-map";

/** Remove acentos e caixa para que "sao paulo" encontre "São Paulo". */
function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Quantos municípios a lista mostra antes de pedir refino da busca. */
const VISIBLE_LIMIT = 120;

/**
 * Lista os municípios da UF selecionada e deixa o usuário escolher até `maxItems`.
 * A base vem de `public/geo/municipios/<UF>.json`, carregada sob demanda.
 */
export function MunicipioPicker({
  uf,
  value,
  maxItems,
  onChange,
}: {
  /** Sigla da UF escolhida no mapa; vazio enquanto nada foi selecionado. */
  uf: string;
  value: string[];
  maxItems: number;
  onChange: (cities: string[]) => void;
}) {
  // Guardamos a UF junto com o resultado para derivar o estado de carregamento sem
  // precisar de um setState de reset no corpo do efeito a cada troca de estado.
  const [loaded, setLoaded] = useState<{
    uf: string;
    cities: string[];
    ok: boolean;
  } | null>(null);
  const [search, setSearch] = useState<{ uf: string; text: string }>({ uf: "", text: "" });

  useEffect(() => {
    if (!uf) {
      return;
    }

    let active = true;

    fetch(`/geo/municipios/${uf}.json`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json() as Promise<string[]>;
      })
      .then((payload) => {
        if (!active) return;
        setLoaded({ uf, cities: payload, ok: true });
      })
      .catch(() => {
        if (!active) return;
        setLoaded({ uf, cities: [], ok: false });
      });

    return () => {
      active = false;
    };
  }, [uf]);

  const current = loaded?.uf === uf ? loaded : null;
  const cities = useMemo(() => current?.cities ?? [], [current]);
  const status: "idle" | "loading" | "ready" | "error" = !uf
    ? "idle"
    : current === null
      ? "loading"
      : current.ok
        ? "ready"
        : "error";
  const query = search.uf === uf ? search.text : "";

  const matches = useMemo(() => {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) {
      return cities;
    }
    return cities.filter((city) => normalize(city).includes(normalizedQuery));
  }, [cities, query]);

  const atLimit = value.length >= maxItems;

  function toggleCity(city: string) {
    if (value.includes(city)) {
      onChange(value.filter((item) => item !== city));
      return;
    }
    if (atLimit) {
      return;
    }
    onChange([...value, city]);
  }

  if (!uf) {
    return (
      <div className="flex h-full min-h-[18rem] items-center justify-center rounded-xl border border-dashed border-md-border bg-md-surface-inset p-6">
        <p className="text-sm text-md-text-soft text-center max-w-xs">
          Escolha um estado no mapa ao lado para carregar a lista de municípios.
        </p>
      </div>
    );
  }

  return (
    <div data-testid="municipio-picker">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <span className="text-xs font-bold uppercase tracking-widest text-md-text-soft">
          {BRAZIL_UF_NAME_BY_SIGLA[uf] ?? uf}
        </span>
        <span className="text-xs font-semibold text-[var(--sentinela-text)]">
          {value.length}/{maxItems} selecionados
        </span>
      </div>

      {value.length > 0 ? (
        <div className="flex flex-wrap gap-2 mb-3">
          {value.map((city) => (
            <button
              key={city}
              type="button"
              onClick={() => toggleCity(city)}
              aria-label={`Remover ${city}`}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--sentinela-border)] bg-[var(--sentinela-soft)] px-3 py-1 text-sm text-[var(--sentinela-text)] hover:bg-[var(--sentinela-soft)] transition-colors"
            >
              {city}
              <span aria-hidden="true" className="text-[var(--sentinela-text)]">
                ×
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <input
        type="search"
        value={query}
        onChange={(event) => setSearch({ uf, text: event.target.value })}
        placeholder="Digite para buscar o município"
        aria-label="Buscar município"
        data-testid="municipio-search"
        className="bg-md-surface-inset border border-md-border text-md-text-muted text-sm rounded-lg w-full px-3 py-2.5 mb-3 outline-none focus:ring-emerald-500 focus:border-emerald-500"
      />

      {status === "loading" ? (
        <p className="text-sm text-md-text-soft py-4">Carregando municípios…</p>
      ) : status === "error" ? (
        <p className="text-sm text-amber-400 py-4">
          Não foi possível carregar os municípios de {uf}. Recarregue a página e tente de novo.
        </p>
      ) : (
        <>
          <ul className="max-h-64 overflow-y-auto rounded-xl border border-md-border divide-y divide-md-border">
            {matches.length === 0 ? (
              <li className="px-3 py-4 text-sm text-md-text-soft">Nenhum município encontrado.</li>
            ) : (
              matches.slice(0, VISIBLE_LIMIT).map((city) => {
                const isSelected = value.includes(city);
                const isDisabled = !isSelected && atLimit;

                return (
                  <li key={city}>
                    <button
                      type="button"
                      disabled={isDisabled}
                      aria-pressed={isSelected}
                      onClick={() => toggleCity(city)}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                        isSelected
                          ? "bg-[var(--sentinela-soft)] text-[var(--sentinela-text)]"
                          : "text-md-text-muted hover:bg-md-overlay-hover"
                      }`}
                    >
                      {city}
                      {isSelected ? <span aria-hidden="true">✓</span> : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>

          {matches.length > VISIBLE_LIMIT ? (
            <p className="mt-2 text-xs text-md-text-soft">
              Mostrando {VISIBLE_LIMIT} de {matches.length} municípios. Refine a busca para ver os
              demais.
            </p>
          ) : null}

          {atLimit ? (
            <p className="mt-2 text-xs text-amber-400">
              Limite de {maxItems} municípios atingido. Remova um para escolher outro.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
