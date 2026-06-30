"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useProductApp } from "@/components/product/provider";
import { useConfigSectionStatuses } from "@/components/product/use-config-section-statuses";
import {
  countPendingConfigNavSections,
  configSectionHref,
  isConfigSectionPath,
  parseConfigSectionFromPathname,
  shouldShowAvatarInNav,
} from "@/lib/config-setup-status";
import { productNavV2ConfigItems, productNavV2OperacaoItems } from "@/lib/product-nav";

type AppSidebarProps = {
  onBrandSecretClick?: () => void;
};

export function AppSidebar({ onBrandSecretClick }: AppSidebarProps) {
  const pathname = usePathname();
  const { profileForm } = useProductApp();
  const isConfigRoute = isConfigSectionPath(pathname);
  const activeConfigSection = parseConfigSectionFromPathname(pathname);
  const { trainingAssets, hasReadyTwin } = useConfigSectionStatuses({
    probeTwin: isConfigRoute,
  });

  const showAvatarInNav = shouldShowAvatarInNav({ trainingAssets, hasReadyTwin });
  const isOnAvatarRoute = activeConfigSection === "avatar";
  const avatarComplete = !showAvatarInNav;

  const visibleConfigItems = useMemo(
    () =>
      productNavV2ConfigItems.filter(
        (item) => item.id !== "avatar" || showAvatarInNav || isOnAvatarRoute,
      ),
    [showAvatarInNav, isOnAvatarRoute],
  );

  const pendingConfigCount = countPendingConfigNavSections({
    profileForm,
    trainingAssets,
    hasReadyTwin,
    includeAvatarInNav: showAvatarInNav,
  });

  const [configExpanded, setConfigExpanded] = useState(
    pendingConfigCount > 0 || isConfigRoute,
  );

  useEffect(() => {
    if (pendingConfigCount > 0 || isConfigRoute) {
      setConfigExpanded(true);
    }
  }, [pendingConfigCount, isConfigRoute]);

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
        <ul className="app-sidebar-list app-sidebar-list-primary">
          {productNavV2OperacaoItems.map((item) => {
            const isActive =
              item.id === "inicio"
                ? pathname === "/inicio" || pathname.startsWith("/inicio/")
                : pathname === "/criativo" || pathname.startsWith("/criativo/");

            return (
              <li key={item.id}>
                <Link
                  href={item.href as Route}
                  className={["app-sidebar-link", isActive ? "is-active" : ""]
                    .filter(Boolean)
                    .join(" ")}
                  aria-current={isActive ? "page" : undefined}
                  data-testid={`operation-nav-${item.id}`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="app-sidebar-config-group">
          <button
            type="button"
            className="app-sidebar-section-toggle"
            aria-expanded={configExpanded}
            onClick={() => setConfigExpanded((current) => !current)}
          >
            <span className="app-sidebar-section-label app-sidebar-section-label-inline">
              Configuração
            </span>
            {pendingConfigCount > 0 ? (
              <span className="config-section-badge is-pending app-sidebar-section-pending">
                {pendingConfigCount} pendente{pendingConfigCount === 1 ? "" : "s"}
              </span>
            ) : null}
            <span className="app-sidebar-section-chevron" aria-hidden="true">
              {configExpanded ? "▾" : "▸"}
            </span>
          </button>

          {configExpanded ? (
            <ul className="app-sidebar-list app-sidebar-list-config">
              {visibleConfigItems.map((item) => {
                const isActive = activeConfigSection === item.id;

                return (
                  <li key={item.id}>
                    <Link
                      href={configSectionHref(item.id) as Route}
                      className={[
                        "app-sidebar-link",
                        "app-sidebar-link-config",
                        isActive ? "is-active" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      aria-current={isActive ? "page" : undefined}
                      data-testid={`operation-nav-${item.id}`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}

              {avatarComplete ? (
                <li className="app-sidebar-reconfigure-item">
                  <Link
                    href={configSectionHref("avatar") as Route}
                    className={[
                      "app-sidebar-link",
                      "app-sidebar-link-reconfigure",
                      isOnAvatarRoute ? "is-active" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    data-testid="operation-nav-avatar-reconfigure"
                  >
                    Reconfigurar avatar
                  </Link>
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>
      </nav>
    </aside>
  );
}
