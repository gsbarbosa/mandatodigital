"use client";

import { useState } from "react";

import {
  BRAZIL_MAP_TRANSFORM,
  BRAZIL_MAP_VIEW_BOX,
  BRAZIL_UF_SHAPES,
} from "@/lib/geo/brazil-uf-map";

/**
 * Mapa do Brasil com as 27 UFs (26 estados + Distrito Federal) clicáveis.
 * Funciona como um radiogroup: uma UF selecionada por vez.
 */
export function BrazilUfMap({
  value,
  onSelect,
}: {
  /** Sigla da UF selecionada, ou string vazia. */
  value: string;
  onSelect: (uf: string) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  const highlighted = hovered ?? (value || null);
  const highlightedName = highlighted
    ? BRAZIL_UF_SHAPES.find((shape) => shape.uf === highlighted)?.nome
    : null;

  return (
    <div>
      <svg
        viewBox={BRAZIL_MAP_VIEW_BOX}
        role="radiogroup"
        aria-label="Selecione seu Estado no mapa"
        className="w-full h-auto max-h-[22rem] mx-auto block"
        onMouseLeave={() => setHovered(null)}
      >
        <g transform={BRAZIL_MAP_TRANSFORM}>
          {BRAZIL_UF_SHAPES.map((shape) => {
            const isSelected = shape.uf === value;
            const isHovered = shape.uf === hovered;

            return (
              <path
                key={shape.uf}
                d={shape.d}
                role="radio"
                tabIndex={0}
                aria-checked={isSelected}
                aria-label={`${shape.nome} (${shape.uf})`}
                data-testid={`uf-map-${shape.uf}`}
                vectorEffect="non-scaling-stroke"
                onClick={() => onSelect(shape.uf)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(shape.uf);
                  }
                }}
                onMouseEnter={() => setHovered(shape.uf)}
                onFocus={() => setHovered(shape.uf)}
                onBlur={() => setHovered(null)}
                className={`uf-map-path ${
                  isSelected
                    ? "uf-map-path--selected"
                    : isHovered
                      ? "uf-map-path--hover"
                      : "uf-map-path--default"
                }`}
                style={{ strokeWidth: isSelected || isHovered ? 1.5 : 1.1 }}
              >
                <title>{`${shape.nome} (${shape.uf})`}</title>
              </path>
            );
          })}
        </g>
      </svg>

      <p className="mt-3 text-center text-sm min-h-[1.5rem]" aria-live="polite">
        {highlightedName ? (
          <span className={value && highlighted === value ? "text-[var(--curador-text)] font-semibold" : "text-md-text-muted"}>
            {highlightedName} <span className="text-md-text-soft">({highlighted})</span>
          </span>
        ) : (
          <span className="text-md-text-soft">Clique em um estado no mapa</span>
        )}
      </p>
    </div>
  );
}
