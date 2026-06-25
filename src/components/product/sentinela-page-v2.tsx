"use client";

import { useState } from "react";

import {
  MockAgentPill,
  MockAgentTabs,
  MockDemoBanner,
  MockDidacticBox,
  MockSaveRow,
  MockSiteList,
  MockSocialProfileList,
  MockToggleSection,
  useMockSaveFeedback,
} from "@/components/product/mock-agent-ui";
import { PersonaSentinelaIcon } from "@/components/product/persona-shared";
import {
  MOCK_OPPOSITION_THEMES_DEFAULT,
  MOCK_SENTINEL_THEMES_DEFAULT,
  oppositionThemeGroups,
  sentinelThemeGroups,
  toggleMockValue,
} from "@/lib/mock-agent-defaults";

type SentinelaTab = "temas" | "adversarios";

export function SentinelaPageV2() {
  const [activeTab, setActiveTab] = useState<SentinelaTab>("temas");
  const [sentinelThemes, setSentinelThemes] = useState(MOCK_SENTINEL_THEMES_DEFAULT);
  const [oppositionThemes, setOppositionThemes] = useState(MOCK_OPPOSITION_THEMES_DEFAULT);
  const [customThemes, setCustomThemes] = useState(["", "", ""]);
  const [interestProfiles, setInterestProfiles] = useState([
    { network: "Instagram", handle: "@portal_regional" },
  ]);
  const [interestSites, setInterestSites] = useState(["www.portalregional.com"]);
  const [oppositionProfiles, setOppositionProfiles] = useState([
    { network: "X / Twitter", handle: "@adversario_oficial" },
  ]);
  const [oppositionSites, setOppositionSites] = useState(["www.blog_oposicao.com.br"]);
  const { message, triggerMockSave } = useMockSaveFeedback();

  return (
    <section className="persona-page agent-theme-sentinela">
      <div className="persona-container">
        <div className="persona-card">
          <h2 className="sr-only">Sentinela</h2>
          <MockDemoBanner />

          <div className="persona-section-header">
            <div className="persona-header-icon" aria-hidden="true">
              <PersonaSentinelaIcon />
            </div>
            <div>
              <MockAgentPill>Setup: 01 · Sentinela</MockAgentPill>
              <h2>Mapeamento de Radar</h2>
              <p>
                Varredura 24h em temas, perfis e portais. A expansão semântica amplia cada
                marcador para capturar oportunidades antes da saturação.
              </p>
            </div>
          </div>

          <MockAgentTabs
            tabs={[
              { id: "temas", label: "1. Temas de interesse" },
              { id: "adversarios", label: "2. Rastreio da oposição" },
            ]}
            activeTab={activeTab}
            onChange={setActiveTab}
          />

          {activeTab === "temas" ? (
            <>
              <MockDidacticBox>
                Selecione as vertentes monitoradas na web. Cada termo ganha expansão
                contextual automática (ex.: &quot;Reforma Tributária&quot; → IVA, CBS, PEC 45,
                carga tributária).
              </MockDidacticBox>

              {sentinelThemeGroups.map((group) => (
                <MockToggleSection
                  key={group.title}
                  title={group.title}
                  options={group.options}
                  values={sentinelThemes}
                  onToggle={(value) =>
                    setSentinelThemes((current) => toggleMockValue(current, value))
                  }
                />
              ))}

              <div className="persona-form-group">
                <label className="persona-label">Temas personalizados</label>
                <p className="persona-helper-text">
                  Até 3 temas extras (sugestão: máximo de 5 palavras cada).
                </p>
                <div className="persona-mock-custom-theme-grid persona-top-gap">
                  {customThemes.map((theme, index) => (
                    <input
                      key={`custom-theme-${index}`}
                      className="persona-input-control"
                      value={theme}
                      onChange={(event) =>
                        setCustomThemes((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? event.target.value : item,
                          ),
                        )
                      }
                      placeholder={`Tema ${index + 1}...`}
                    />
                  ))}
                </div>
              </div>

              <div className="persona-mock-two-column persona-top-gap">
                <MockSocialProfileList
                  label="Perfis de interesse (@)"
                  values={interestProfiles}
                  onChange={setInterestProfiles}
                />
                <MockSiteList
                  label="Portais e sites de interesse"
                  values={interestSites}
                  onChange={setInterestSites}
                  placeholder="www.portalregional.com"
                />
              </div>

              <MockDidacticBox>
                Perfis e sites também entram no radar de popularidade para sugerir
                posicionamentos alinhados à persona calibrada no Curador.
              </MockDidacticBox>
            </>
          ) : (
            <>
              <MockDidacticBox>
                <>
                  Mapeamento focado na <strong>oposição</strong>. Assuntos em ascensão nos
                  perfis adversários disparam respostas alinhadas à sua persona.
                </>
              </MockDidacticBox>

              {oppositionThemeGroups.map((group) => (
                <MockToggleSection
                  key={group.title}
                  title={group.title}
                  options={group.options}
                  values={oppositionThemes}
                  onToggle={(value) =>
                    setOppositionThemes((current) => toggleMockValue(current, value))
                  }
                />
              ))}

              <div className="persona-mock-two-column persona-top-gap">
                <MockSocialProfileList
                  label="Perfis dos adversários diretos (@)"
                  values={oppositionProfiles}
                  onChange={setOppositionProfiles}
                />
                <MockSiteList
                  label="Blogs e portais de oposição"
                  values={oppositionSites}
                  onChange={setOppositionSites}
                  placeholder="www.blog_oposicao.com.br"
                />
              </div>
            </>
          )}

          <MockSaveRow
            label="Salvar radar (demo)"
            feedback={message}
            onSave={() => triggerMockSave("Radar do Sentinela")}
          />
        </div>
      </div>
    </section>
  );
}
