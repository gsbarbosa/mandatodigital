"use client";

import { useEffect, useState } from "react";

import { DEMO_REFRESH_PAUTA_HINT, isDemoModeActiveForEmail } from "@/lib/demo-mode";
import { useProductApp } from "./provider";

type RefreshPautasButtonProps = {
  isLoading: boolean;
  onClick: () => void;
  disabled?: boolean;
  /** Tooltip quando desabilitado (créditos, DEMO, etc.). */
  disabledTitle?: string;
  variant?: "persona" | "monitor";
  className?: string;
};

export function RefreshPautasButton({
  isLoading,
  onClick,
  disabled = false,
  disabledTitle,
  variant = "persona",
  className = "",
}: RefreshPautasButtonProps) {
  const { sessionUser } = useProductApp();
  const [pending, setPending] = useState(false);
  const busy = isLoading || pending;
  /** Conta de demonstração: refresh manual bloqueado (só ciclo da manhã). */
  const demoLocked = isDemoModeActiveForEmail(sessionUser?.email);
  const isDisabled = disabled || demoLocked;
  const lockTitle = disabledTitle ?? (demoLocked ? DEMO_REFRESH_PAUTA_HINT : undefined);

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
      data-guest-locked={demoLocked ? "true" : "false"}
      className={`refresh-pautas-btn ${variantClass}${busy ? " is-loading" : ""}${isDisabled ? " is-locked" : ""}${className ? ` ${className}` : ""}`}
      onClick={handleClick}
      disabled={busy || isDisabled}
      aria-busy={busy}
      aria-disabled={isDisabled}
      aria-live="polite"
      title={isDisabled ? lockTitle ?? "Atualizar pautas indisponível" : "Atualizar pautas"}
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
