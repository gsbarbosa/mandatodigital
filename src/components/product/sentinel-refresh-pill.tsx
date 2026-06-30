"use client";

import { AppSpinner } from "@/components/product/app-loading";

export function SentinelRefreshPill() {
  return (
    <span className="app-sentinel-refresh-pill" role="status" aria-live="polite">
      <AppSpinner size="sm" variant="brand" />
      Sentinela atualizando…
    </span>
  );
}
