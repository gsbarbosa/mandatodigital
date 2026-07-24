"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useProductApp } from "@/components/product/provider";
import { useDevAccountMode } from "@/components/product/use-dev-account-mode";
import { ThemeExpansionsPanel, type ThemeExpansionRow } from "@/components/product/theme-expansions-panel";
import { ThemeTagPill } from "@/components/product/theme-tag";
import type { SocialHandle } from "@/lib/types";
import { mirrorInterestThemesToSpheres } from "@/lib/sentinel-profile-themes";
import {
  MAX_ADVERSARY_PROFILES,
  MAX_INTEREST_PROFILES,
  MAX_INTEREST_THEMES,
  MAX_MUNICIPAL_CITIES,
  MAX_MUNICIPAL_PORTALS,
  interestThemeGroups,
  type SphereThemeGroup,
} from "@/lib/sphere-theme-catalog";

/** Teto prático no premium (UI + schema); convidado usa os MAX_* do catálogo. */
const PREMIUM_SELECTION_CAP = 50;

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

function formatSelectionCount(count: number, limit: number | null) {
  if (limit === null) {
    return `${count} selecionado${count === 1 ? "" : "s"}`;
  }
  return `${count}/${limit}`;
}

function InterestThemeSections({
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
  const atLimit = selectionLimit !== null && selected.length >= selectionLimit;

  return (
    <div className="space-y-8" data-testid="temas-interest">
      {groups.map((group) => (
        <div key={group.title}>
          <h3 className="text-sm font-semibold text-white mb-3 uppercase tracking-wider">
            {group.title}
          </h3>
          <div className="flex flex-wrap gap-1">
            {group.options.map((option) => {
              const isActive = selected.includes(option);
              const isDisabled = !isActive && atLimit;

              return (
                <ThemeTagPill
                  key={option}
                  themeLabel={option}
                  sphere="federal"
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

  const selectionLimit = isPremium ? null : MAX_INTEREST_THEMES;
  const municipalCitiesLimit = isPremium ? PREMIUM_SELECTION_CAP : MAX_MUNICIPAL_CITIES;
  const municipalPortalsLimit = isPremium ? PREMIUM_SELECTION_CAP : MAX_MUNICIPAL_PORTALS;
  const interestProfilesLimit = isPremium ? PREMIUM_SELECTION_CAP : MAX_INTEREST_PROFILES;
  const adversaryProfilesLimit = isPremium ? PREMIUM_SELECTION_CAP : MAX_ADVERSARY_PROFILES;

  const municipalAddCityLabel = isPremium
    ? "+ adicionar cidade"
    : `+ adicionar cidade (máx ${MAX_MUNICIPAL_CITIES} na versão convidado)`;
  const municipalAddPortalLabel = isPremium
    ? "+ adicionar portal"
    : `+ adicionar portal (máx ${MAX_MUNICIPAL_PORTALS} na versão convidado)`;
  const interestAddProfileLabel = isPremium
    ? "+ adicionar perfil"
    : `+ adicionar perfil (máx ${MAX_INTEREST_PROFILES} na versão convidado)`;
  const adversaryAddLabel = isPremium
    ? "+ Adicionar Perfil"
    : `+ Adicionar Perfil (máx ${MAX_ADVERSARY_PROFILES} na versão convidado)`;

  const selectedThemes = useMemo(() => {
    const fromForm = profileForm.sentinelThemes.filter(Boolean);
    if (fromForm.length > 0) {
      return fromForm;
    }
    return [
      ...new Set([
        ...profileForm.sentinelThemesFederal,
        ...profileForm.sentinelThemesEstadual,
      ]),
    ];
  }, [
    profileForm.sentinelThemes,
    profileForm.sentinelThemesFederal,
    profileForm.sentinelThemesEstadual,
  ]);

  const interestExpansions = useMemo(() => {
    const byTheme = new Map<string, ThemeExpansionRow>();
    for (const row of [...expansionGroups.federal, ...expansionGroups.estadual]) {
      if (!byTheme.has(row.sourceTheme)) {
        byTheme.set(row.sourceTheme, row);
      }
    }
    return [...byTheme.values()];
  }, [expansionGroups.federal, expansionGroups.estadual]);

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

  function applyInterestThemes(nextThemes: string[]) {
    const mirrored = mirrorInterestThemesToSpheres(nextThemes);
    setProfileForm((current) => ({
      ...current,
      sentinelThemes: mirrored.federal,
      sentinelThemesFederal: mirrored.federal,
      sentinelThemesEstadual: mirrored.estadual,
    }));
  }

  function toggleTheme(theme: string) {
    setLimitMessage(null);
    const isSelected = selectedThemes.includes(theme);

    if (!isSelected && selectionLimit !== null && selectedThemes.length >= selectionLimit) {
      setLimitMessage(
        `Limite de ${selectionLimit} temas de interesse. Remova um tema para adicionar outro.`,
      );
      return;
    }

    if (!interestThemeGroups.some((group) => group.options.includes(theme))) {
      return;
    }

    const nextThemes = isSelected
      ? selectedThemes.filter((item) => item !== theme)
      : [...selectedThemes, theme];
    applyInterestThemes(nextThemes);
  }

  async function handleSave() {
    setSaveMessage(null);
    try {
      const result = await saveProfile({
        allowDraftDefaults: true,
        silent: true,
        throwOnError: true,
        sentinelRefreshPolicy: "themes",
      });
      await loadExpansions();
      if (result?.sentinelRefreshSkipped && result.sentinelRefreshMessage) {
        setSaveMessage(result.sentinelRefreshMessage);
        setShowMonitoramentoPrompt(false);
      } else {
        setSaveMessage("Radar salvo com sucesso. O monitoramento usa a nova configuração.");
        setShowMonitoramentoPrompt(true);
      }
    } catch {
      // Erro exibido pelo provider (banner global).
    }
  }

  return (
    <div className="min-h-full relative pb-28" data-testid="temas-page">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[40%] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-[40%] right-[-10%] w-[40%] h-[40%] bg-cyan-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-5xl mx-auto relative z-10 px-4 sm:px-6 lg:px-8 pt-10">
        <header className="mb-10 text-center">
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mb-4">
            Monitoramento de Pautas <span className="text-cyan-400">&quot;da sua bandeira&quot;</span>
          </h1>
          <p className="text-slate-400 text-sm md:text-base font-normal max-w-2xl mx-auto mb-6">
            Escolha os temas e as fontes. Nacional, estadual e municipal aparecem organizados no
            monitoramento conforme a cobertura da notícia e a UF do perfil.
          </p>
        </header>

        <section
          id="temas"
          data-onboarding-anchor="temas-federal"
          className="bg-gradient-to-b from-slate-900/50 to-slate-900/20 backdrop-blur-xl border border-slate-800 rounded-[1.75rem] p-6 md:p-8 shadow-xl mb-8 scroll-mt-24"
        >
          <div className="flex flex-col gap-4 border-b border-slate-800 pb-4 mb-8 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">
                Temas de <span className="text-cyan-400">interesse</span>
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                O Sentinela classifica as pautas por esfera no monitoramento.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-slate-500 font-medium">
                {formatSelectionCount(selectedThemes.length, selectionLimit)}
              </span>
              <div className="flex items-center gap-3 bg-slate-900/60 border border-slate-700 p-2.5 rounded-xl">
                <label className="text-sm text-white font-medium flex items-center gap-1 shrink-0">
                  UF de cobertura
                </label>
                <select
                  data-testid="temas-uf-select"
                  value={profileForm.state}
                  onChange={(event) =>
                    setProfileForm((current) => ({ ...current, state: event.target.value }))
                  }
                  className="bg-[#131C2D] border border-slate-700 text-slate-300 text-sm rounded-lg focus:ring-cyan-400 focus:border-cyan-400 block min-w-[5.5rem] p-2 outline-none transition-colors"
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
          </div>

          <InterestThemeSections
            groups={interestThemeGroups}
            selected={selectedThemes}
            selectionLimit={selectionLimit}
            onToggle={toggleTheme}
          />

          <ThemeExpansionsPanel rows={interestExpansions} linkClassName={TEXT_LINK_BUTTON_CLASS} />

          <SemanticExpansionNote />
        </section>

        <section
          id="municipal"
          data-onboarding-anchor="temas-municipal"
          className="bg-gradient-to-b from-slate-900/50 to-slate-900/20 backdrop-blur-xl border border-slate-800 rounded-[1.75rem] p-6 md:p-8 shadow-xl mb-8 scroll-mt-24"
        >
          <h2 className="text-2xl font-bold text-white mb-2">
            Radar <span className="text-emerald-400">municipal</span>
          </h2>
          <p className="text-slate-400 text-sm mb-8 border-b border-slate-800 pb-4">
            Escolha até {isPremium ? "várias" : MAX_MUNICIPAL_CITIES} cidades e portais regionais.
            O Sentinela cruza seus temas de interesse com cada cidade.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xs font-bold text-slate-500 tracking-widest uppercase mb-4">
                Cidades monitoradas
              </h3>
              <div className="space-y-3 mb-4">
                {profileForm.municipalCities.map((city, index) => (
                  <div key={index} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                    <input
                      type="text"
                      value={city}
                      placeholder="Ex.: Campinas"
                      onChange={(event) =>
                        setProfileForm((current) => ({
                          ...current,
                          municipalCities: current.municipalCities.map((item, i) =>
                            i === index ? event.target.value : item,
                          ),
                        }))
                      }
                      className="bg-[#131C2D] border border-slate-700 text-slate-300 text-sm rounded-lg w-full min-w-0 px-3 py-2.5 outline-none focus:ring-emerald-500 focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      aria-label="Remover cidade"
                      onClick={() =>
                        setProfileForm((current) => ({
                          ...current,
                          municipalCities: current.municipalCities.filter((_, i) => i !== index),
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
                disabled={profileForm.municipalCities.length >= municipalCitiesLimit}
                onClick={() =>
                  setProfileForm((current) => ({
                    ...current,
                    municipalCities: [...current.municipalCities, ""],
                  }))
                }
                className="w-full py-2.5 rounded-xl border border-emerald-500/30 border-dashed bg-emerald-950/10 text-emerald-400 text-sm font-semibold hover:bg-emerald-900/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {municipalAddCityLabel}
              </button>
            </div>

            <div>
              <h3 className="text-xs font-bold text-slate-500 tracking-widest uppercase mb-4">
                Portais regionais
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
        </section>

        <section
          id="interesse"
          data-onboarding-anchor="temas-interesse"
          className="bg-gradient-to-b from-slate-900/50 to-slate-900/20 backdrop-blur-xl border border-slate-800 rounded-[1.75rem] p-6 md:p-8 shadow-xl mb-8 scroll-mt-24"
        >
          <h2 className="text-2xl font-bold text-white mb-2">
            Perfis de <span className="text-violet-400">interesse</span>
          </h2>
          <p className="text-slate-400 text-sm mb-8 border-b border-slate-800 pb-4">
            Contas que você quer acompanhar. O monitoramento mostra os últimos posts por engajamento.
          </p>

          <SocialHandleRows
            values={profileForm.interestProfiles}
            accent="emerald"
            maxItems={interestProfilesLimit}
            onChange={(interestProfiles) =>
              setProfileForm((current) => ({ ...current, interestProfiles }))
            }
            addLabel={interestAddProfileLabel}
          />
        </section>

        <section
          id="adversarios"
          data-onboarding-anchor="temas-adversarios"
          className="bg-slate-900/40 backdrop-blur-xl border border-red-900/30 rounded-[1.75rem] p-6 md:p-8 shadow-[0_0_20px_rgba(153,27,27,0.1)] scroll-mt-24"
        >
          <h2 className="text-2xl font-bold text-white mb-2">Adversários Políticos</h2>
          <p className="text-slate-400 text-sm mb-6 border-b border-slate-800 pb-4">
            Acompanhe os últimos posts deles no monitoramento, ordenados por engajamento
          </p>

          <h3 className="text-xs font-bold text-slate-500 tracking-widest uppercase mb-4">
            Perfis (@)
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
              <span>Modo premium — sem limite de seleção de temas e fontes nesta tela.</span>
            ) : (
              <span>
                Versão convidado: até {MAX_INTEREST_THEMES} temas, {MAX_MUNICIPAL_CITIES} cidades,{" "}
                {MAX_MUNICIPAL_PORTALS} portais e {MAX_INTEREST_PROFILES} perfis. O monitoramento das
                pautas não é em tempo real.
              </span>
            )}
          </div>
          <button
            type="button"
            data-testid="salvar-radar-button"
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
            data-testid="monitoramento-prompt"
            className="relative bg-[#0F1623] border border-slate-700 rounded-2xl p-8 max-w-md w-full shadow-2xl"
          >
            <h3 id="monitoramento-prompt-title" className="text-lg font-bold text-white mb-6">
              Gostaria de ir para o Monitoramento de Pautas?
            </h3>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                data-testid="monitoramento-prompt-nao"
                onClick={() => setShowMonitoramentoPrompt(false)}
                className="px-5 py-2.5 rounded-lg border border-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-800 transition-colors"
              >
                Não (N)
              </button>
              <button
                type="button"
                data-testid="monitoramento-prompt-sim"
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
