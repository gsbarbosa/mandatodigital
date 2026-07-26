"use client";

import { APPEARANCE_OPTIONS, type AppearancePreference } from "@/lib/appearance";
import { useAppearance } from "@/components/theme-provider";

type AppearanceToggleProps = {
  className?: string;
  /** compact = ícones/labels curtos para sidebar e header */
  size?: "sm" | "md";
};

export function AppearanceToggle({ className = "", size = "sm" }: AppearanceToggleProps) {
  const { preference, setPreference } = useAppearance();

  const shortLabel = (value: AppearancePreference) => {
    if (value === "light") return "Claro";
    if (value === "dark") return "Escuro";
    return "Sistema";
  };

  return (
    <div
      role="radiogroup"
      aria-label="Aparência"
      className={`appearance-toggle flex rounded-lg border border-[var(--border)] bg-[var(--surface-inset)] p-0.5 ${className}`}
    >
      {APPEARANCE_OPTIONS.map((option) => {
        const selected = preference === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.label}
            title={option.label}
            onClick={() => setPreference(option.value)}
            className={`flex-1 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
              size === "sm" ? "px-2 py-1.5 text-[11px]" : "px-3 py-2 text-sm"
            } ${
              selected
                ? "bg-[var(--surface)] text-[var(--text)] shadow-sm"
                : "text-[var(--text-soft)] hover:text-[var(--text)]"
            }`}
          >
            {shortLabel(option.value)}
          </button>
        );
      })}
    </div>
  );
}
