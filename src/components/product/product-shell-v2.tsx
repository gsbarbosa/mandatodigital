"use client";

import type { ReactNode } from "react";

import { usePathname } from "next/navigation";

import { AppStatusToast } from "./app-status-toast";
import { useProductApp } from "./provider";
import { SentinelRefreshPill } from "./sentinel-refresh-pill";
import { ProductShellProvider } from "./product-shell-context";
import { ProductShellSessionBar } from "./product-shell-shared";
import { AppSidebar } from "./app-sidebar";
import { agentThemeClassName, resolveAgentThemeFromPathname } from "@/lib/agent-theme";
import { parseConfigSectionFromPathname } from "@/lib/config-setup-status";
import {
  isProductNavV2FocusPath,
  resolveProductNavV2PageMeta,
} from "@/lib/product-nav";

import { HeygenDevKeyPanel, useHeygenDevPanelReveal } from "./heygen-dev-key-panel";

/** Shell operação-first — sidebar + área principal estilo produto. */
export function ProductShellV2({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const configTab = parseConfigSectionFromPathname(pathname);
  const isFocusMode = isProductNavV2FocusPath(pathname);
  const pageMeta = resolveProductNavV2PageMeta(pathname, configTab);
  const {
    statusMessage,
    errorMessage,
    dismissAppMessages,
    sessionUser,
    signOut,
    isRefreshingSentinel,
  } = useProductApp();
  const {
    open: heygenDevOpen,
    setOpen: setHeygenDevOpen,
    handleSecretClick: handleHeygenBrandSecretClick,
  } = useHeygenDevPanelReveal();

  const agentTheme = resolveAgentThemeFromPathname(pathname);
  const pageTitleTestId =
    pageMeta.id === "inicio"
      ? "inicio-heading"
      : pageMeta.id === "configuracoes"
        ? "configuracoes-heading"
        : undefined;

  if (!isFocusMode) {
    return (
      <main className="app-shell app-shell-nav-v2" data-product-nav="v2">
        {children}
      </main>
    );
  }

  return (
    <main
      className={`app-shell app-shell-nav-v2 app-shell-nav-v2-layout ${agentThemeClassName(agentTheme)}`}
      data-product-nav="v2"
    >
      <div className="app-layout-v2">
        <AppSidebar onBrandSecretClick={handleHeygenBrandSecretClick} />

        <div className="app-main">
          <header className="app-main-header">
            <div className="app-main-header-copy">
              <h1 className="app-page-title" data-testid={pageTitleTestId}>
                {pageMeta.title}
              </h1>
              {pageMeta.subtitle ? (
                <p className="app-page-subtitle">{pageMeta.subtitle}</p>
              ) : null}
            </div>
            <div className="app-main-header-actions">
              {isRefreshingSentinel ? <SentinelRefreshPill /> : null}
              {sessionUser ? (
                <ProductShellSessionBar sessionUser={sessionUser} onSignOut={signOut} />
              ) : null}
            </div>
          </header>

          <ProductShellProvider hasPageHeader>
            <div className="app-main-content">{children}</div>
          </ProductShellProvider>
        </div>
      </div>

      {statusMessage || errorMessage ? (
        <AppStatusToast
          message={errorMessage ?? statusMessage ?? ""}
          variant={errorMessage ? "error" : "success"}
          onDismiss={dismissAppMessages}
        />
      ) : null}

      <HeygenDevKeyPanel open={heygenDevOpen} onClose={() => setHeygenDevOpen(false)} />
    </main>
  );
}
