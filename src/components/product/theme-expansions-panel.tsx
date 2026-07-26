"use client";

import { useState } from "react";

export type ThemeExpansionRow = {
  sourceTheme: string;
  expandedTerms: string[];
  generatedAt?: string;
};

type ThemeExpansionsPanelProps = {
  rows: ThemeExpansionRow[];
  linkClassName?: string;
  listClassName?: string;
  emptyHint?: string;
};

const DEFAULT_LINK_CLASS =
  "inline bg-transparent p-0 text-xs text-[var(--curador-text)] hover:text-[var(--curador-text)] underline underline-offset-2";

export function ThemeExpansionsPanel({
  rows,
  linkClassName = DEFAULT_LINK_CLASS,
  listClassName = "mt-3 space-y-1 text-xs text-md-text-soft",
  emptyHint,
}: ThemeExpansionsPanelProps) {
  const [open, setOpen] = useState(false);

  if (rows.length === 0) {
    return emptyHint ? <p className="mt-4 text-xs text-md-text-soft italic">{emptyHint}</p> : null;
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={linkClassName}
      >
        {open ? "Ocultar" : "Ver"} termos monitorados (expansão semântica)
      </button>
      {open ? (
        <ul className={listClassName}>
          {rows.map((row) => (
            <li key={row.sourceTheme}>
              <strong className="text-md-text-soft">{row.sourceTheme}:</strong>{" "}
              {row.expandedTerms.join(", ")}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
