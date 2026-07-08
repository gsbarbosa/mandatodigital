"use client";

import type { ReactNode } from "react";

/** Rounded selectable pill following the mock's .theme-tag styling. */
export function ThemeTagPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const base =
    "px-4 py-1.5 rounded-full border text-xs sm:text-sm font-medium cursor-pointer transition-all select-none";
  const idle =
    "border-slate-700 bg-slate-800/80 text-slate-300 hover:border-cyan-500/50 hover:text-cyan-200";
  const activeClasses =
    "border-cyan-400 bg-cyan-500/20 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.2)]";
  return (
    <button type="button" onClick={onClick} className={`${base} ${active ? activeClasses : idle}`}>
      {children}
    </button>
  );
}
