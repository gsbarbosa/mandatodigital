"use client";

import type { ReactNode } from "react";

/** Rounded selectable pill following the mock's .theme-tag styling. */
export function ThemeTagPill({
  active,
  onClick,
  disabled = false,
  children,
  themeLabel,
  sphere,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
  /** Label estável para e2e (data-theme). */
  themeLabel?: string;
  sphere?: "federal" | "estadual";
}) {
  const base =
    "px-4 py-1.5 rounded-full border text-xs sm:text-sm font-medium transition-all select-none";
  const idle =
    "border-md-border bg-md-surface-inset text-md-text-muted hover:border-[var(--curador-border)] hover:text-[var(--curador-text)] cursor-pointer";
  const activeClasses =
    "border-[var(--curador-border)] bg-[var(--curador-soft)] text-[var(--curador-text)] shadow-sm cursor-pointer";
  const disabledClasses =
    "border-md-border bg-md-surface/40 text-md-text-soft cursor-not-allowed opacity-60";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid="theme-tag-pill"
      data-theme={themeLabel}
      data-sphere={sphere}
      data-active={active ? "true" : "false"}
      aria-pressed={active}
      className={`${base} ${disabled ? disabledClasses : active ? activeClasses : idle}`}
    >
      {children}
    </button>
  );
}
