"use client";

import type { ReactNode } from "react";

import { usePathname, useSearchParams } from "next/navigation";

import { useInitialProductFeedbackForm, useProductApp } from "./provider";
import {
  ProductFeedbackCriticalityPill,
  ProductFeedbackPill,
} from "./shared";
import { WorkflowPipelineBar } from "./workflow-pipeline-bar";

function formatSessionEmail(email: string) {
  const trimmed = email.trim();
  if (trimmed.length <= 36) {
    return trimmed;
  }
  const [local, domain] = trimmed.split("@");
  if (!domain) {
    return `${trimmed.slice(0, 33)}...`;
  }
  const shortLocal =
    local.length > 14 ? `${local.slice(0, 11)}...` : local;
  return `${shortLocal}@${domain}`;
}

export function ProductShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isCuradorFocusMode =
    pathname === "/curador" ||
    pathname === "/curador-v1" ||
    pathname === "/curador-v2";
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
    sessionUser,
    signOut,
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
      {sessionUser && (
        <header
          className={
            isCuradorFocusMode ? "app-top-bar app-top-bar-focus" : "app-top-bar"
          }
        >
          <div className="session-bar">
            <div className="session-bar-user">
              <span className="session-bar-avatar" aria-hidden="true">
                {sessionUser.email.slice(0, 1).toUpperCase()}
              </span>
              <span
                className="session-bar-email"
                title={sessionUser.email}
              >
                {formatSessionEmail(sessionUser.email)}
              </span>
            </div>
            <button
              type="button"
              className="session-bar-logout"
              onClick={() => void signOut()}
            >
              Sair
            </button>
          </div>
          {isCuradorFocusMode ? (
            <WorkflowPipelineBar />
          ) : null}
        </header>
      )}

      {isCuradorFocusMode ? null : (
        <>
          <section className="hero">
            <div>
              <p className="eyebrow">MVP interno em operacao</p>
              <h1>Mandato Digital</h1>
              <p className="hero-copy">
                Fluxo em 5 etapas: do radar de temas a publicacao. Nesta fase liberamos
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
                <span>pecas no historico</span>
              </div>
            </div>
          </section>

          <section className="menu-panel menu-panel-pipeline">
            <WorkflowPipelineBar />
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
