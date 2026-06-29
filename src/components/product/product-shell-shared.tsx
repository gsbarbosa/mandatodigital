"use client";

import {
  ProductFeedbackCriticalityPill,
  ProductFeedbackPill,
  type ProductFeedbackFormState,
} from "./shared";
import type { ProductFeedback } from "@/lib/types";
import type { SessionUser } from "@/lib/auth/session";

export function formatSessionEmail(email: string) {
  const trimmed = email.trim();
  if (trimmed.length <= 36) {
    return trimmed;
  }
  const [local, domain] = trimmed.split("@");
  if (!domain) {
    return `${trimmed.slice(0, 33)}...`;
  }
  const shortLocal = local.length > 14 ? `${local.slice(0, 11)}...` : local;
  return `${shortLocal}@${domain}`;
}

type ProductShellSessionBarProps = {
  sessionUser: SessionUser;
  onSignOut: () => void | Promise<void>;
};

export function ProductShellSessionBar({
  sessionUser,
  onSignOut,
}: ProductShellSessionBarProps) {
  return (
    <div className="session-bar">
      <div className="session-bar-user">
        <span className="session-bar-avatar" aria-hidden="true">
          {sessionUser.email.slice(0, 1).toUpperCase()}
        </span>
        <span className="session-bar-email" title={sessionUser.email}>
          {formatSessionEmail(sessionUser.email)}
        </span>
      </div>
      <button type="button" className="session-bar-logout" onClick={() => void onSignOut()}>
        Sair
      </button>
    </div>
  );
}

type ProductShellFeedbackDrawerProps = {
  isDrawerOpen: boolean;
  onClose: () => void;
  productFeedbackForm: ProductFeedbackFormState;
  setProductFeedbackForm: React.Dispatch<React.SetStateAction<ProductFeedbackFormState>>;
  onSubmit: () => void | Promise<void>;
  isSubmittingProductFeedback: boolean;
  productFeedbacks: ProductFeedback[];
};

export function ProductShellFeedbackDrawer({
  isDrawerOpen,
  onClose,
  productFeedbackForm,
  setProductFeedbackForm,
  onSubmit,
  isSubmittingProductFeedback,
  productFeedbacks,
}: ProductShellFeedbackDrawerProps) {
  return (
    <>
      {isDrawerOpen ? (
        <button
          type="button"
          className="feedback-overlay"
          aria-label="Fechar painel de feedback"
          onClick={onClose}
        />
      ) : null}

      <aside
        className={`feedback-drawer ${isDrawerOpen ? "open" : ""}`}
        aria-hidden={!isDrawerOpen}
        data-testid="feedback-drawer"
        data-state={isDrawerOpen ? "open" : "closed"}
      >
        <div className="feedback-drawer-header">
          <div>
            <p className="eyebrow">Canal do produto</p>
            <h2 data-testid="feedback-drawer-heading">O que funcionou e o que não funcionou</h2>
          </div>
          <button type="button" className="feedback-close" onClick={onClose}>
            Fechar
          </button>
        </div>

        <p className="feedback-helper">
          Seu parceiro de produto pode descrever a experiencia aqui. A IA analisa automaticamente se
          o relato indica bug, melhoria ou algo fora do escopo atual da entrega.
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
            placeholder="Ex.: onboarding, geração de pauta, revisão final"
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
            placeholder="Ex.: a geração saiu rápida e as 3 versões vieram com boa variação"
            data-testid="product-feedback-worked-well"
          />
        </label>

        <label className="field">
          <span>O que não funcionou / observação</span>
          <textarea
            value={productFeedbackForm.issueObserved}
            onChange={(event) =>
              setProductFeedbackForm((current) => ({
                ...current,
                issueObserved: event.target.value,
              }))
            }
            placeholder="Ex.: ao salvar o onboarding parece que faltam pistas visuais"
            data-testid="product-feedback-issue"
          />
        </label>

        <button
          type="button"
          className="primary-button"
          onClick={() => void onSubmit()}
          disabled={isSubmittingProductFeedback}
          data-testid="submit-product-feedback"
        >
          {isSubmittingProductFeedback ? "Analisando feedback..." : "Analisar feedback"}
        </button>

        <div className="product-feedback-history">
          <div className="feedback-drawer-header compact">
            <div>
              <p className="eyebrow">Ultimas analises</p>
              <h3>Histórico de feedback do produto</h3>
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

                  {item.screen ? (
                    <p className="feedback-line">
                      <span>Tela:</span> {item.screen}
                    </p>
                  ) : null}

                  {item.workedWell ? (
                    <p className="feedback-line">
                      <span>Funcionou bem:</span> {item.workedWell}
                    </p>
                  ) : null}

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
              As analises de produto aparecem aqui assim que o primeiro feedback for enviado.
            </p>
          )}
        </div>
      </aside>
    </>
  );
}

type ProductShellFeedbackFabProps = {
  isDrawerOpen: boolean;
  onToggle: () => void;
};

export function ProductShellFeedbackFab({ isDrawerOpen, onToggle }: ProductShellFeedbackFabProps) {
  return (
    <button type="button" className="feedback-fab" onClick={onToggle} data-testid="feedback-fab">
      {isDrawerOpen ? "Fechar feedback" : "Feedback do produto"}
    </button>
  );
}
