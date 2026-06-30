"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { AppLoadingRow } from "@/components/product/app-loading";
import {
  isRadarThemeSelected,
  sanitizeMandateThemesOnLoad,
  sanitizeOppositionThemesOnLoad,
  updateRadarThemeToggle,
} from "@/lib/sentinel-radar-themes";
import { filterExpansionsForThemeSelection } from "@/lib/sentinel-theme-expansion-filter";
import {
  MockAgentTabs,
  MockDidacticBox,
  MockSiteList,
  MockSocialProfileList,
  MockToggleSection,
} from "@/components/product/mock-agent-ui";
import { RadarSocialComingSoon } from "@/components/product/radar-social-coming-soon";
import { useProductApp } from "@/components/product/provider";
import { oppositionThemeGroups, sentinelThemeGroups } from "@/lib/constants";
import { isSentinelSocialUiEnabled } from "@/lib/sentinel-social-ui";

type SentinelaTab = "temas" | "adversários";

function countMandateThemes(sentinelThemes: string[], customRadarThemes: string[]) {
  return sentinelThemes.length + customRadarThemes.filter(Boolean).length;
}

function RadarSectionHeader({
  title,
  selectedCount,
  children,
}: {
  title: string;
  selectedCount: number;
  children: ReactNode;
}) {
  return (
    <header className="persona-radar-section-header">
      <div className="persona-radar-section-heading-row">
        <h3 className="persona-radar-section-heading">{title}</h3>
        <span className="persona-radar-section-count">
          {selectedCount} selecionado{selectedCount === 1 ? "" : "s"}
        </span>
      </div>
      <MockDidacticBox>{children}</MockDidacticBox>
    </header>
  );
}

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
  /** Limita o painel a temas, fontes ou ambos (padrão). */
  focus?: "all" | "radar" | "fontes";
};

export function SentinelaRadarPanel({
  showRefreshSignals = true,
  helperBeforeActions,
  focus = "all",
}: SentinelaRadarPanelProps) {
  const {
    profileForm,
    setProfileForm,
    saveProfile,
    isSavingProfile,
    isRefreshingSentinel,
    refreshSentinelSignals,
  } = useProductApp();
  const [activeTab, setActiveTab] = useState<SentinelaTab>(
    focus === "fontes" ? "adversários" : "temas",
  );
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [expansions, setExpansions] = useState<ThemeExpansionRow[]>([]);
  const [expansionsOpen, setExpansionsOpen] = useState(false);
  const [isLoadingExpansions, setIsLoadingExpansions] = useState(false);

  const customThemes = Array.from({ length: 3 }, (_, index) => profileForm.customRadarThemes[index] ?? "");
  const socialRadarEnabled = isSentinelSocialUiEnabled();

  const renderSocialProfiles = (
    label: string,
    field: "interestProfiles" | "oppositionProfiles",
    description?: string,
  ) =>
    socialRadarEnabled ? (
      <MockSocialProfileList
        label={label}
        values={profileForm[field]}
        instagramOnly
        maxItems={5}
        onChange={(values) =>
          setProfileForm((current) => ({
            ...current,
            [field]: values,
          }))
        }
      />
    ) : (
      <RadarSocialComingSoon label={label} description={description} />
    );

  const visibleExpansions = useMemo(
    () =>
      filterExpansionsForThemeSelection(expansions, {
        sentinelThemes: sanitizeMandateThemesOnLoad(profileForm.sentinelThemes),
        oppositionThemes: sanitizeOppositionThemesOnLoad(profileForm.oppositionThemes),
        customRadarThemes: profileForm.customRadarThemes,
      }),
    [
      expansions,
      profileForm.sentinelThemes,
      profileForm.oppositionThemes,
      profileForm.customRadarThemes,
    ],
  );

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
      setSaveMessage(focus === "fontes" ? "Fontes salvas com sucesso." : "Radar salvo com sucesso.");
      window.setTimeout(() => setSaveMessage(null), 3200);
    } catch {
      // Erro exibido pelo provider.
    }
  }

  const showRadarTabs = focus === "all" || focus === "radar";
  const showRadarThemes = focus === "all" || focus === "radar";
  const showFontes = focus === "all" || focus === "fontes";
  const saveLabel = focus === "fontes" ? "Salvar fontes" : "Salvar radar";
  const showInterestThemes = showRadarThemes && activeTab === "temas";
  const showOppositionThemes = showRadarThemes && activeTab === "adversários";
  const mandateThemeCount = countMandateThemes(
    profileForm.sentinelThemes,
    profileForm.customRadarThemes,
  );
  const oppositionThemeCount = profileForm.oppositionThemes.length;
  const radarTabs =
    focus === "radar"
      ? ([
          { id: "temas" as const, label: "1. Temas do mandato" },
          { id: "adversários" as const, label: "2. Temas da oposição" },
        ] as const)
      : ([
          { id: "temas" as const, label: "1. Temas de interesse" },
          { id: "adversários" as const, label: "2. Rastreio da oposição" },
        ] as const);

  return (
    <>
      {showRadarTabs ? (
        <MockAgentTabs
          tabs={[...radarTabs]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />
      ) : null}

      {showInterestThemes ? (
        <>
          <RadarSectionHeader title="Temas do mandato" selectedCount={mandateThemeCount}>
            Assuntos que você quer acompanhar e transformar em pauta. O Sentinela busca matérias
            recentes no Google News combinando cada tema com sua cidade e estado. Use temas
            personalizados para assuntos locais muito específicos.
          </RadarSectionHeader>

          {sentinelThemeGroups.map((group) => (
            <MockToggleSection
              key={group.title}
              title={group.title}
              options={group.options}
              values={profileForm.sentinelThemes}
              gridClassName="persona-tag-list is-radar-theme-grid"
              isOptionActive={(option, values) => isRadarThemeSelected(values, option)}
              onToggle={(value) =>
                setProfileForm((current) => ({
                  ...current,
                  sentinelThemes: updateRadarThemeToggle(current.sentinelThemes, value),
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

          {focus === "all" ? (
            <div className="persona-mock-two-column persona-top-gap">
              {renderSocialProfiles(
                "Perfis de interesse (@)",
                "interestProfiles",
                "Perfis de apoio no Instagram. O Sentinela analisa posts recentes que batem com os temas do radar.",
              )}
              <MockSiteList
                label="Portais e sites de interesse"
                values={profileForm.interestSites}
                onChange={(interestSites) =>
                  setProfileForm((current) => ({ ...current, interestSites }))
                }
                placeholder="www.portalregional.com"
              />
            </div>
          ) : null}

          {visibleExpansions.length > 0 ? (
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
                  <li className="persona-helper-text">
                    Sinônimos gerados só para os temas marcados no radar salvo.
                  </li>
                  {visibleExpansions.map((row) => (
                    <li key={row.sourceTheme}>
                      <strong>{row.sourceTheme}:</strong> {row.expandedTerms.join(", ")}
                    </li>
                  ))}
                </ul>
              ) : null}
              {isLoadingExpansions ? (
                <AppLoadingRow message="Carregando expansões..." />
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}

      {showOppositionThemes ? (
        <>
          <RadarSectionHeader title="Temas da oposição" selectedCount={oppositionThemeCount}>
            Assuntos usados pela oposição que você quer <strong>monitorar com prioridade</strong>.
            Quando aparecem em matérias recentes, o Sentinela destaca esses sinais antes dos demais.
          </RadarSectionHeader>

          {oppositionThemeGroups.map((group) => (
            <MockToggleSection
              key={group.title}
              title={group.title}
              options={group.options}
              values={profileForm.oppositionThemes}
              gridClassName="persona-tag-list is-radar-theme-grid is-radar-opposition-grid"
              isOptionActive={(option, values) => isRadarThemeSelected(values, option)}
              onToggle={(value) =>
                setProfileForm((current) => ({
                  ...current,
                  oppositionThemes: updateRadarThemeToggle(current.oppositionThemes, value),
                }))
              }
            />
          ))}

          {focus === "all" ? (
            <div className="persona-mock-two-column persona-top-gap">
              {renderSocialProfiles(
                "Perfis dos adversários diretos (@)",
                "oppositionProfiles",
                "Perfis da oposição no Instagram. Posts que citam temas do radar ganham prioridade nos sinais.",
              )}
              <MockSiteList
                label="Blogs e portais de oposição"
                values={profileForm.oppositionSites}
                onChange={(oppositionSites) =>
                  setProfileForm((current) => ({ ...current, oppositionSites }))
                }
                placeholder="www.blog_oposição.com.br"
              />
            </div>
          ) : null}
        </>
      ) : null}

      {showFontes ? (
        <>
          <p className="persona-helper-text">
            Portais e blogs que o Sentinela consulta além do Google News. Separe fontes de apoio e
            de oposição.
          </p>

          <div className="persona-mock-two-column persona-top-gap">
            <MockSiteList
              label="Portais e sites de interesse"
              values={profileForm.interestSites}
              onChange={(interestSites) =>
                setProfileForm((current) => ({ ...current, interestSites }))
              }
              placeholder="www.portalregional.com"
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

          <div className="persona-top-gap">
            {renderSocialProfiles(
              "Perfis em redes sociais (@)",
              "interestProfiles",
              "Cadastre perfis de interesse e adversários no Instagram (até 5 por lista). Salve o radar após incluir os @.",
            )}
          </div>

          <div className="persona-top-gap">
            {renderSocialProfiles(
              "Perfis da oposição no Instagram (@)",
              "oppositionProfiles",
              "Adversários diretos no Instagram. Só entram posts que mencionam temas do seu radar.",
            )}
          </div>
        </>
      ) : null}

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
            {isSavingProfile ? "Salvando..." : saveLabel}
          </button>
          {showRefreshSignals && focus !== "fontes" ? (
            <button
              type="button"
              className="persona-btn persona-btn-secondary persona-btn-large"
              onClick={() => void refreshSentinelSignals()}
              disabled={isRefreshingSentinel || isSavingProfile}
              data-testid="sentinel-refresh-signals"
            >
              {isRefreshingSentinel ? "Atualizando sinais..." : "Atualizar sinais"}
            </button>
          ) : null}
        </div>
        {saveMessage ? (
          <p className="persona-script-approved" role="status">
            {saveMessage}
          </p>
        ) : null}
        {isRefreshingSentinel ? (
          <p className="persona-helper-text persona-top-gap" role="status">
            Busca em andamento — você pode navegar; avisamos quando os sinais estiverem prontos.
          </p>
        ) : null}
      </div>
    </>
  );
}
