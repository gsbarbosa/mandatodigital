"use client";

import type { ReactNode } from "react";

import { usePathname, useSearchParams } from "next/navigation";

import { useInitialProductFeedbackForm, useProductApp } from "./provider";
import {
  ProductFeedbackCriticalityPill,
  ProductFeedbackPill,
} from "./shared";
import { agentThemeClassName, resolveAgentThemeFromPathname } from "@/lib/agent-theme";

import { HeygenDevKeyPanel, useHeygenDevPanelReveal } from "./heygen-dev-key-panel";
import { NavSidebar } from "./nav-sidebar";
import { OnboardingModals } from "./onboarding-modals";
import { OnboardingTracker } from "./onboarding-tracker";

/** Oculto na UI por enquanto; drawer segue acessivel via ?e2e=open-feedback nos testes. */
const PRODUCT_FEEDBACK_WIDGET_ENABLED = false;

const LEGACY_ROUTE_PREFIXES = [
  "/curador",
  "/criativo",
  "/independente",
  "/auditor",
  "/distribuidor",
  "/admin",
  "/sentinela",
];

function isLegacyRoute(pathname: string) {
  return LEGACY_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`) || pathname.startsWith(`${prefix}-`),
  );
}

export function ProductShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const openFeedbackParam = searchParams.get("e2e");
  const isFeedbackForcedOpen = openFeedbackParam === "open-feedback";
  const {
    statusMessage,
    errorMessage,
    dismissMessages,
    isFeedbackWidgetOpen,
    setFeedbackWidgetOpen,
    productFeedbacks,
    submitProductFeedback,
    isSubmittingProductFeedback,
    sessionUser,
    signOut,
  } = useProductApp();
  const [productFeedbackForm, setProductFeedbackForm] = useInitialProductFeedbackForm();
  const isDrawerOpen =
    isFeedbackForcedOpen ||
    (PRODUCT_FEEDBACK_WIDGET_ENABLED && isFeedbackWidgetOpen);
  const {
    open: heygenDevOpen,
    setOpen: setHeygenDevOpen,
    handleSecretClick: handleHeygenLogoSecretClick,
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

  const legacyRoute = isLegacyRoute(pathname);
  const agentTheme = resolveAgentThemeFromPathname(pathname);

  return (
    <div className="h-screen flex overflow-hidden bg-[#0B0F19] text-slate-300">
      <NavSidebar
        sessionEmail={sessionUser?.email ?? null}
        onSignOut={() => void signOut()}
        onLogoSecretClick={handleHeygenLogoSecretClick}
      />

      <main className="flex-1 overflow-y-auto bg-gradient-to-b from-[#0B0F19] to-slate-900 relative">
        <OnboardingTracker />
        <OnboardingModals />

        <HeygenDevKeyPanel
          open={heygenDevOpen}
          onClose={() => setHeygenDevOpen(false)}
        />

        {(statusMessage || errorMessage) && (
          <div
            className={`status-toast ${errorMessage ? "error" : "success"}`}
            role={errorMessage ? "alert" : "status"}
            aria-live="polite"
          >
            <p className="status-toast-text">{errorMessage ?? statusMessage}</p>
            <button
              type="button"
              className="status-toast-dismiss"
              aria-label="Fechar aviso"
              onClick={dismissMessages}
            >
              ×
            </button>
          </div>
        )}

        {legacyRoute ? (
          <div className={`app-shell app-shell-persona ${agentThemeClassName(agentTheme)}`}>
            {children}
          </div>
        ) : (
          children
        )}

        {PRODUCT_FEEDBACK_WIDGET_ENABLED && (
          <button
            type="button"
            className="feedback-fab"
            onClick={() => setFeedbackWidgetOpen((current) => !current)}
            data-testid="feedback-fab"
          >
            {isDrawerOpen ? "Fechar feedback" : "Feedback do produto"}
          </button>
        )}

        {isDrawerOpen && (
          <button
            type="button"
            className="feedback-overlay"
            aria-label="Fechar painel de feedback"
            onClick={() => setFeedbackWidgetOpen(false)}
          />
        )}

        <aside
          className={`feedback-drawer ${isDrawerOpen ? "open" : ""}`}
          aria-hidden={!isDrawerOpen}
          data-testid="feedback-drawer"
          data-state={isDrawerOpen ? "open" : "closed"}
        >
          <div className="feedback-drawer-header">
            <div>
              <p className="eyebrow">Canal do produto</p>
              <h2 data-testid="feedback-drawer-heading">
                O que funcionou e o que nao funcionou
              </h2>
            </div>
            <button
              type="button"
              className="feedback-close"
              onClick={() => setFeedbackWidgetOpen(false)}
            >
              Fechar
            </button>
          </div>

          <p className="feedback-helper">
            Seu parceiro de produto pode descrever a experiencia aqui. A IA analisa
            automaticamente se o relato indica bug, melhoria ou algo fora do escopo
            atual da entrega.
          </p>

          <label className="field">
            <span>Tela / fluxo</span>
            <input
              value={productFeedbackForm.screen}
              onChange={(event) =>
                setProductFeedbackForm((current) => ({
                  ...current,
                  screen: event.target.value,
                }))
              }
              placeholder="Ex.: onboarding, geracao de pauta, revisao final"
              data-testid="product-feedback-screen"
            />
          </label>

          <label className="field">
            <span>O que funcionou bem</span>
            <textarea
              value={productFeedbackForm.workedWell}
              onChange={(event) =>
                setProductFeedbackForm((current) => ({
                  ...current,
                  workedWell: event.target.value,
                }))
              }
              placeholder="Ex.: a geracao saiu rapida e as 3 versoes vieram com boa variacao"
              data-testid="product-feedback-worked-well"
            />
          </label>

          <label className="field">
            <span>O que nao funcionou / observacao</span>
            <textarea
              value={productFeedbackForm.issueObserved}
              onChange={(event) =>
                setProductFeedbackForm((current) => ({
                  ...current,
                  issueObserved: event.target.value,
                }))
              }
              placeholder="Ex.: ao salvar o onboarding parece que faltam pistas visuais; ou entao o botao nao salvou nada"
              data-testid="product-feedback-issue"
            />
          </label>

          <button
            type="button"
            className="primary-button"
            onClick={() => void handleSubmitProductFeedback()}
            disabled={isSubmittingProductFeedback}
            data-testid="submit-product-feedback"
          >
            {isSubmittingProductFeedback ? "Analisando feedback..." : "Analisar feedback"}
          </button>

          <div className="product-feedback-history">
            <div className="feedback-drawer-header compact">
              <div>
                <p className="eyebrow">Ultimas analises</p>
                <h3>Historico de feedback do produto</h3>
              </div>
            </div>

            {productFeedbacks.length ? (
              <div className="feedback-stack">
                {productFeedbacks.map((item) => (
                  <article
                    key={item.id}
                    className="feedback-analysis-card"
                    data-testid="product-feedback-card"
                  >
                    <div className="feedback-analysis-top">
                      <div className="feedback-analysis-badges">
                        <ProductFeedbackPill classification={item.classification} />
                        <ProductFeedbackCriticalityPill criticality={item.criticality} />
                      </div>
                      <strong>{new Date(item.createdAt).toLocaleString("pt-BR")}</strong>
                    </div>

                    {item.screen && (
                      <p className="feedback-line">
                        <span>Tela:</span> {item.screen}
                      </p>
                    )}

                    {item.workedWell && (
                      <p className="feedback-line">
                        <span>Funcionou bem:</span> {item.workedWell}
                      </p>
                    )}

                    <p className="feedback-line">
                      <span>Observacao:</span> {item.issueObserved}
                    </p>
                    <p className="feedback-line">
                      <span>Leitura da IA:</span> {item.rationale}
                    </p>
                    <p className="feedback-line">
                      <span>Escopo atual:</span> {item.scopeAssessment}
                    </p>
                    <p className="feedback-line">
                      <span>Proximo passo:</span> {item.suggestedAction}
                    </p>
                    <p className="feedback-line">
                      <span>Implementar agora:</span> {item.implementationPrompt}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="empty-state">
                As analises de produto aparecem aqui assim que o primeiro feedback for
                enviado.
              </p>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
