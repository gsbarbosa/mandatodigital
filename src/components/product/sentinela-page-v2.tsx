"use client";

import { useCallback, useEffect, useState } from "react";

import { updateToggleValues } from "@/components/product/config-controls";
import {
  MockAgentPill,
  MockAgentTabs,
  MockDidacticBox,
  MockSaveRow,
  MockSiteList,
  MockSocialProfileList,
  MockToggleSection,
} from "@/components/product/mock-agent-ui";
import { PersonaSentinelaIcon } from "@/components/product/persona-shared";
import { useProductApp } from "@/components/product/provider";
import { oppositionThemeGroups, sentinelThemeGroups } from "@/lib/constants";

type SentinelaTab = "temas" | "adversarios";

type ThemeExpansionRow = {
  sourceTheme: string;
  expandedTerms: string[];
  generatedAt: string;
};

export function SentinelaPageV2() {
  const { profileForm, setProfileForm, saveProfile, isSavingProfile } = useProductApp();
  const [activeTab, setActiveTab] = useState<SentinelaTab>("temas");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [expansions, setExpansions] = useState<ThemeExpansionRow[]>([]);
  const [expansionsOpen, setExpansionsOpen] = useState(false);
  const [isLoadingExpansions, setIsLoadingExpansions] = useState(false);

  const customThemes = Array.from({ length: 3 }, (_, index) => profileForm.customRadarThemes[index] ?? "");

  const loadExpansions = useCallback(async () => {
    setIsLoadingExpansions(true);
    try {
      const response = await fetch("/api/sentinel/expansions");
      const payload = (await response.json()) as { expansions?: ThemeExpansionRow[] };
      if (response.ok) {
        setExpansions(payload.expansions ?? []);
      }
    } catch {
      setExpansions([]);
    } finally {
      setIsLoadingExpansions(false);
    }
  }, []);

  useEffect(() => {
    void loadExpansions();
  }, [loadExpansions]);

  async function handleSave() {
    setSaveMessage(null);

    try {
      await saveProfile({ allowDraftDefaults: true, throwOnError: true });
      await loadExpansions();
      setExpansionsOpen(true);
      setSaveMessage("Radar do Sentinela salvo com sucesso.");
      window.setTimeout(() => setSaveMessage(null), 3200);
    } catch {
      // Erro exibido pelo provider.
    }
  }

  async function handleRefreshSignals() {
    setIsRefreshing(true);
    setRefreshMessage(null);

    try {
      const response = await fetch("/api/sentinel/refresh", { method: "POST" });
      const payload = (await response.json()) as {
        message?: string;
        suggestions?: unknown[];
        meta?: { emptyReason?: string };
      };

      if (!response.ok) {
        throw new Error(payload.message || "Nao foi possivel atualizar os sinais do Sentinela.");
      }

      const count = payload.suggestions?.length ?? 0;
      if (count > 0) {
        setRefreshMessage(`${count} sinal(is) atualizado(s). Veja no Criativo.`);
      } else {
        setRefreshMessage(
          payload.meta?.emptyReason || "Nenhum sinal novo encontrado para o radar atual.",
        );
      }
      window.setTimeout(() => setRefreshMessage(null), 4200);
    } catch (error) {
      setRefreshMessage(
        error instanceof Error ? error.message : "Nao foi possivel atualizar os sinais.",
      );
    } finally {
      setIsRefreshing(false);
    }
  }

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
                Selecione as vertentes monitoradas na web. O Sentinela busca materias recentes
                no Google News combinando cada tema com sua cidade e estado.
              </MockDidacticBox>

              {sentinelThemeGroups.map((group) => (
                <MockToggleSection
                  key={group.title}
                  title={group.title}
                  options={group.options}
                  values={profileForm.sentinelThemes}
                  onToggle={(value) =>
                    setProfileForm((current) => ({
                      ...current,
                      sentinelThemes: updateToggleValues(current.sentinelThemes, value),
                    }))
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
                        setProfileForm((current) => ({
                          ...current,
                          customRadarThemes: Array.from({ length: 3 }, (_, itemIndex) =>
                            itemIndex === index
                              ? event.target.value
                              : current.customRadarThemes[itemIndex] ?? "",
                          ),
                        }))
                      }
                      placeholder={`Tema ${index + 1}...`}
                    />
                  ))}
                </div>
              </div>

              <div className="persona-mock-two-column persona-top-gap">
                <MockSocialProfileList
                  label="Perfis de interesse (@)"
                  values={profileForm.interestProfiles}
                  instagramOnly
                  onChange={(interestProfiles) =>
                    setProfileForm((current) => ({ ...current, interestProfiles }))
                  }
                />
                <MockSiteList
                  label="Portais e sites de interesse"
                  values={profileForm.interestSites}
                  onChange={(interestSites) =>
                    setProfileForm((current) => ({ ...current, interestSites }))
                  }
                  placeholder="www.portalregional.com"
                />
              </div>

              <MockDidacticBox>
                Perfis @ ficam registrados para o pipeline social (Instagram em breve). Portais
                cadastrados entram via RSS ou busca Google News por domínio.
              </MockDidacticBox>

              {expansions.length > 0 ? (
                <div className="persona-form-group persona-top-gap">
                  <button
                    type="button"
                    className="persona-btn persona-btn-secondary"
                    onClick={() => setExpansionsOpen((current) => !current)}
                  >
                    {expansionsOpen ? "Ocultar" : "Ver"} termos monitorados (expansão)
                  </button>
                  {expansionsOpen ? (
                    <ul className="persona-helper-text persona-top-gap">
                      {expansions.map((row) => (
                        <li key={row.sourceTheme}>
                          <strong>{row.sourceTheme}:</strong> {row.expandedTerms.join(", ")}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {isLoadingExpansions ? (
                    <p className="persona-helper-text persona-top-gap">Carregando expansões...</p>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <>
              <MockDidacticBox>
                <>
                  Mapeamento focado na <strong>oposição</strong>. Temas adversarios recebem
                  prioridade quando aparecem em materias recentes.
                </>
              </MockDidacticBox>

              {oppositionThemeGroups.map((group) => (
                <MockToggleSection
                  key={group.title}
                  title={group.title}
                  options={group.options}
                  values={profileForm.oppositionThemes}
                  onToggle={(value) =>
                    setProfileForm((current) => ({
                      ...current,
                      oppositionThemes: updateToggleValues(current.oppositionThemes, value),
                    }))
                  }
                />
              ))}

              <div className="persona-mock-two-column persona-top-gap">
                <MockSocialProfileList
                  label="Perfis dos adversários diretos (@)"
                  values={profileForm.oppositionProfiles}
                  instagramOnly
                  onChange={(oppositionProfiles) =>
                    setProfileForm((current) => ({ ...current, oppositionProfiles }))
                  }
                />
                <MockSiteList
                  label="Blogs e portais de oposição"
                  values={profileForm.oppositionSites}
                  onChange={(oppositionSites) =>
                    setProfileForm((current) => ({ ...current, oppositionSites }))
                  }
                  placeholder="www.blog_oposicao.com.br"
                />
              </div>
            </>
          )}

          <div className="persona-cta-block persona-top-gap">
            <div className="persona-cta-row">
              <button
                type="button"
                className="persona-btn persona-btn-large"
                onClick={() => void handleSave()}
                disabled={isSavingProfile}
              >
                {isSavingProfile ? "Salvando radar..." : "Salvar radar"}
              </button>
              <button
                type="button"
                className="persona-btn persona-btn-secondary"
                onClick={() => void handleRefreshSignals()}
                disabled={isRefreshing || isSavingProfile}
              >
                {isRefreshing ? "Atualizando sinais..." : "Atualizar sinais"}
              </button>
            </div>
            {saveMessage ? (
              <p className="persona-script-approved" role="status">
                {saveMessage}
              </p>
            ) : null}
            {refreshMessage ? (
              <p className="persona-helper-text persona-top-gap" role="status">
                {refreshMessage}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
