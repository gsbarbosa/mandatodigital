"use client";

import { useEffect, useState } from "react";

import { AppSpinner } from "@/components/product/app-loading";
import {
  AUDITOR_FACT_CHECK_LOADING_INTERVAL_MS,
  AUDITOR_FACT_CHECK_LOADING_MESSAGES,
} from "@/lib/auditor/fact-check-loading-messages";

function useRotatingMessage(active: boolean, messages: readonly string[]) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setIndex(0);
      return;
    }

    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % messages.length);
    }, AUDITOR_FACT_CHECK_LOADING_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [active, messages]);

  return messages[index] ?? messages[0] ?? "";
}

export function AuditorFactCheckLoading({ active }: { active: boolean }) {
  const message = useRotatingMessage(active, AUDITOR_FACT_CHECK_LOADING_MESSAGES);

  if (!active) {
    return null;
  }

  return (
    <div className="persona-auditor-fact-check-loading persona-top-gap" role="status" aria-live="polite">
      <AppSpinner size="sm" variant="brand" />
      <div className="persona-auditor-fact-check-loading-copy">
        <strong>Validador em análise</strong>
        <p>{message}</p>
        <span className="persona-auditor-fact-check-loading-hint">
          Isso pode levar alguns segundos enquanto cruzamos o roteiro com as fontes.
        </span>
      </div>
    </div>
  );
}
