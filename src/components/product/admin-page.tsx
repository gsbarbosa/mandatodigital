"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { useProductApp } from "./provider";
import { EvaluationStatusPill, PhaseSectionIntro, SectionCard, workflowStageById } from "./shared";
import { ProductFeedbackSummaryList } from "./admin-shared";

export function AdminPage() {
  const router = useRouter();
  const {
    requestsWithContent,
    evaluationReports,
    isLoadingEvaluations,
    reloadEvaluationReports,
    evaluateContentRequest,
    isEvaluatingContentRequestId,
    productFeedbacks,
    setFeedbackWidgetOpen,
  } = useProductApp();

  async function handleEvaluateContentRequest(contentRequestId: string) {
    const report = await evaluateContentRequest(contentRequestId);

    if (report) {
      router.push(`/admin/evals/${report.run.id}`);
    }
  }

  return (
    <section className="phase-section">
      <PhaseSectionIntro stage={workflowStageById.admin} />

      <div className="grid-main">
        <div className="column-main">
          <SectionCard title="Avaliacao do core" subtitle="Admin da LLM">
            <div className="button-row">
              <button
                type="button"
                className="ghost-button"
                onClick={() => void reloadEvaluationReports()}
                disabled={isLoadingEvaluations}
              >
                {isLoadingEvaluations ? "Atualizando..." : "Atualizar relatorios"}
              </button>
            </div>

            <div className="feedback-stack">
              {requestsWithContent.length ? (
                requestsWithContent.slice(0, 6).map((request) => (
                  <div key={request.id} className="linked-card">
                    <strong>{request.topic}</strong>
                    <span>
                      {request.format} · {new Date(request.createdAt).toLocaleDateString("pt-BR")}
                    </span>
                    <div className="button-row">
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => void handleEvaluateContentRequest(request.id)}
                        disabled={isEvaluatingContentRequestId === request.id}
                        data-testid="evaluate-selected-request"
                      >
                        {isEvaluatingContentRequestId === request.id
                          ? "Avaliando geracao..."
                          : "Avaliar esta pauta"}
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="empty-state">
                  Gere uma pauta no Criativo para liberar a avaliacao do core no Admin.
                </p>
              )}
            </div>

            {evaluationReports.length ? (
              <div className="history-list eval-history-list">
                {evaluationReports.map((report) => (
                  <Link
                    key={report.run.id}
                    href={`/admin/evals/${report.run.id}`}
                    className="history-item"
                    data-testid="evaluation-report-item"
                  >
                    <div className="history-top">
                      <strong>{report.run.winnerRecommendation || "Relatorio de avaliacao"}</strong>
                      <EvaluationStatusPill status={report.run.status} />
                    </div>
                    <span>
                      {report.run.primaryProvider} / {report.run.primaryModel || "nao informado"} ·
                      nota {report.winner?.totalScore.toFixed(1) ?? "--"}
                    </span>
                    <small>{new Date(report.run.createdAt).toLocaleString("pt-BR")}</small>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="empty-state">
                As avaliacoes do core aparecem aqui assim que a primeira execucao for julgada.
              </p>
            )}
          </SectionCard>
        </div>

        <aside className="column-side">
          <SectionCard title="Feedback de produto" subtitle="Admin operacional">
            <div className="button-row">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setFeedbackWidgetOpen(true)}
              >
                Abrir canal de feedback
              </button>
            </div>

            <ProductFeedbackSummaryList items={productFeedbacks.slice(0, 4)} />
          </SectionCard>
        </aside>
      </div>
    </section>
  );
}
