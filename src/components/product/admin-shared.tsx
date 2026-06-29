"use client";

import type { EvaluationReport, ProductFeedback } from "@/lib/types";

import {
  EvaluationStatusPill,
  ProductFeedbackCriticalityPill,
  ProductFeedbackPill,
  evaluationCriterionLabelMap,
  evaluationModeLabelMap,
} from "./shared";

export function EvaluationReportView({
  report,
}: {
  report: EvaluationReport;
}) {
  return (
    <div className="evaluation-report-card" data-testid="evaluation-report-card">
      <div className="feedback-drawer-header compact">
        <div>
          <p className="eyebrow">Relatório selecionado</p>
          <h3>Leitura do juiz da LLM</h3>
        </div>
      </div>

      <div className="feedback-analysis-badges">
        <EvaluationStatusPill status={report.run.status} />
        <span className="analysis-pill analysis-melhoria">
          {evaluationModeLabelMap[report.run.mode]}
        </span>
      </div>

      <p className="feedback-line">
        <span>Modelo gerado:</span> {report.run.primaryProvider} /{" "}
        {report.run.primaryModel || "não informado"}
      </p>
      <p className="feedback-line">
        <span>Juiz:</span> {report.run.judgeProvider || "não informado"} /{" "}
        {report.run.judgeModel || "não informado"}
      </p>
      <p className="feedback-line">
        <span>Recomendacao:</span>{" "}
        {report.run.winnerRecommendation || "Sem recomendacao registrada."}
      </p>
      <p className="feedback-line">
        <span>Racional:</span>{" "}
        {report.run.judgeSummary || report.run.errorMessage || "Sem resumo registrado."}
      </p>

      {report.candidates.map((candidate) => (
        <article
          key={candidate.id}
          className="evaluation-candidate-card"
          data-testid="evaluation-candidate-card"
        >
          <div className="feedback-analysis-top">
            <div>
              <strong>
                {candidate.role === "primary" ? "Candidato principal" : "Candidato sombra"}
              </strong>
              <p className="feedback-line">
                <span>Nota final:</span> {candidate.totalScore.toFixed(1)}
              </p>
            </div>
            <div className="feedback-analysis-badges">
              <span className="analysis-pill analysis-melhoria">{candidate.provider}</span>
            </div>
          </div>

          <div className="evaluation-score-list">
            {candidate.scores.map((score) => (
              <div key={score.id} className="evaluation-score-row">
                <div>
                  <strong>{evaluationCriterionLabelMap[score.criterion]}</strong>
                  <p>{score.rationale}</p>
                </div>
                <span className="evaluation-score-value">{score.score.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

export function ProductFeedbackSummaryList({
  items,
}: {
  items: ProductFeedback[];
}) {
  if (!items.length) {
    return (
      <p className="empty-state">
        O menu de admin exibira aqui os ultimos feedbacks do produto assim que o
        primeiro relato for enviado.
      </p>
    );
  }

  return (
    <div className="feedback-stack">
      {items.map((item) => (
        <article key={item.id} className="feedback-analysis-card">
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

          <p className="feedback-line">
            <span>Observacao:</span> {item.issueObserved}
          </p>
          <p className="feedback-line">
            <span>Proximo passo:</span> {item.suggestedAction}
          </p>
        </article>
      ))}
    </div>
  );
}
