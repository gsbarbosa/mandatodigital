"use client";

import { useEffect, useState } from "react";

type RefreshPautasButtonProps = {
  isLoading: boolean;
  onClick: () => void;
  disabled?: boolean;
  /** Tooltip quando desabilitado (créditos esgotados, etc.). */
  disabledTitle?: string;
  variant?: "persona" | "monitor";
  className?: string;
  /** Texto em repouso — outras páginas que reaproveitam o botão (ex.: Notícias do Dia) customizam aqui. */
  label?: string;
  /** Texto durante o carregamento. */
  loadingLabel?: string;
};

export function RefreshPautasButton({
  isLoading,
  onClick,
  disabled = false,
  disabledTitle,
  variant = "persona",
  className = "",
  label = "Atualizar pautas",
  loadingLabel = "Atualizando pautas...",
}: RefreshPautasButtonProps) {
  const [pending, setPending] = useState(false);
  const busy = isLoading || pending;
  const isDisabled = disabled;
  const lockTitle = disabledTitle;

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
      className={`refresh-pautas-btn ${variantClass}${busy ? " is-loading" : ""}${isDisabled ? " is-locked" : ""}${className ? ` ${className}` : ""}`}
      onClick={handleClick}
      disabled={busy || isDisabled}
      aria-busy={busy}
      aria-disabled={isDisabled}
      aria-live="polite"
      title={isDisabled ? lockTitle ?? `${label} indisponível` : label}
    >
      <span className="refresh-pautas-btn__content">
        {busy ? (
          <span className="persona-loading-row">
            <span className="persona-spinner" aria-hidden="true" />
            {loadingLabel}
          </span>
        ) : (
          label
        )}
      </span>
      {busy ? <span className="refresh-pautas-btn__progress" aria-hidden="true" /> : null}
    </button>
  );
}
