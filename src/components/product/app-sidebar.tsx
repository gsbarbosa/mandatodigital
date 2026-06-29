"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";

import {
  productNavV2Items,
  resolveProductNavV2ActiveId,
} from "@/lib/product-nav";

type AppSidebarProps = {
  onBrandSecretClick?: () => void;
};

export function AppSidebar({ onBrandSecretClick }: AppSidebarProps) {
  const pathname = usePathname();
  const activeId = resolveProductNavV2ActiveId(pathname);
  const operacao = productNavV2Items.filter((item) => item.section === "operacao");
  const configuracoes = productNavV2Items.filter((item) => item.section === "configuracoes");

  return (
    <aside className="app-sidebar" aria-label="Menu principal">
      <button
        type="button"
        className="app-brand"
        onClick={onBrandSecretClick}
        aria-label="Mandato Digital"
      >
        <span className="app-brand-mark" aria-hidden="true">
          MD
        </span>
        <span className="app-brand-copy">
          <strong>Mandato Digital</strong>
          <span>Comunicação política</span>
        </span>
      </button>

      <nav className="app-sidebar-nav">
        <p className="app-sidebar-section-label">Operação</p>
        <ul className="app-sidebar-list">
          {operacao.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href as Route}
                className={[
                  "app-sidebar-link",
                  activeId === item.id ? "is-active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-current={activeId === item.id ? "page" : undefined}
                data-testid={`operation-nav-${item.id}`}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        <p className="app-sidebar-section-label">Ajustes</p>
        <ul className="app-sidebar-list">
          {configuracoes.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href as Route}
                className={[
                  "app-sidebar-link",
                  activeId === item.id ? "is-active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-current={activeId === item.id ? "page" : undefined}
                data-testid={`operation-nav-${item.id}`}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
