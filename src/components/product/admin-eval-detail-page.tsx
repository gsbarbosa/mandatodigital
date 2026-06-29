"use client";

import Link from "next/link";

import { EvaluationReportView, ProductFeedbackSummaryList } from "./admin-shared";
import { useProductApp } from "./provider";
import { PhaseSectionIntro, SectionCard, workflowStageById } from "./shared";

export function AdminEvalDetailPage({ runId }: { runId: string }) {
  const { evaluationReports, getEvaluationReportById, productFeedbacks } = useProductApp();
  const report = getEvaluationReportById(runId);

  return (
    <section className="phase-section">
      <PhaseSectionIntro stage={workflowStageById.admin} />

      <div className="grid-main">
        <div className="column-main">
          <SectionCard title="Detalhe da avaliação" subtitle="Run selecionado">
            {report ? (
              <EvaluationReportView report={report} />
            ) : (
              <p className="empty-state">
                Relatório não encontrado. Volte ao Admin para selecionar outra execução.
              </p>
            )}

            <div className="button-row">
              <Link href="/admin" className="secondary-button">
                Voltar para Admin
              </Link>
            </div>
          </SectionCard>
        </div>

        <aside className="column-side">
          <SectionCard title="Últimos relatórios" subtitle="Histórico do core">
            {evaluationReports.length ? (
              <div className="history-list eval-history-list">
                {evaluationReports.map((item) => (
                  <Link
                    key={item.run.id}
                    href={`/admin/evals/${item.run.id}`}
                    className={item.run.id === runId ? "history-item active" : "history-item"}
                  >
                    <div className="history-top">
                      <strong>{item.run.primaryModel || "Modelo não informado"}</strong>
                    </div>
                    <span>Nota {item.winner?.totalScore.toFixed(1) ?? "--"}</span>
                    <small>{new Date(item.run.createdAt).toLocaleString("pt-BR")}</small>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="empty-state">
                Ainda não existe um relatório de avaliação disponivel para detalhe.
              </p>
            )}
          </SectionCard>

          <SectionCard title="Feedback de produto" subtitle="Contexto operacional">
            <ProductFeedbackSummaryList items={productFeedbacks.slice(0, 3)} />
          </SectionCard>
        </aside>
      </div>
    </section>
  );
}
