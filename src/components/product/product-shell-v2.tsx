"use client";

import type { ReactNode } from "react";

import { usePathname } from "next/navigation";

import { useProductApp } from "./provider";
import { ProductShellProvider } from "./product-shell-context";
import { ProductShellSessionBar } from "./product-shell-shared";
import { AppSidebar } from "./app-sidebar";
import { agentThemeClassName, resolveAgentThemeFromPathname } from "@/lib/agent-theme";
import {
  isProductNavV2FocusPath,
  resolveProductNavV2PageMeta,
} from "@/lib/product-nav";

import { HeygenDevKeyPanel, useHeygenDevPanelReveal } from "./heygen-dev-key-panel";

/** Shell operação-first — sidebar + área principal estilo produto. */
export function ProductShellV2({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isFocusMode = isProductNavV2FocusPath(pathname);
  const pageMeta = resolveProductNavV2PageMeta(pathname);
  const { statusMessage, errorMessage, sessionUser, signOut } = useProductApp();
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
            {sessionUser ? (
              <ProductShellSessionBar sessionUser={sessionUser} onSignOut={signOut} />
            ) : null}
          </header>

          {(statusMessage || errorMessage) && (
            <div className={`message-banner app-main-banner ${errorMessage ? "error" : "success"}`}>
              {errorMessage ?? statusMessage}
            </div>
          )}

          <ProductShellProvider hasPageHeader>
            <div className="app-main-content">{children}</div>
          </ProductShellProvider>
        </div>
      </div>

      <HeygenDevKeyPanel open={heygenDevOpen} onClose={() => setHeygenDevOpen(false)} />
    </main>
  );
}
