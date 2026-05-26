"use client";

import Link from "next/link";

import { useProductApp } from "./provider";
import { PhaseSectionIntro, SectionCard, StatusPill, workflowStageById } from "./shared";

export function AuditorPage() {
  const { contents, latestApprovedContent, getRequestForContentId } = useProductApp();

  return (
    <section className="phase-section">
      <PhaseSectionIntro stage={workflowStageById.auditor} />

      <div className="grid-main">
        <div className="column-main">
          <SectionCard title="Historico reutilizavel" subtitle="Memoria editorial">
            {contents.length ? (
              <div className="history-list">
                {contents.map((item) => {
                  const linkedRequest = getRequestForContentId(item.id);

                  return (
                    <Link key={item.id} href={`/auditor/${item.id}`} className="history-item">
                      <div className="history-top">
                        <strong>{item.title}</strong>
                        <StatusPill status={item.status} />
                      </div>
                      <span>{linkedRequest?.topic ?? "Pauta sem referencia"}</span>
                      <small>
                        {linkedRequest?.format ?? "Formato nao informado"} ·{" "}
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
        </div>

        <aside className="column-side">
          <SectionCard title="Saida do auditor" subtitle="Qualidade editorial">
            {latestApprovedContent ? (
              <>
                <div className="linked-card">
                  <strong>{latestApprovedContent.title}</strong>
                  <span>Ja existe uma peca aprovada para seguir ao distribuidor.</span>
                </div>
                <div className="button-row">
                  <Link href="/distribuidor" className="secondary-button">
                    Ir para Distribuidor
                  </Link>
                </div>
              </>
            ) : contents[0] ? (
              <div className="button-row">
                <Link href={`/auditor/${contents[0].id}`} className="primary-button">
                  Abrir ultima peca para revisar
                </Link>
              </div>
            ) : (
              <p className="empty-state">
                Gere uma pauta no Criativo para abrir o fluxo de auditoria e aprovacao.
              </p>
            )}
          </SectionCard>
        </aside>
      </div>
    </section>
  );
}
