"use client";

import Link from "next/link";

import { useProductApp } from "./provider";
import { PhaseSectionIntro, SectionCard, workflowStageById } from "./shared";

export function DistribuidorPage() {
  const { latestApprovedContent } = useProductApp();

  return (
    <section className="phase-section">
      <PhaseSectionIntro stage={workflowStageById.distribuidor} />

      <SectionCard title="Entrega para canais" subtitle="Saida futura do MVP">
        {latestApprovedContent ? (
          <>
            <div className="linked-card">
              <strong>{latestApprovedContent.title}</strong>
              <span>
                Existe ao menos uma peca aprovada pronta para seguir ao distribuidor.
              </span>
            </div>
            <p className="empty-state">
              Ainda nao automatizamos publicacao, agenda ou empacotamento por canal.
              Por enquanto, a saida do Distribuidor e manual: copiar o texto aprovado
              e levar para a operacao.
            </p>
          </>
        ) : (
          <p className="empty-state">
            Quando houver uma peca aprovada, ela aparecera aqui como input da fase de
            distribuicao.
          </p>
        )}

        <div className="button-row">
          <Link href="/auditor" className="secondary-button">
            Voltar para Auditor
          </Link>
        </div>
      </SectionCard>
    </section>
  );
}
