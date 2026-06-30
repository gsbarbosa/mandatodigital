"use client";

import type { ReactNode } from "react";

import { usePathname, useSearchParams } from "next/navigation";

import { AppStatusToast } from "./app-status-toast";
import { useInitialProductFeedbackForm, useProductApp } from "./provider";
import { SentinelRefreshPill } from "./sentinel-refresh-pill";
import {
  ProductShellFeedbackDrawer,
  ProductShellFeedbackFab,
  ProductShellSessionBar,
} from "./product-shell-shared";
import { agentThemeClassName, resolveAgentThemeFromPathname } from "@/lib/agent-theme";

import { HeygenDevKeyPanel, useHeygenDevPanelReveal } from "./heygen-dev-key-panel";
import { WorkflowPipelineBar } from "./workflow-pipeline-bar";

/** Navegação clássica — pipeline de 5 agentes (preservada para rollback). */
export function ProductShellV1({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isCuradorFocusMode =
    pathname === "/sentinela" ||
    pathname === "/curador" ||
    pathname === "/curador-v1" ||
    pathname === "/curador-v2" ||
    pathname === "/criativo" ||
    pathname.startsWith("/criativo/") ||
    pathname === "/auditor" ||
    pathname.startsWith("/auditor/") ||
    pathname === "/distribuidor";
  const openFeedbackParam = searchParams.get("e2e");
  const isFeedbackForcedOpen = openFeedbackParam === "open-feedback";
  const {
    profile,
    requests,
    contents,
    statusMessage,
    errorMessage,
    dismissAppMessages,
    isFeedbackWidgetOpen,
    setFeedbackWidgetOpen,
    productFeedbacks,
    submitProductFeedback,
    isSubmittingProductFeedback,
    sessionUser,
    signOut,
    isRefreshingSentinel,
  } = useProductApp();
  const [productFeedbackForm, setProductFeedbackForm] = useInitialProductFeedbackForm();
  const isDrawerOpen = isFeedbackForcedOpen || isFeedbackWidgetOpen;
  const {
    open: heygenDevOpen,
    setOpen: setHeygenDevOpen,
    handleSecretClick: handleHeygenDistribuidorSecretClick,
  } = useHeygenDevPanelReveal();

  async function handleSubmitProductFeedback() {
    const result = await submitProductFeedback(productFeedbackForm);

    if (result) {
      setProductFeedbackForm({
        screen: "",
        workedWell: "",
        issueObserved: "",
      });
    }
  }

  const agentTheme = resolveAgentThemeFromPathname(pathname);

  return (
    <main
      className={
        isCuradorFocusMode
          ? `app-shell app-shell-persona ${agentThemeClassName(agentTheme)}`
          : "app-shell"
      }
      data-product-nav="v1"
    >
      {sessionUser && (
        <header
          className={
            isCuradorFocusMode ? "app-top-bar app-top-bar-focus" : "app-top-bar"
          }
        >
          <ProductShellSessionBar sessionUser={sessionUser} onSignOut={signOut} />
          {isRefreshingSentinel ? <SentinelRefreshPill /> : null}
          {isCuradorFocusMode ? (
            <>
              <WorkflowPipelineBar
                onDistribuidorSecretClick={handleHeygenDistribuidorSecretClick}
              />
              <HeygenDevKeyPanel
                open={heygenDevOpen}
                onClose={() => setHeygenDevOpen(false)}
              />
            </>
          ) : null}
        </header>
      )}

      {isCuradorFocusMode ? null : (
        <>
          <section className="hero">
            <div>
              <p className="eyebrow">MVP interno em operação</p>
              <h1>Mandato Digital</h1>
              <p className="hero-copy">
                Fluxo em 5 etapas: do radar de temas a publicação. Nesta fase liberamos
                apenas o Curador para calibragem de persona e avatar.
              </p>
            </div>

            <div className="hero-metrics">
              <div className="metric-card">
                <strong>{profile ? "1" : "0"}</strong>
                <span>perfil ativo</span>
              </div>
              <div className="metric-card">
                <strong>{requests.length}</strong>
                <span>pautas registradas</span>
              </div>
              <div className="metric-card">
                <strong>{contents.length}</strong>
                <span>peças no histórico</span>
              </div>
            </div>
          </section>

          <section className="menu-panel menu-panel-pipeline">
            <WorkflowPipelineBar />
          </section>
        </>
      )}

      {(statusMessage || errorMessage) && (
        <AppStatusToast
          message={errorMessage ?? statusMessage ?? ""}
          variant={errorMessage ? "error" : "success"}
          onDismiss={dismissAppMessages}
        />
      )}

      {children}

      <ProductShellFeedbackFab
        isDrawerOpen={isDrawerOpen}
        onToggle={() => setFeedbackWidgetOpen((current) => !current)}
      />

      <ProductShellFeedbackDrawer
        isDrawerOpen={isDrawerOpen}
        onClose={() => setFeedbackWidgetOpen(false)}
        productFeedbackForm={productFeedbackForm}
        setProductFeedbackForm={setProductFeedbackForm}
        onSubmit={handleSubmitProductFeedback}
        isSubmittingProductFeedback={isSubmittingProductFeedback}
        productFeedbacks={productFeedbacks}
      />
    </main>
  );
}
