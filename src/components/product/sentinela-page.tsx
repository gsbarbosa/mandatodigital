"use client";

import Link from "next/link";

import { PhaseSectionIntro, SectionCard, workflowStageById } from "./shared";

export function SentinelaPage() {
  return (
    <section className="phase-section">
      <PhaseSectionIntro stage={workflowStageById.sentinela} />

      <SectionCard title="Radar de pautas" subtitle="Entrada futura do pipeline">
        <p className="empty-state">
          Ainda nao capturamos sinais automaticamente no MVP. Hoje essa etapa entra no
          fluxo por observacoes manuais do time, noticias, monitoramento externo e
          repertorio politico trazido para a curadoria.
        </p>

        <div className="linked-card">
          <strong>Como o MVP opera agora</strong>
          <span>
            O time faz a leitura externa fora da ferramenta e traz o material para o
            Curador em forma de briefing manual.
          </span>
        </div>

        <div className="button-row">
          <Link href="/curador" className="secondary-button">
            Ir para Curador
          </Link>
        </div>
      </SectionCard>
    </section>
  );
}
