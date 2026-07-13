"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useProductApp } from "@/components/product/provider";
import { useDevAccountMode } from "@/components/product/use-dev-account-mode";
import { ThemeExpansionsPanel, type ThemeExpansionRow } from "@/components/product/theme-expansions-panel";
import { ThemeTagPill } from "@/components/product/theme-tag";
import type { SocialHandle } from "@/lib/types";
import {
  MAX_ADVERSARY_PROFILES,
  MAX_MUNICIPAL_PORTALS,
  MAX_MUNICIPAL_PROFILES,
  MAX_THEMES_PER_SPHERE,
  estadualThemeGroups,
  federalThemeGroups,
  type SphereThemeGroup,
} from "@/lib/sphere-theme-catalog";
import { unionSentinelThemes } from "@/lib/sentinel-profile-themes";

type MonitorSphereKey = "federal" | "estadual";

/** Teto prático no premium (UI + schema); convidado usa os MAX_* do catálogo. */
const PREMIUM_SELECTION_CAP = 50;

function sphereThemesKey(sphere: MonitorSphereKey): "sentinelThemesFederal" | "sentinelThemesEstadual" {
  return sphere === "federal" ? "sentinelThemesFederal" : "sentinelThemesEstadual";
}

function otherSphereThemesKey(
  sphere: MonitorSphereKey,
): "sentinelThemesFederal" | "sentinelThemesEstadual" {
  return sphere === "federal" ? "sentinelThemesEstadual" : "sentinelThemesFederal";
}

const UF_LIST = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

const SOCIAL_NETWORKS = ["Instagram", "TikTok", "Twitter/X"];

function SemanticExpansionNote() {
  return (
    <div className="mt-6 pt-6 border-t border-slate-800">
      <p className="text-sm text-cyan-200/60 italic">
        Todos os temas passam por expansão semântica, garantindo por ex. que assuntos relacionados a
        &quot;ambulância&quot;, sejam contemplados em &quot;Saúde Pública&quot;.
      </p>
    </div>
  );
}

const REMOVE_ROW_BUTTON_CLASS =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700/60 bg-transparent text-slate-500 hover:border-slate-600 hover:bg-slate-800/50 hover:text-slate-200 transition-colors shrink-0";

const TEXT_LINK_BUTTON_CLASS =
  "inline bg-transparent p-0 text-xs text-cyan-400 hover:text-cyan-300 underline underline-offset-2";

type ThemeExpansionsBySphere = {
  federal: ThemeExpansionRow[];
  estadual: ThemeExpansionRow[];
  opposition: ThemeExpansionRow[];
};

const EMPTY_EXPANSION_GROUPS: ThemeExpansionsBySphere = {
  federal: [],
  estadual: [],
  opposition: [],
};

function formatSphereThemeCount(sphereCount: number, limit: number | null) {
  if (limit === null) {
    return `${sphereCount} selecionado${sphereCount === 1 ? "" : "s"}`;
  }
  return `${sphereCount}/${limit}`;
}

function SphereThemeSections({
  groups,
  selected,
  onToggle,
  selectionLimit,
}: {
  groups: readonly SphereThemeGroup[];
  selected: string[];
  onToggle: (theme: string) => void;
  selectionLimit: number | null;
}) {
  const atSphereLimit = selectionLimit !== null && selected.length >= selectionLimit;

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <div key={group.title}>
          <h3 className="text-sm font-semibold text-white mb-3 uppercase tracking-wider">
            {group.title}
          </h3>
          <div className="flex flex-wrap gap-1">
            {group.options.map((option) => {
              const isActive = selected.includes(option);
              const isDisabled = !isActive && atSphereLimit;

              return (
                <ThemeTagPill
                  key={option}
                  active={isActive}
                  disabled={isDisabled}
                  onClick={() => onToggle(option)}
                >
                  {option}
                </ThemeTagPill>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function SocialHandleRows({
  values,
  accent,
  onChange,
  addLabel,
  maxItems,
}: {
  values: SocialHandle[];
  accent: "emerald" | "red";
  onChange: (values: SocialHandle[]) => void;
  addLabel: string;
  maxItems: number;
}) {
  const focusRing =
    accent === "emerald"
      ? "focus:ring-emerald-500 focus:border-emerald-500"
      : "focus:ring-red-500 focus:border-red-500";
  const addClasses =
    accent === "emerald"
      ? "border-emerald-500/30 bg-emerald-950/10 text-emerald-400 hover:bg-emerald-900/30"
      : "border-red-500/30 bg-red-950/10 text-red-400 hover:bg-red-900/30";

  function updateRow(index: number, patch: Partial<SocialHandle>) {
    onChange(values.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  return (
    <div>
      <div className="space-y-3 mb-4">
        {values.map((row, index) => (
          <div
            key={index}
            className="grid grid-cols-[minmax(5.75rem,6.75rem)_minmax(0,1fr)_auto] items-center gap-2"
          >
            <select
              value={row.network}
              onChange={(event) => updateRow(index, { network: event.target.value })}
              className={`bg-[#131C2D] border border-slate-700 text-slate-300 text-xs rounded-lg w-full min-w-0 px-2 py-2.5 outline-none ${focusRing}`}
            >
              {SOCIAL_NETWORKS.map((network) => (
                <option key={network} value={network}>
                  {network}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={row.handle}
              placeholder="@perfil"
              onChange={(event) => updateRow(index, { handle: event.target.value })}
              className={`bg-[#131C2D] border border-slate-700 text-slate-300 text-sm rounded-lg w-full min-w-0 px-3 py-2.5 outline-none ${focusRing}`}
            />
            <button
              type="button"
              aria-label="Remover perfil"
              onClick={() => onChange(values.filter((_, i) => i !== index))}
              className={REMOVE_ROW_BUTTON_CLASS}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={values.length >= maxItems}
        onClick={() => onChange([...values, { network: "Instagram", handle: "" }])}
        className={`w-full py-2.5 rounded-xl border border-dashed text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${addClasses}`}
      >
        {addLabel}
      </button>
    </div>
  );
}

export function RedefinirTemasPage() {
  const router = useRouter();
  const { profileForm, setProfileForm, saveProfile, isSavingProfile, sessionUser } =
    useProductApp();
  const { isPremium } = useDevAccountMode(sessionUser?.email);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [limitMessage, setLimitMessage] = useState<string | null>(null);
  const [showMonitoramentoPrompt, setShowMonitoramentoPrompt] = useState(false);
  const [expansionGroups, setExpansionGroups] =
    useState<ThemeExpansionsBySphere>(EMPTY_EXPANSION_GROUPS);

  const themeLimit = isPremium ? null : MAX_THEMES_PER_SPHERE;
  const municipalProfilesLimit = isPremium ? PREMIUM_SELECTION_CAP : MAX_MUNICIPAL_PROFILES;
  const municipalPortalsLimit = isPremium ? PREMIUM_SELECTION_CAP : MAX_MUNICIPAL_PORTALS;
  const adversaryProfilesLimit = isPremium ? PREMIUM_SELECTION_CAP : MAX_ADVERSARY_PROFILES;

  const municipalAddProfileLabel = isPremium
    ? "+ adicionar perfil"
    : `+ adicionar perfil (máx ${MAX_MUNICIPAL_PROFILES} na versão convidado)`;
  const municipalAddPortalLabel = isPremium
    ? "+ adicionar portal"
    : `+ adicionar portal (máx ${MAX_MUNICIPAL_PORTALS} na versão convidado)`;
  const adversaryAddLabel = isPremium
    ? "+ Adicionar Perfil"
    : `+ Adicionar Perfil (Máx ${MAX_ADVERSARY_PROFILES})`;

  const loadExpansions = useCallback(async () => {
    try {
      const response = await fetch("/api/sentinel/expansions");
      const payload = (await response.json()) as {
        bySphere?: ThemeExpansionsBySphere;
      };
      if (response.ok) {
        setExpansionGroups(payload.bySphere ?? EMPTY_EXPANSION_GROUPS);
      }
    } catch {
      setExpansionGroups(EMPTY_EXPANSION_GROUPS);
    }
  }, []);

  useEffect(() => {
    void loadExpansions();
  }, [loadExpansions]);

  const federalCount = profileForm.sentinelThemesFederal.length;
  const estadualCount = profileForm.sentinelThemesEstadual.length;
  const hasUf = profileForm.state.trim().length === 2;

  function toggleTheme(
    theme: string,
    sphere: MonitorSphereKey,
    sphereGroups: readonly SphereThemeGroup[],
  ) {
    setLimitMessage(null);
    const themesKey = sphereThemesKey(sphere);
    const otherKey = otherSphereThemesKey(sphere);
    const selectedInSphere = profileForm[themesKey];
    const isSelected = selectedInSphere.includes(theme);

    if (!isSelected && themeLimit !== null && selectedInSphere.length >= themeLimit) {
      setLimitMessage(
        `Limite de ${themeLimit} temas no nível ${sphere === "federal" ? "Nacional" : "Estadual"}. Remova um tema para adicionar outro.`,
      );
      return;
    }

    if (!sphereGroups.some((group) => group.options.includes(theme))) {
      return;
    }

    setProfileForm((current) => {
      const currentSphereThemes = current[themesKey];
      const nextSphereThemes = isSelected
        ? currentSphereThemes.filter((item) => item !== theme)
        : [...currentSphereThemes, theme];
      const nextOtherThemes = isSelected
        ? current[otherKey]
        : current[otherKey].filter((item) => item !== theme);

      return {
        ...current,
        [themesKey]: nextSphereThemes,
        [otherKey]: nextOtherThemes,
        sentinelThemes: unionSentinelThemes({
          federal: themesKey === "sentinelThemesFederal" ? nextSphereThemes : nextOtherThemes,
          estadual: themesKey === "sentinelThemesEstadual" ? nextSphereThemes : nextOtherThemes,
        }),
      };
    });
  }

  async function handleSave() {
    setSaveMessage(null);
    try {
      await saveProfile({ allowDraftDefaults: true, silent: true, throwOnError: true });
      await loadExpansions();
      setSaveMessage("Radar salvo com sucesso. O monitoramento usa a nova configuração.");
      setShowMonitoramentoPrompt(true);
    } catch {
      // Erro exibido pelo provider (banner global).
    }
  }

  return (
    <div className="min-h-full relative pb-28">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[40%] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-[40%] right-[-10%] w-[40%] h-[40%] bg-cyan-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-5xl mx-auto relative z-10 px-4 sm:px-6 lg:px-8 pt-10">
        <header className="mb-10 text-center">
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mb-4">
            Monitoramento de Pautas <span className="text-cyan-400">&quot;da sua bandeira&quot;</span>
          </h1>
          <p className="text-slate-400 text-sm md:text-base font-normal max-w-2xl mx-auto mb-6">
            Defina os temas para monitoramento e criação de conteúdo com{" "}
            <span className="whitespace-nowrap">seu avatar</span>.
          </p>
        </header>

        <section className="bg-gradient-to-b from-slate-900/50 to-slate-900/20 backdrop-blur-xl border border-slate-800 rounded-[1.75rem] p-6 md:p-8 shadow-xl mb-8">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-8">
            <h2 className="text-2xl font-bold text-white">
              Nível <span className="text-cyan-400">Nacional</span>
            </h2>
            <span className="text-xs text-slate-500 font-medium">
              {formatSphereThemeCount(federalCount, themeLimit)}
            </span>
          </div>

          <SphereThemeSections
            groups={federalThemeGroups}
            selected={profileForm.sentinelThemesFederal}
            selectionLimit={themeLimit}
            onToggle={(theme) => toggleTheme(theme, "federal", federalThemeGroups)}
          />

          <ThemeExpansionsPanel
            rows={expansionGroups.federal}
            linkClassName={TEXT_LINK_BUTTON_CLASS}
          />

          <SemanticExpansionNote />
        </section>

        <section className="bg-gradient-to-b from-slate-900/50 to-slate-900/20 backdrop-blur-xl border border-slate-800 rounded-[1.75rem] p-6 md:p-8 shadow-xl mb-8 relative">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6 mb-8">
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-bold text-white">
                Nível <span className="text-purple-400">Estadual</span>
              </h2>
              <span className="text-xs text-slate-500 font-medium">
                {formatSphereThemeCount(estadualCount, themeLimit)}
              </span>
            </div>
            <div className="flex items-center gap-3 bg-purple-900/10 border border-purple-500/20 p-2.5 rounded-xl">
              <label className="text-sm text-white font-medium flex items-center gap-1 shrink-0">
                Estado {!hasUf ? <span className="text-red-400 font-bold">*</span> : null}
              </label>
              <select
                value={profileForm.state}
                onChange={(event) =>
                  setProfileForm((current) => ({ ...current, state: event.target.value }))
                }
                className="bg-[#131C2D] border border-slate-700 text-slate-300 text-sm rounded-lg focus:ring-purple-400 focus:border-purple-400 block min-w-[5.5rem] p-2 outline-none transition-colors"
              >
                <option value="" disabled>
                  UF
                </option>
                {UF_LIST.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div
            className={
              hasUf
                ? "transition-opacity duration-300"
                : "opacity-40 pointer-events-none transition-opacity duration-300"
            }
          >
            <SphereThemeSections
              groups={estadualThemeGroups}
              selected={profileForm.sentinelThemesEstadual}
              selectionLimit={themeLimit}
              onToggle={(theme) => toggleTheme(theme, "estadual", estadualThemeGroups)}
            />

            <ThemeExpansionsPanel
              rows={expansionGroups.estadual}
              linkClassName={TEXT_LINK_BUTTON_CLASS}
            />

            <SemanticExpansionNote />
          </div>
        </section>

        <section className="bg-gradient-to-b from-slate-900/50 to-slate-900/20 backdrop-blur-xl border border-slate-800 rounded-[1.75rem] p-6 md:p-8 shadow-xl mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">
            Nível <span className="text-emerald-400">Municipal</span>
          </h2>
          <p className="text-slate-400 text-sm mb-8 border-b border-slate-800 pb-4">
            Monitore sites de notícias da sua cidade.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xs font-bold text-slate-500 tracking-widest uppercase mb-4">
                Perfis de Interesse (@)
              </h3>
              <SocialHandleRows
                values={profileForm.interestProfiles}
                accent="emerald"
                maxItems={municipalProfilesLimit}
                onChange={(interestProfiles) =>
                  setProfileForm((current) => ({ ...current, interestProfiles }))
                }
                addLabel={municipalAddProfileLabel}
              />
            </div>

            <div>
              <h3 className="text-xs font-bold text-slate-500 tracking-widest uppercase mb-4">
                Portais e Sites de Interesse
              </h3>
              <div className="space-y-3 mb-4">
                {profileForm.interestSites.map((site, index) => (
                  <div key={index} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                    <input
                      type="text"
                      value={site}
                      placeholder="www.portalregional.com"
                      onChange={(event) =>
                        setProfileForm((current) => ({
                          ...current,
                          interestSites: current.interestSites.map((item, i) =>
                            i === index ? event.target.value : item,
                          ),
                        }))
                      }
                      className="bg-[#131C2D] border border-slate-700 text-slate-300 text-sm rounded-lg w-full min-w-0 px-3 py-2.5 outline-none focus:ring-emerald-500 focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      aria-label="Remover portal"
                      onClick={() =>
                        setProfileForm((current) => ({
                          ...current,
                          interestSites: current.interestSites.filter((_, i) => i !== index),
                        }))
                      }
                      className={REMOVE_ROW_BUTTON_CLASS}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                disabled={profileForm.interestSites.length >= municipalPortalsLimit}
                onClick={() =>
                  setProfileForm((current) => ({
                    ...current,
                    interestSites: [...current.interestSites, ""],
                  }))
                }
                className="w-full py-2.5 rounded-xl border border-emerald-500/30 border-dashed bg-emerald-950/10 text-emerald-400 text-sm font-semibold hover:bg-emerald-900/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {municipalAddPortalLabel}
              </button>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 mt-6 text-center italic">
            * Para Deputados Federais, indique sites e perfis independente da região ou município
          </p>
        </section>

        <section className="bg-slate-900/40 backdrop-blur-xl border border-red-900/30 rounded-[1.75rem] p-6 md:p-8 shadow-[0_0_20px_rgba(153,27,27,0.1)]">
          <h2 className="text-2xl font-bold text-white mb-2">Adversários Políticos</h2>
          <p className="text-slate-400 text-sm mb-6 border-b border-slate-800 pb-4">
            Acompanhe os temas postados por eles e gere pautas do seu interesse
          </p>

          <h3 className="text-xs font-bold text-slate-500 tracking-widest uppercase mb-4">
            Perfis de Interesse (@)
          </h3>
          <SocialHandleRows
            values={profileForm.oppositionProfiles}
            accent="red"
            maxItems={adversaryProfilesLimit}
            onChange={(oppositionProfiles) =>
              setProfileForm((current) => ({ ...current, oppositionProfiles }))
            }
            addLabel={adversaryAddLabel}
          />
        </section>
      </div>

      <div className="sticky bottom-0 left-0 right-0 mt-10 border-t border-slate-800 bg-[#0B0F19]/90 backdrop-blur-md z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            {limitMessage ? (
              <span className="text-amber-400">{limitMessage}</span>
            ) : saveMessage ? (
              <span className="text-emerald-400" role="status">
                {saveMessage}
              </span>
            ) : isPremium ? (
              <span>Modo premium — sem limite de seleção de temas e perfis nesta tela.</span>
            ) : (
              <span>
                Nessa versão para convidados, o volume de monitoramento é limitado em todos os
                níveis, o monitoramento das pautas não é em real-time.
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSavingProfile}
            className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold py-2.5 px-8 rounded-lg transition-all shadow-[0_0_15px_rgba(6,182,212,0.2)] disabled:opacity-50"
          >
            {isSavingProfile ? "Salvando radar..." : "Salvar radar"}
          </button>
        </div>
      </div>

      {showMonitoramentoPrompt ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Fechar"
            className="absolute inset-0 bg-black/70"
            onClick={() => setShowMonitoramentoPrompt(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="monitoramento-prompt-title"
            className="relative bg-[#0F1623] border border-slate-700 rounded-2xl p-8 max-w-md w-full shadow-2xl"
          >
            <h3 id="monitoramento-prompt-title" className="text-lg font-bold text-white mb-6">
              Gostaria de ir para o Monitoramento de Pautas?
            </h3>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowMonitoramentoPrompt(false)}
                className="px-5 py-2.5 rounded-lg border border-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-800 transition-colors"
              >
                Não (N)
              </button>
              <button
                type="button"
                onClick={() => router.push("/monitoramento")}
                className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-sm font-semibold transition-all"
              >
                Sim (S)
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
