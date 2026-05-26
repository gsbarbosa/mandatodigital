"use client";

import type { ReactNode } from "react";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { useInitialProductFeedbackForm, useProductApp } from "./provider";
import {
  ProductFeedbackCriticalityPill,
  ProductFeedbackPill,
  dashboardMenuItems,
} from "./shared";

function isMenuItemActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ProductShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isCuradorFocusMode = pathname === "/curador";
  const openFeedbackParam = searchParams.get("e2e");
  const isFeedbackForcedOpen = openFeedbackParam === "open-feedback";
  const {
    profile,
    requests,
    contents,
    statusMessage,
    errorMessage,
    isFeedbackWidgetOpen,
    setFeedbackWidgetOpen,
    productFeedbacks,
    submitProductFeedback,
    isSubmittingProductFeedback,
  } = useProductApp();
  const [productFeedbackForm, setProductFeedbackForm] = useInitialProductFeedbackForm();
  const isDrawerOpen = isFeedbackForcedOpen || isFeedbackWidgetOpen;

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

  return (
    <main className={isCuradorFocusMode ? "app-shell app-shell-persona" : "app-shell"}>
      {isCuradorFocusMode ? null : (
        <>
          <section className="hero">
            <div>
              <p className="eyebrow">MVP interno em operacao</p>
              <h1>Mandato Digital</h1>
              <p className="hero-copy">
                Do onboarding politico a revisao final, esta versao agora organiza o
                processo em fases reais do sistema, com entrada e saida claras por
                rota.
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
                <span>pecas no historico</span>
              </div>
            </div>
          </section>

          <section className="menu-panel">
            <div>
              <p className="eyebrow">Menu do sistema</p>
              <h2>Pipeline por fase e area admin</h2>
              <p className="menu-copy">
                Cada rota deixa claro onde o processo comeca, o que ja sai do MVP e
                quais etapas ainda estao planejadas.
              </p>
            </div>

            <div className="menu-button-row">
              {dashboardMenuItems.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className={
                    isMenuItemActive(pathname, item.href) ? "menu-button active" : "menu-button"
                  }
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </section>
        </>
      )}

      {(statusMessage || errorMessage) && (
        <div className={`message-banner ${errorMessage ? "error" : "success"}`}>
          {errorMessage ?? statusMessage}
        </div>
      )}

      {children}

      <button
        type="button"
        className="feedback-fab"
        onClick={() => setFeedbackWidgetOpen((current) => !current)}
        data-testid="feedback-fab"
      >
        {isDrawerOpen ? "Fechar feedback" : "Feedback do produto"}
      </button>

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
  );
}
