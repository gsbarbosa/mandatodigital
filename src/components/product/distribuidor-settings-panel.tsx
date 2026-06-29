"use client";

import { useState } from "react";

import {
  MockDemoBanner,
  MockSaveRow,
  MockSwitchRow,
  MockToggleSection,
  useMockSaveFeedback,
} from "@/components/product/mock-agent-ui";
import {
  MOCK_CHANNELS_DEFAULT,
  MOCK_WINDOWS_DEFAULT,
  distributionChannelOptions,
  distributionWindowOptions,
  toggleMockValue,
} from "@/lib/mock-agent-defaults";

export function DistribuidorSettingsPanel() {
  const [autoPublish, setAutoPublish] = useState(true);
  const [channels, setChannels] = useState(MOCK_CHANNELS_DEFAULT);
  const [windows, setWindows] = useState(MOCK_WINDOWS_DEFAULT);
  const { message, triggerMockSave } = useMockSaveFeedback();

  return (
    <>
      <MockDemoBanner />

      <div className="persona-form-group">
        <MockSwitchRow
          label="Aprovação automática de conteúdo"
          description='Se ativo, a IA publica direto nas redes sem depender do "Go/No-go" humano.'
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

      <MockSaveRow
        label="Salvar preferências"
        feedback={message}
        onSave={() => triggerMockSave("Preferências de distribuição")}
      />
    </>
  );
}
