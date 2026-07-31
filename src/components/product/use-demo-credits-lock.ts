"use client";

import { useEffect, useState } from "react";

import { isDemoMode } from "@/lib/demo-mode";

type CreditsResponse = {
  credits?: { remaining: number } | null;
};

/**
 * Em DEMO_MODE, quando os créditos vitalícios do convidado zeram, trava a
 * navegação do produto (exceto Planos/CNPJ) — ver `DEMO_UNLOCKED_PATHS`.
 */
export function useDemoCreditsLock() {
  const demoActive = isDemoMode();
  const [locked, setLocked] = useState(false);
  const [checked, setChecked] = useState(!demoActive);

  useEffect(() => {
    if (!demoActive) {
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/sentinel/credits", { credentials: "same-origin" });
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as CreditsResponse;
        if (!cancelled) {
          setLocked(Boolean(payload.credits && payload.credits.remaining <= 0));
        }
      } catch {
        // Silencioso — em falha de rede, mantém liberado.
      } finally {
        if (!cancelled) {
          setChecked(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [demoActive]);

  return { locked: demoActive && locked, checked };
}
