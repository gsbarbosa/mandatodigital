"use client";

import { useState } from "react";

import {
  MockAgentPill,
  MockDemoBanner,
  MockDidacticBox,
  MockSaveRow,
  MockStatusCard,
  MockToggleSection,
  useMockSaveFeedback,
} from "@/components/product/mock-agent-ui";
import { PersonaAuditorIcon } from "@/components/product/persona-shared";
import {
  MOCK_AUDIT_QUEUE,
  MOCK_FACT_CHECKING_DEFAULT,
  MOCK_HARD_DATA_DEFAULT,
  factCheckingSourceOptions,
  hardDataSourceOptions,
  toggleMockValue,
} from "@/lib/mock-agent-defaults";

export function AuditorPageV2() {
  const [factCheckingSources, setFactCheckingSources] = useState(MOCK_FACT_CHECKING_DEFAULT);
  const [hardDataSources, setHardDataSources] = useState(MOCK_HARD_DATA_DEFAULT);
  const { message, triggerMockSave } = useMockSaveFeedback();

  return (
    <section className="persona-page agent-theme-auditor">
      <div className="persona-container">
        <div className="persona-card">
          <h2 className="sr-only">Auditor</h2>
          <MockDemoBanner />

          <div className="persona-section-header">
            <div className="persona-header-icon" aria-hidden="true">
              <PersonaAuditorIcon />
            </div>
            <div>
              <MockAgentPill>Setup: 04 · Auditor</MockAgentPill>
              <h2>Fontes de Fact-Checking</h2>
              <p>
                O Auditor cruza roteiros com agências de checagem e bases governamentais antes
                da publicação (Delta Check).
              </p>
            </div>
          </div>

          <MockDidacticBox>
            Defina a matriz de confiança. Cada peça gerada passa por cruzamento automático de
            alegações, estatísticas e fontes independentes.
          </MockDidacticBox>

          <MockToggleSection
            title="Agências de checagem parceiras (APIs)"
            options={factCheckingSourceOptions}
            values={factCheckingSources}
            onToggle={(value) =>
              setFactCheckingSources((current) => toggleMockValue(current, value))
            }
          />

          <MockToggleSection
            title="Bancos de dados governamentais (Hard Data)"
            options={hardDataSourceOptions}
            values={hardDataSources}
            onToggle={(value) =>
              setHardDataSources((current) => toggleMockValue(current, value))
            }
          />

          <div className="persona-form-group persona-top-gap">
            <label className="persona-label">Fila de auditoria (simulada)</label>
            <p className="persona-helper-text">
              Exemplo de peças que passariam pelo Delta Check após o Criativo.
            </p>
            <div className="persona-mock-queue">
              {MOCK_AUDIT_QUEUE.map((item) => (
                <MockStatusCard
                  key={item.id}
                  title={item.title}
                  meta={
                    item.deltaSeconds
                      ? `${item.sources} fontes cruzadas · validação em ${item.deltaSeconds}s`
                      : `${item.sources} fontes em análise · aguardando selo`
                  }
                  status={
                    item.status === "aprovado"
                      ? "ok"
                      : item.status === "revisao"
                        ? "warn"
                        : "pending"
                  }
                  statusLabel={
                    item.status === "aprovado" ? "Selo verde" : "Em revisão"
                  }
                />
              ))}
            </div>
          </div>

          <MockSaveRow
            label="Salvar matriz (demo)"
            feedback={message}
            onSave={() => triggerMockSave("Matriz do Auditor")}
          />
        </div>
      </div>
    </section>
  );
}
