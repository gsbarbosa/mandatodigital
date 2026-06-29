"use client";

import type { ReactNode } from "react";

import { useProductShell } from "@/components/product/product-shell-context";

type PersonaSectionHeaderProps = {
  icon: ReactNode;
  title: string;
  description?: string;
  /** Exibe mesmo com header no shell (ex.: título diferente do shell). */
  showWhenShellHeader?: boolean;
};

/**
 * Cabeçalho visual das páginas persona (ícone + título).
 * Com shell v2, o título fica só no topo — este bloco não renderiza.
 */
export function PersonaSectionHeader({
  icon,
  title,
  description,
  showWhenShellHeader = false,
}: PersonaSectionHeaderProps) {
  const { hasPageHeader } = useProductShell();

  if (hasPageHeader && !showWhenShellHeader) {
    return null;
  }

  return (
    <div className="persona-section-header">
      <div className="persona-header-icon" aria-hidden="true">
        {icon}
      </div>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </div>
  );
}
