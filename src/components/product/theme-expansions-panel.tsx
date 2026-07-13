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
  "inline bg-transparent p-0 text-xs text-cyan-400 hover:text-cyan-300 underline underline-offset-2";

export function ThemeExpansionsPanel({
  rows,
  linkClassName = DEFAULT_LINK_CLASS,
  listClassName = "mt-3 space-y-1 text-xs text-slate-500",
  emptyHint,
}: ThemeExpansionsPanelProps) {
  const [open, setOpen] = useState(false);

  if (rows.length === 0) {
    return emptyHint ? <p className="mt-4 text-xs text-slate-600 italic">{emptyHint}</p> : null;
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
              <strong className="text-slate-400">{row.sourceTheme}:</strong>{" "}
              {row.expandedTerms.join(", ")}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
