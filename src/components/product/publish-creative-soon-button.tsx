"use client";

import { useId } from "react";

type PublishCreativeSoonButtonProps = {
  className?: string;
};

export function PublishCreativeSoonButton({ className }: PublishCreativeSoonButtonProps) {
  const tooltipId = useId();

  return (
    <span className={["persona-soon-btn-wrap", className].filter(Boolean).join(" ")}>
      <button
        type="button"
        className="persona-btn persona-btn-secondary persona-btn-compact persona-soon-btn"
        disabled
        aria-disabled="true"
        aria-describedby={tooltipId}
      >
        Publicar
      </button>
      <span id={tooltipId} className="persona-soon-btn-tooltip" role="tooltip">
        Disponível em breve
      </span>
    </span>
  );
}
