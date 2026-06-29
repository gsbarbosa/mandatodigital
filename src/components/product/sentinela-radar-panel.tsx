"use client";

import { useCallback, useEffect, useState } from "react";

import { updateToggleValues } from "@/components/product/config-controls";
import {
  MockAgentTabs,
  MockDidacticBox,
  MockSiteList,
  MockToggleSection,
} from "@/components/product/mock-agent-ui";
import { RadarSocialComingSoon } from "@/components/product/radar-social-coming-soon";
import { useProductApp } from "@/components/product/provider";
import { oppositionThemeGroups, sentinelThemeGroups } from "@/lib/constants";

type SentinelaTab = "temas" | "adversários";

type ThemeExpansionRow = {
  sourceTheme: string;
  expandedTerms: string[];
  generatedAt: string;
};

type SentinelaRadarPanelProps = {
  /** Exibe botão "Atualizar sinais" além de "Salvar radar". */
  showRefreshSignals?: boolean;
  /** Mensagem curta acima dos botões (ex.: onboarding). */
  helperBeforeActions?: string;
};

export function SentinelaRadarPanel({
  showRefreshSignals = true,
  helperBeforeActions,
}: SentinelaRadarPanelProps) {
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
      setSaveMessage("Radar salvo com sucesso.");
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
        throw new Error(payload.message || "Não foi possível atualizar os sinais.");
      }

      const count = payload.suggestions?.length ?? 0;
      if (count > 0) {
        setRefreshMessage(`${count} sinal(is) atualizado(s).`);
      } else {
        setRefreshMessage(
          payload.meta?.emptyReason || "Nenhum sinal novo encontrado para o radar atual.",
        );
      }
      window.setTimeout(() => setRefreshMessage(null), 4200);
    } catch (error) {
      setRefreshMessage(
        error instanceof Error ? error.message : "Não foi possível atualizar os sinais.",
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <>
      <MockAgentTabs
        tabs={[
          { id: "temas", label: "1. Temas de interesse" },
          { id: "adversários", label: "2. Rastreio da oposição" },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === "temas" ? (
        <>
          <MockDidacticBox>
            Selecione os temas mais relevantes para o mandato. O Sentinela busca matérias
            recentes no Google News combinando cada tema com sua cidade e estado. Use temas
            personalizados para assuntos locais muito específicos.
          </MockDidacticBox>

          {sentinelThemeGroups.map((group) => (
            <MockToggleSection
              key={group.title}
              title={group.title}
              options={group.options}
              values={profileForm.sentinelThemes}
              gridClassName="persona-tag-list is-radar-theme-grid"
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
            <p className="persona-helper-text">Até 3 temas extras (máximo de 5 palavras cada).</p>
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
            <RadarSocialComingSoon label="Perfis de interesse (@)" />
            <MockSiteList
              label="Portais e sites de interesse"
              values={profileForm.interestSites}
              onChange={(interestSites) =>
                setProfileForm((current) => ({ ...current, interestSites }))
              }
              placeholder="www.portalregional.com"
            />
          </div>

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
            Mapeamento focado na <strong>oposição</strong>. Temas adversários recebem prioridade
            quando aparecem em matérias recentes.
          </MockDidacticBox>

          {oppositionThemeGroups.map((group) => (
            <MockToggleSection
              key={group.title}
              title={group.title}
              options={group.options}
              values={profileForm.oppositionThemes}
              gridClassName="persona-tag-list is-radar-theme-grid"
              onToggle={(value) =>
                setProfileForm((current) => ({
                  ...current,
                  oppositionThemes: updateToggleValues(current.oppositionThemes, value),
                }))
              }
            />
          ))}

          <div className="persona-mock-two-column persona-top-gap">
            <RadarSocialComingSoon
              label="Perfis dos adversários diretos (@)"
              description="Rastreio de perfis adversários em redes sociais entrará em uma próxima versão."
            />
            <MockSiteList
              label="Blogs e portais de oposição"
              values={profileForm.oppositionSites}
              onChange={(oppositionSites) =>
                setProfileForm((current) => ({ ...current, oppositionSites }))
              }
              placeholder="www.blog_oposição.com.br"
            />
          </div>
        </>
      )}

      {helperBeforeActions ? (
        <p className="persona-helper-text persona-top-gap">{helperBeforeActions}</p>
      ) : null}

      <div className="persona-cta-block persona-top-gap">
        <div className="persona-cta-row">
          <button
            type="button"
            className="persona-btn persona-btn-large"
            onClick={() => void handleSave()}
            disabled={isSavingProfile}
            data-testid="sentinel-save-radar"
          >
            {isSavingProfile ? "Salvando radar..." : "Salvar radar"}
          </button>
          {showRefreshSignals ? (
            <button
              type="button"
              className="persona-btn persona-btn-secondary persona-btn-large"
              onClick={() => void handleRefreshSignals()}
              disabled={isRefreshing || isSavingProfile}
              data-testid="sentinel-refresh-signals"
            >
              {isRefreshing ? "Atualizando sinais..." : "Atualizar sinais"}
            </button>
          ) : null}
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
    </>
  );
}
