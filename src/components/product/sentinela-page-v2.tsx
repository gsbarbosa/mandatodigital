"use client";

import { PersonaSentinelaIcon } from "@/components/product/persona-shared";
import { MockAgentPill } from "@/components/product/mock-agent-ui";
import { SentinelaRadarPanel } from "@/components/product/sentinela-radar-panel";

export function SentinelaPageV2() {
  return (
    <section className="persona-page agent-theme-sentinela">
      <div className="persona-container">
        <div className="persona-card">
          <h2 className="sr-only">Sentinela</h2>

          <div className="persona-section-header">
            <div className="persona-header-icon" aria-hidden="true">
              <PersonaSentinelaIcon />
            </div>
            <div>
              <MockAgentPill>Setup: 01 · Sentinela</MockAgentPill>
              <h2>Mapeamento de Radar</h2>
              <p>
                Quatro monitoramentos: temas do radar, temas personalizados (busca literal), portais
                RSS e expansão semântica (com flag ativa). Instagram entra em breve.
              </p>
            </div>
          </div>

          <SentinelaRadarPanel />
        </div>
      </div>
    </section>
  );
}
