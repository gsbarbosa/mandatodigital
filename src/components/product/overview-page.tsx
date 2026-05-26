"use client";

import Link from "next/link";

import { useProductApp } from "./provider";
import { SectionCard, WorkflowStagePill, workflowStages } from "./shared";

export function OverviewPage() {
  const { profile, latestApprovedContent, evaluationReports } = useProductApp();

  return (
    <section className="phase-section">
      <div className="phase-intro-card">
        <div className="phase-intro-top">
          <div>
            <p className="eyebrow">Visao inicial</p>
            <h2>Fluxo do sistema por etapas</h2>
          </div>
          <WorkflowStagePill status="aberto" />
        </div>
        <p className="phase-intro-copy">
          O produto agora navega por fases reais. Cada rota mostra com clareza qual
          e o input, o output e o nivel de maturidade daquela etapa dentro do MVP.
        </p>
      </div>

      <div className="phase-overview-grid">
        {workflowStages.map((stage) => (
          <Link key={stage.id} href={`/${stage.id}`} className="phase-overview-card">
            <div className="phase-card-top">
              <strong>{stage.title}</strong>
              <WorkflowStagePill status={stage.status} />
            </div>
            <p>{stage.description}</p>
            <small>Input</small>
            <span>{stage.inputLabel}</span>
            <small>Output</small>
            <span>{stage.outputLabel}</span>
          </Link>
        ))}
      </div>

      <div className="grid-main">
        <div className="column-main">
          <SectionCard title="Estado atual do MVP" subtitle="Leitura operacional">
            <div className="feedback-stack">
              <div className="linked-card">
                <strong>Curador</strong>
                <span>
                  {profile
                    ? "Onboarding configurado e pronto para orientar a geracao."
                    : "Ainda sem perfil salvo para iniciar a curadoria."}
                </span>
              </div>
              <div className="linked-card">
                <strong>Auditor</strong>
                <span>
                  {latestApprovedContent
                    ? "Ja existe ao menos uma peca aprovada para seguir no pipeline."
                    : "Ainda nao existe uma peca aprovada no fluxo editorial."}
                </span>
              </div>
              <div className="linked-card">
                <strong>Admin</strong>
                <span>
                  {evaluationReports.length
                    ? `Ja existem ${evaluationReports.length} relatorios de avaliacao do core.`
                    : "As avaliacoes do core ainda nao geraram relatorios para comparacao."}
                </span>
              </div>
            </div>
          </SectionCard>
        </div>

        <aside className="column-side">
          <SectionCard title="Proximos acessos" subtitle="Atalhos do fluxo">
            <div className="button-row">
              <Link href="/curador" className="secondary-button">
                Abrir Curador
              </Link>
              <Link href="/criativo" className="secondary-button">
                Abrir Criativo
              </Link>
              <Link href="/auditor" className="secondary-button">
                Abrir Auditor
              </Link>
              <Link href="/admin" className="primary-button">
                Abrir Admin
              </Link>
            </div>
          </SectionCard>
        </aside>
      </div>
    </section>
  );
}
