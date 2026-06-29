"use client";

import { useState } from "react";

import Link from "next/link";

import { useProductApp } from "./provider";
import { PhaseSectionIntro, SectionCard, StatusPill, workflowStageById } from "./shared";

export function AuditorDetailPage({ contentId }: { contentId: string }) {
  const {
    contents,
    profile,
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
          <SectionCard title="Revisão e aprovacao" subtitle="Edicao humana obrigatoria">
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
                  <summary>Ver contexto usado na geração</summary>
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
                  <span>Feedback para calibrar as próximas peças</span>
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
                Conteúdo não encontrado. Volte ao histórico para selecionar outra peça.
              </p>
            )}
          </SectionCard>
        </div>

        <aside className="column-side">
          <SectionCard title="Checklist de checagem" subtitle="Gate humano antes de aprovar">
            <div className="feedback-stack">
              <div className="linked-card">
                <strong>Agências configuradas</strong>
                <span>
                  {profile?.factCheckingSources.length
                    ? profile.factCheckingSources.join(", ")
                    : "Nenhuma agencia selecionada no setup do Auditor."}
                </span>
              </div>
              <div className="linked-card">
                <strong>Bases governamentais</strong>
                <span>
                  {profile?.hardDataSources.length
                    ? profile.hardDataSources.join(", ")
                    : "Nenhuma base hard data configurada no setup do Auditor."}
                </span>
              </div>
            </div>

            <p className="empty-state">
              Antes de aprovar, valide fatos, contexto local, aderencia ideologica,
              cumprimento das red lines e consistencia do CTA.
            </p>
          </SectionCard>

          <SectionCard title="Histórico reutilizavel" subtitle="Memória editorial">
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
                      <span>{request?.topic ?? "Pauta sem referência"}</span>
                      <small>
                        {request?.format ?? "Formato não informado"} ·{" "}
                        {new Date(item.createdAt).toLocaleDateString("pt-BR")}
                      </small>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="empty-state">
                O histórico aparece aqui conforme a equipe gera e revisa novas peças.
              </p>
            )}
          </SectionCard>
        </aside>
      </div>
    </section>
  );
}
