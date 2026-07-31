"use client";

import { isDemoMode } from "@/lib/demo-mode";

/** Selo fixo: conta de demonstração — só com DEMO_MODE. */
export function DemoAccountBadge() {
  if (!isDemoMode()) {
    return null;
  }

  return (
    <div
      role="status"
      aria-label="Conta de demonstração"
      data-testid="demo-account-badge"
      className="pointer-events-none fixed right-4 top-4 z-40 sm:right-6 sm:top-5"
    >
      <span className="inline-flex items-center gap-2 rounded-full border border-[var(--distribuidor-border)] bg-[var(--distribuidor-soft)] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--distribuidor-hover)] shadow-[0_8px_24px_rgba(15,23,42,0.12)] backdrop-blur-sm">
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--distribuidor-hover)]"
        />
        Conta de demonstração
      </span>
    </div>
  );
}
