"use client";

import { useState } from "react";

import Link from "next/link";

import { useProductApp } from "./provider";
import { PhaseSectionIntro, SectionCard, StatusPill, workflowStageById } from "./shared";

export function AuditorDetailPage({ contentId }: { contentId: string }) {
  const {
    contents,
    getContentById,
    getRequestForContentId,
    getFeedbackForContentId,
    isSavingContent,
    updateContent,
    submitFeedback,
  } = useProductApp();
  const [feedbackNote, setFeedbackNote] = useState("");
  const content = getContentById(contentId);
  const [draftBody, setDraftBody] = useState(content?.body ?? "");
  const linkedRequest = content ? getRequestForContentId(content.id) : null;
  const selectedFeedback = content ? getFeedbackForContentId(content.id) : [];

  async function copySelectedContent() {
    if (!content) {
      return;
    }

    await navigator.clipboard.writeText(content.body);
  }

  async function handleSubmitFeedback() {
    if (!content || !feedbackNote.trim()) {
      return;
    }

    const result = await submitFeedback(content.id, feedbackNote);

    if (result) {
      setFeedbackNote("");
    }
  }

  return (
    <section className="phase-section">
      <PhaseSectionIntro stage={workflowStageById.auditor} />

      <div className="grid-main">
        <div className="column-main">
          <SectionCard title="Revisao e aprovacao" subtitle="Edicao humana obrigatoria">
            {content ? (
              <>
                <div className="review-meta">
                  <div>
                    <h3>{content.title}</h3>
                    <p>{content.angle}</p>
                  </div>
                  <StatusPill status={content.status} />
                </div>

                {linkedRequest && (
                  <div className="linked-card">
                    <strong>{linkedRequest.format}</strong>
                    <span>{linkedRequest.topic}</span>
                  </div>
                )}

                <label className="field">
                  <span>Texto final</span>
                  <textarea
                    value={draftBody}
                    onChange={(event) => setDraftBody(event.target.value)}
                    className="editor"
                    data-testid="generated-content-editor"
                  />
                </label>

                <details className="prompt-preview">
                  <summary>Ver contexto usado na geracao</summary>
                  <pre>{content.promptPreview}</pre>
                </details>

                <div className="button-row">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => void updateContent(content.id, { body: draftBody })}
                    disabled={isSavingContent}
                  >
                    Salvar rascunho
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      void updateContent(content.id, {
                        body: draftBody,
                        status: "revisado",
                      })
                    }
                    disabled={isSavingContent}
                  >
                    Marcar revisado
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() =>
                      void updateContent(content.id, {
                        body: draftBody,
                        status: "aprovado",
                      })
                    }
                    disabled={isSavingContent}
                  >
                    Aprovar
                  </button>
                </div>

                <div className="button-row">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => void copySelectedContent()}
                  >
                    Copiar texto
                  </button>
                  <Link href="/admin" className="secondary-button">
                    Ir para Admin
                  </Link>
                </div>

                <label className="field">
                  <span>Feedback para calibrar as proximas pecas</span>
                  <textarea
                    value={feedbackNote}
                    onChange={(event) => setFeedbackNote(event.target.value)}
                    placeholder="Ex.: manter mais firmeza na abertura e evitar repetir o mesmo CTA."
                  />
                </label>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => void handleSubmitFeedback()}
                >
                  Registrar feedback
                </button>

                {selectedFeedback.length > 0 && (
                  <div className="feedback-stack">
                    {selectedFeedback.map((item) => (
                      <article key={item.id} className="feedback-card">
                        <strong>{new Date(item.createdAt).toLocaleString("pt-BR")}</strong>
                        <p>{item.note}</p>
                      </article>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="empty-state">
                Conteudo nao encontrado. Volte ao historico para selecionar outra peca.
              </p>
            )}
          </SectionCard>
        </div>

        <aside className="column-side">
          <SectionCard title="Historico reutilizavel" subtitle="Memoria editorial">
            {contents.length ? (
              <div className="history-list">
                {contents.map((item) => {
                  const request = getRequestForContentId(item.id);

                  return (
                    <Link
                      key={item.id}
                      href={`/auditor/${item.id}`}
                      className={item.id === contentId ? "history-item active" : "history-item"}
                    >
                      <div className="history-top">
                        <strong>{item.title}</strong>
                        <StatusPill status={item.status} />
                      </div>
                      <span>{request?.topic ?? "Pauta sem referencia"}</span>
                      <small>
                        {request?.format ?? "Formato nao informado"} ·{" "}
                        {new Date(item.createdAt).toLocaleDateString("pt-BR")}
                      </small>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="empty-state">
                O historico aparece aqui conforme a equipe gera e revisa novas pecas.
              </p>
            )}
          </SectionCard>
        </aside>
      </div>
    </section>
  );
}
