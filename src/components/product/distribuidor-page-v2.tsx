"use client";

import { useState } from "react";

import {
  MockAgentPill,
  MockDemoBanner,
  MockDidacticBox,
  MockSaveRow,
  MockStatusCard,
  MockSwitchRow,
  MockToggleSection,
  useMockSaveFeedback,
} from "@/components/product/mock-agent-ui";
import { PersonaDistribuidorIcon } from "@/components/product/persona-shared";
import {
  MOCK_CHANNELS_DEFAULT,
  MOCK_DISTRIBUTION_QUEUE,
  MOCK_WINDOWS_DEFAULT,
  distributionChannelOptions,
  distributionWindowOptions,
  toggleMockValue,
} from "@/lib/mock-agent-defaults";

export function DistribuidorPageV2() {
  const [autoPublish, setAutoPublish] = useState(true);
  const [channels, setChannels] = useState(MOCK_CHANNELS_DEFAULT);
  const [windows, setWindows] = useState(MOCK_WINDOWS_DEFAULT);
  const { message, triggerMockSave } = useMockSaveFeedback();

  return (
    <section className="persona-page agent-theme-distribuidor">
      <div className="persona-container">
        <div className="persona-card">
          <h2 className="sr-only">Distribuidor</h2>
          <MockDemoBanner />

          <div className="persona-section-header">
            <div className="persona-header-icon" aria-hidden="true">
              <PersonaDistribuidorIcon />
            </div>
            <div>
              <MockAgentPill>Setup: 05 · Distribuidor</MockAgentPill>
              <h2>Conexões e Automação</h2>
              <p>
                Autorize redes e janelas de disparo. O conteúdo certificado pelo Auditor segue
                para publicação multiplataforma.
              </p>
            </div>
          </div>

          <MockDidacticBox>
            Passo final do ecossistema: onipresença orquestrada nas redes habilitadas, respeitando
            horários autorizados e formato nativo de cada canal.
          </MockDidacticBox>

          <div className="persona-form-group">
            <MockSwitchRow
              label="Aprovação automática de conteúdo"
              description='Se ativo, a IA publica direto nas redes sem depender do "Go/No-go" humano — maximizando agilidade e escala.'
              checked={autoPublish}
              onChange={setAutoPublish}
            />
          </div>

          <MockToggleSection
            title="Integrações de redes e mensageria (OAuth / API)"
            options={distributionChannelOptions}
            values={channels}
            onToggle={(value) => setChannels((current) => toggleMockValue(current, value))}
            gridClassName="persona-tag-list is-tone-grid persona-mock-channel-grid"
          />

          <MockToggleSection
            title="Grade de horários de disparo (janelas autorizadas)"
            options={distributionWindowOptions}
            values={windows}
            onToggle={(value) => setWindows((current) => toggleMockValue(current, value))}
          />

          <div className="persona-form-group persona-top-gap">
            <label className="persona-label">Fila de publicação (simulada)</label>
            <p className="persona-helper-text">
              Peças aprovadas aguardando disparo nas janelas configuradas.
            </p>
            <div className="persona-mock-queue">
              {MOCK_DISTRIBUTION_QUEUE.map((item) => (
                <MockStatusCard
                  key={item.id}
                  title={item.title}
                  meta={`${item.channels.join(" · ")} · ${item.scheduledFor}`}
                  status="pending"
                  statusLabel={autoPublish ? "Disparo automático" : "Aguardando Go"}
                />
              ))}
            </div>
          </div>

          <MockSaveRow
            label="Salvar distribuição (demo)"
            feedback={message}
            onSave={() => triggerMockSave("Configuração do Distribuidor")}
          />
        </div>
      </div>
    </section>
  );
}
