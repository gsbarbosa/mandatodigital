"use client";

import { useCallback, useEffect, useState } from "react";

import { useProductApp } from "@/components/product/provider";
import { ThemeTagPill } from "@/components/product/theme-tag";
import type { SocialHandle } from "@/lib/types";
import {
  MAX_THEMES_PER_SPHERE,
  estadualThemeGroups,
  federalThemeGroups,
  themesInCatalog,
  type SphereThemeGroup,
} from "@/lib/sphere-theme-catalog";

const UF_LIST = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

const SOCIAL_NETWORKS = ["Instagram", "TikTok", "Twitter/X"];

const MAX_LIST_ITEMS = 10;

type ThemeExpansionRow = {
  sourceTheme: string;
  expandedTerms: string[];
  generatedAt: string;
};

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

function SphereThemeSections({
  groups,
  selected,
  onToggle,
}: {
  groups: readonly SphereThemeGroup[];
  selected: string[];
  onToggle: (theme: string) => void;
}) {
  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <div key={group.title}>
          <h3 className="text-sm font-semibold text-white mb-3 uppercase tracking-wider">
            {group.title}
          </h3>
          <div className="flex flex-wrap gap-1">
            {group.options.map((option) => (
              <ThemeTagPill
                key={option}
                active={selected.includes(option)}
                onClick={() => onToggle(option)}
              >
                {option}
              </ThemeTagPill>
            ))}
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
}: {
  values: SocialHandle[];
  accent: "emerald" | "red";
  onChange: (values: SocialHandle[]) => void;
  addLabel: string;
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
          <div key={index} className="flex items-center gap-2">
            <select
              value={row.network}
              onChange={(event) => updateRow(index, { network: event.target.value })}
              className={`bg-[#131C2D] border border-slate-700 text-slate-300 text-sm rounded-lg block w-1/3 p-2 outline-none ${focusRing}`}
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
              className={`bg-[#131C2D] border border-slate-700 text-slate-300 text-sm rounded-lg p-2 flex-1 outline-none ${focusRing}`}
            />
            <button
              type="button"
              aria-label="Remover perfil"
              onClick={() => onChange(values.filter((_, i) => i !== index))}
              className="text-slate-600 hover:text-slate-300 text-lg leading-none px-1 shrink-0"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={values.length >= MAX_LIST_ITEMS}
        onClick={() => onChange([...values, { network: "Instagram", handle: "" }])}
        className={`w-full py-2.5 rounded-xl border border-dashed text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${addClasses}`}
      >
        {addLabel}
      </button>
    </div>
  );
}

export function RedefinirTemasPage() {
  const { profileForm, setProfileForm, saveProfile, isSavingProfile } = useProductApp();
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [limitMessage, setLimitMessage] = useState<string | null>(null);
  const [expansions, setExpansions] = useState<ThemeExpansionRow[]>([]);
  const [expansionsOpen, setExpansionsOpen] = useState(false);

  const loadExpansions = useCallback(async () => {
    try {
      const response = await fetch("/api/sentinel/expansions");
      const payload = (await response.json()) as { expansions?: ThemeExpansionRow[] };
      if (response.ok) {
        setExpansions(payload.expansions ?? []);
      }
    } catch {
      setExpansions([]);
    }
  }, []);

  useEffect(() => {
    void loadExpansions();
  }, [loadExpansions]);

  const federalCount = themesInCatalog(profileForm.sentinelThemes, federalThemeGroups).length;
  const estadualCount = themesInCatalog(profileForm.sentinelThemes, estadualThemeGroups).length;
  const hasUf = profileForm.state.trim().length === 2;

  function toggleTheme(theme: string, sphereGroups: readonly SphereThemeGroup[], sphereLabel: string) {
    setLimitMessage(null);
    const isSelected = profileForm.sentinelThemes.includes(theme);
    if (!isSelected) {
      const count = themesInCatalog(profileForm.sentinelThemes, sphereGroups).length;
      if (count >= MAX_THEMES_PER_SPHERE) {
        setLimitMessage(
          `Limite de ${MAX_THEMES_PER_SPHERE} temas na esfera ${sphereLabel}. Remova um tema para adicionar outro.`,
        );
        return;
      }
    }
    setProfileForm((current) => ({
      ...current,
      sentinelThemes: isSelected
        ? current.sentinelThemes.filter((item) => item !== theme)
        : [...current.sentinelThemes, theme],
    }));
  }

  async function handleSave() {
    setSaveMessage(null);
    try {
      await saveProfile({ allowDraftDefaults: true, throwOnError: true });
      await loadExpansions();
      setSaveMessage("Radar salvo com sucesso. O monitoramento usa a nova configuração.");
      window.setTimeout(() => setSaveMessage(null), 4200);
    } catch {
      // Erro exibido pelo provider (banner global).
    }
  }

  const customThemes = Array.from(
    { length: 3 },
    (_, index) => profileForm.customRadarThemes[index] ?? "",
  );

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

          <div className="inline-flex items-center gap-3 bg-blue-900/20 border border-blue-500/30 rounded-xl py-3 px-5">
            <svg className="h-5 w-5 text-cyan-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm text-blue-200 font-medium text-left">
              <strong className="text-white">Aviso:</strong> Nessa versão de demonstração (não
              assinantes), o monitoramento das pautas não é em real-time.
            </span>
          </div>
        </header>

        {/* FEDERAL */}
        <section className="bg-gradient-to-b from-slate-900/50 to-slate-900/20 backdrop-blur-xl border border-slate-800 rounded-[1.75rem] p-6 md:p-8 shadow-xl mb-8">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-8">
            <h2 className="text-2xl font-bold text-white">
              Nível <span className="text-cyan-400">Federal</span>
            </h2>
            <span className="text-xs text-slate-500 font-medium">
              {federalCount}/{MAX_THEMES_PER_SPHERE} temas
            </span>
          </div>

          <SphereThemeSections
            groups={federalThemeGroups}
            selected={profileForm.sentinelThemes}
            onToggle={(theme) => toggleTheme(theme, federalThemeGroups, "Federal")}
          />

          <div className="mt-8">
            <h3 className="text-sm font-semibold text-white mb-1 uppercase tracking-wider">
              Temas personalizados
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Até 3 temas extras com busca literal (máximo de 5 palavras cada).
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {customThemes.map((theme, index) => (
                <input
                  key={`custom-theme-${index}`}
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
                  className="bg-[#131C2D] border border-slate-700 text-slate-300 text-sm rounded-lg p-2 w-full outline-none focus:ring-cyan-500 focus:border-cyan-500"
                />
              ))}
            </div>
          </div>

          {expansions.length > 0 ? (
            <div className="mt-6">
              <button
                type="button"
                onClick={() => setExpansionsOpen((current) => !current)}
                className="text-xs text-cyan-400 hover:text-cyan-300 underline"
              >
                {expansionsOpen ? "Ocultar" : "Ver"} termos monitorados (expansão semântica)
              </button>
              {expansionsOpen ? (
                <ul className="mt-3 space-y-1 text-xs text-slate-500">
                  {expansions.map((row) => (
                    <li key={row.sourceTheme}>
                      <strong className="text-slate-400">{row.sourceTheme}:</strong>{" "}
                      {row.expandedTerms.join(", ")}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <SemanticExpansionNote />
        </section>

        {/* ESTADUAL */}
        <section className="bg-gradient-to-b from-slate-900/50 to-slate-900/20 backdrop-blur-xl border border-slate-800 rounded-[1.75rem] p-6 md:p-8 shadow-xl mb-8 relative">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6 mb-8">
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-bold text-white">
                Nível <span className="text-purple-400">Estadual</span>
              </h2>
              <span className="text-xs text-slate-500 font-medium">
                {estadualCount}/{MAX_THEMES_PER_SPHERE} temas
              </span>
            </div>
            <div className="flex items-center gap-3 bg-purple-900/10 border border-purple-500/20 p-2.5 rounded-xl">
              {hasUf ? (
                <span className="text-sm text-white font-medium flex items-center gap-2">
                  Estado:
                  <span className="bg-[#131C2D] border border-slate-700 text-purple-300 text-sm rounded-lg px-3 py-1.5 font-bold">
                    {profileForm.state.toUpperCase()}
                  </span>
                  <span className="text-[10px] text-slate-500 font-normal">do seu cadastro</span>
                </span>
              ) : (
                <>
                  <label className="text-sm text-white font-medium flex items-center gap-1">
                    Selecione seu Estado <span className="text-red-400 font-bold">*</span>
                  </label>
                  <select
                    value={profileForm.state}
                    onChange={(event) =>
                      setProfileForm((current) => ({ ...current, state: event.target.value }))
                    }
                    className="bg-[#131C2D] border border-slate-700 text-slate-300 text-sm rounded-lg focus:ring-purple-400 focus:border-purple-400 block p-2 outline-none transition-colors"
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
                </>
              )}
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
              selected={profileForm.sentinelThemes}
              onToggle={(theme) => toggleTheme(theme, estadualThemeGroups, "Estadual")}
            />
            <SemanticExpansionNote />
          </div>
        </section>

        {/* MUNICIPAL */}
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
                onChange={(interestProfiles) =>
                  setProfileForm((current) => ({ ...current, interestProfiles }))
                }
                addLabel={`+ Adicionar Perfil (Máx ${MAX_LIST_ITEMS})`}
              />
            </div>

            <div>
              <h3 className="text-xs font-bold text-slate-500 tracking-widest uppercase mb-4">
                Portais e Sites de Interesse
              </h3>
              <div className="space-y-3 mb-4">
                {profileForm.interestSites.map((site, index) => (
                  <div key={index} className="flex items-center gap-2">
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
                      className="bg-[#131C2D] border border-slate-700 text-slate-300 text-sm rounded-lg p-2 w-full outline-none focus:ring-emerald-500 focus:border-emerald-500"
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
                      className="text-slate-600 hover:text-slate-300 text-lg leading-none px-1 shrink-0"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                disabled={profileForm.interestSites.length >= MAX_LIST_ITEMS}
                onClick={() =>
                  setProfileForm((current) => ({
                    ...current,
                    interestSites: [...current.interestSites, ""],
                  }))
                }
                className="w-full py-2.5 rounded-xl border border-emerald-500/30 border-dashed bg-emerald-950/10 text-emerald-400 text-sm font-semibold hover:bg-emerald-900/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                + Adicionar Portal (Máx {MAX_LIST_ITEMS})
              </button>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 mt-6 text-center italic">
            * Para Deputados Federais, indique sites e perfis independente da região ou município
          </p>
        </section>

        {/* ADVERSÁRIOS */}
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
            onChange={(oppositionProfiles) =>
              setProfileForm((current) => ({ ...current, oppositionProfiles }))
            }
            addLabel={`+ Adicionar Perfil (Máx ${MAX_LIST_ITEMS})`}
          />
        </section>
      </div>

      {/* Sticky save bar */}
      <div className="sticky bottom-0 left-0 right-0 mt-10 border-t border-slate-800 bg-[#0B0F19]/90 backdrop-blur-md z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            {limitMessage ? (
              <span className="text-amber-400">{limitMessage}</span>
            ) : saveMessage ? (
              <span className="text-emerald-400" role="status">
                {saveMessage}
              </span>
            ) : (
              <span>
                Federal {federalCount}/{MAX_THEMES_PER_SPHERE} · Estadual {estadualCount}/
                {MAX_THEMES_PER_SPHERE} · Perfis {profileForm.interestProfiles.length}/{MAX_LIST_ITEMS} ·
                Portais {profileForm.interestSites.length}/{MAX_LIST_ITEMS} · Adversários{" "}
                {profileForm.oppositionProfiles.length}/{MAX_LIST_ITEMS}
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
    </div>
  );
}
