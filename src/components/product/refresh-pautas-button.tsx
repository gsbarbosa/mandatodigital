"use client";

import { useEffect, useState } from "react";

import { DEMO_REFRESH_PAUTA_HINT, isDemoMode } from "@/lib/demo-mode";

type RefreshPautasButtonProps = {
  isLoading: boolean;
  onClick: () => void;
  disabled?: boolean;
  variant?: "persona" | "monitor";
  className?: string;
};

export function RefreshPautasButton({
  isLoading,
  onClick,
  disabled = false,
  variant = "persona",
  className = "",
}: RefreshPautasButtonProps) {
  const [pending, setPending] = useState(false);
  const busy = isLoading || pending;
  const demoLocked = isDemoMode();
  const isDisabled = disabled || demoLocked;

  useEffect(() => {
    if (!isLoading) {
      setPending(false);
    }
  }, [isLoading]);

  function handleClick() {
    if (busy || isDisabled) {
      return;
    }

    setPending(true);
    onClick();
  }

  const variantClass =
    variant === "monitor"
      ? "refresh-pautas-btn--monitor"
      : "persona-btn persona-btn-secondary persona-btn-large refresh-pautas-btn--persona";

  return (
    <button
      type="button"
      data-testid="refresh-pautas-button"
      className={`refresh-pautas-btn ${variantClass}${busy ? " is-loading" : ""}${className ? ` ${className}` : ""}`}
      onClick={handleClick}
      disabled={busy || isDisabled}
      aria-busy={busy}
      aria-live="polite"
      title={demoLocked ? DEMO_REFRESH_PAUTA_HINT : "Atualizar pautas"}
    >
      <span className="refresh-pautas-btn__content">
        {busy ? (
          <span className="persona-loading-row">
            <span className="persona-spinner" aria-hidden="true" />
            Atualizando pautas...
          </span>
        ) : (
          "Atualizar pautas"
        )}
      </span>
      {busy ? <span className="refresh-pautas-btn__progress" aria-hidden="true" /> : null}
    </button>
  );
}
