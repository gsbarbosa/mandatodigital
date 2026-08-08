"use client";

import type { Route } from "next";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { BrazilUfMap } from "@/components/product/brazil-uf-map";
import { MunicipioPicker } from "@/components/product/municipio-picker";
import { useOnboarding } from "@/components/product/onboarding-provider";
import { ProductPageHeader } from "@/components/product/product-page-header";
import { useProductApp } from "@/components/product/provider";
import { useDevAccountMode } from "@/components/product/use-dev-account-mode";
import { useGuestCreditsGate } from "@/components/product/use-guest-credits-gate";
import { ThemeTagPill } from "@/components/product/theme-tag";
import {
  GUEST_CREDITS_EXHAUSTED_ACTION_MESSAGE,
  GUEST_THEME_SAVE_BLOCKED_MESSAGE,
  GUEST_THEME_SAVE_LIMIT,
} from "@/lib/guest-limits";
import {
  incrementGuestThemeSaveCount,
  readGuestThemeSaveCount,
} from "@/lib/guest-client-usage";
import type { SocialHandle } from "@/lib/types";
import { mirrorInterestThemesToSpheres } from "@/lib/sentinel-profile-themes";
import {
  getNationalPortalHosts,
  getPortalHostLabel,
  getStatePortalHosts,
} from "@/lib/sentinel-portal-catalog";
import {
  MAX_ADVERSARY_PROFILES,
  MAX_INTEREST_PROFILES,
  MAX_INTEREST_THEMES,
  MAX_MUNICIPAL_CITIES,
  MAX_MUNICIPAL_PORTALS,
  interestThemeGroups,
  type SphereThemeGroup,
} from "@/lib/sphere-theme-catalog";
import { PLAN_SELECTION_PATH } from "@/lib/registration-gate";

/** Teto prático no premium (UI + schema); convidado usa os MAX_* do catálogo. */
const PREMIUM_SELECTION_CAP = 50;

const SOCIAL_NETWORKS = ["Instagram", "TikTok", "Twitter/X"];

/**
 * Google News e Bing News rodam nas três esferas, junto com os portais fixos —
 * por isso entram na mesma lista de fontes: o tema é aplicado do mesmo jeito
 * sobre o que vem de qualquer uma delas.
 */
const SEARCH_ENGINE_SOURCE_ITEMS = ["Google News", "Bing News"];

/**
 * Exemplos fixos — ilustram o mecanismo de expansão semântica, não a seleção atual
 * do usuário. Antes isso vinha de /api/sentinel/expansions (temas realmente salvos
 * no perfil), mas o painel só recarregava no mount e logo após "Salvar", e a
 * geração via LLM roda em background sem await no servidor — o fetch do cliente
 * quase sempre chegava antes da regeneração terminar, então o usuário via termos
 * desatualizados e achava que a expansão "nunca mudava".
 */
const STATIC_EXPANSION_EXAMPLES: { theme: string; terms: string }[] = [
  {
    theme: "Direitos Humanos",
    terms:
      "Direitos Humanos, Direitos Fundamentais, Direitos Civis, Direitos Sociais, DDH, Defensoria Pública, Conselho Municipal de Direitos Humanos, Política de Direitos Humanos, Programa de Proteção aos Direitos Humanos, Violação de Direitos Humanos, Cidadania, Inclusão social, Direitos da população ribeirinha, Combate à discriminação, Justiça social",
  },
  {
    theme: "Autonomia do Banco Central",
    terms:
      "Banco Central do Brasil, autonomia do BC, independência do Banco Central, política monetária, controle da inflação, Comitê de Política Monetária, COPOM, regulação financeira, sistema financeiro nacional, governo federal, Banco Central independente, decisões monetárias, estabilidade econômica, mercado financeiro, política econômica",
  },
  {
    theme: "Geração de Renda",
    terms:
      "geração de renda, renda urbana, economia local, inclusão produtiva, programa bolsa família, auxílio emergencial, microcrédito, empreendedorismo social, trabalho informal, capacitação profissional, desenvolvimento econômico, políticas públicas de emprego, incentivo ao comércio local, sustentabilidade econômica",
  },
];

function SemanticExpansionNote() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-6 pt-6 border-t border-md-border">
      <p className="text-sm text-md-text-soft italic">
        Todos os temas passam por expansão semântica, garantindo por ex. que assuntos relacionados a
        &quot;ambulância&quot;, sejam contemplados em &quot;Saúde Pública&quot;.{" "}
        <button type="button" onClick={() => setOpen((current) => !current)} className={TEXT_LINK_BUTTON_CLASS}>
          Exemplos de expansão semântica
        </button>
      </p>
      {open ? (
        <div className="mt-3 text-xs text-md-text-soft">
          <p className="mb-1">Exemplos de expansão semântica na prática:</p>
          <ul className="space-y-1">
            {STATIC_EXPANSION_EXAMPLES.map((example) => (
              <li key={example.theme}>
                <strong className="text-md-text-soft">{example.theme}:</strong> {example.terms}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

const REMOVE_ROW_BUTTON_CLASS =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-md-border/60 bg-transparent text-md-text-soft hover:border-md-border-hover hover:bg-md-overlay-hover hover:text-md-text transition-colors shrink-0";

const SECTION_CARD_CLASS = "md-product-section p-6 md:p-8 mb-8 scroll-mt-24";

const TEXT_LINK_BUTTON_CLASS =
  "inline bg-transparent p-0 text-xs text-[var(--curador-text)] hover:text-[var(--curador-text)] underline underline-offset-2";

function formatSelectionCount(count: number, limit: number | null) {
  if (limit === null) {
    return `${count} selecionado${count === 1 ? "" : "s"}`;
  }
  return `${count}/${limit}`;
}

/**
 * Lista somente-leitura (portais monitorados, cidades escolhidas). Sem contorno de
 * pílula nem hover — de propósito, para não parecer um seletor como os temas/estado/município.
 */
function InfoList({ items, dotClassName }: { items: readonly string[]; dotClassName: string }) {
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <li key={item} className="flex items-center gap-2 text-sm text-md-text-muted">
          <span aria-hidden="true" className={`h-1 w-1 rounded-full shrink-0 ${dotClassName}`} />
          {item}
        </li>
      ))}
    </ul>
  );
}

/**
 * Painel retrátil para as fontes nacionais/estaduais — conteúdo somente informativo,
 * recolhido por padrão para não competir visualmente com o painel Municipal (a única
 * parte desta seção onde o usuário efetivamente age).
 */
function SourcesDisclosure({
  title,
  accentClassName,
  children,
}: {
  title: string;
  accentClassName: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-xl border border-md-border bg-md-surface/30">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="text-lg font-bold text-md-text">
          Fontes <span className={accentClassName}>{title}</span>
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          className="h-4 w-4 shrink-0 text-md-text-soft transition-transform group-open:rotate-180"
        >
          <path
            d="M5 7.5L10 12.5L15 7.5"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </summary>
      <div className="px-4 pb-4 pt-1">{children}</div>
    </details>
  );
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
          <h3 className="text-sm font-semibold text-md-text mb-3 uppercase tracking-wider">
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
      ? "border-[var(--sentinela-border)] bg-[var(--sentinela-soft)] text-[var(--sentinela-text)] hover:bg-[var(--sentinela-soft)]"
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
              className={`bg-md-surface-inset border border-md-border text-md-text-muted text-xs rounded-lg w-full min-w-0 px-2 py-2.5 outline-none ${focusRing}`}
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
              className={`bg-md-surface-inset border border-md-border text-md-text-muted text-sm rounded-lg w-full min-w-0 px-3 py-2.5 outline-none ${focusRing}`}
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
  const { exhausted: creditsExhausted } = useGuestCreditsGate();
  const { markRadarSaved, guideOpen: onboardingGuideOpen } = useOnboarding();
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [limitMessage, setLimitMessage] = useState<string | null>(null);
  const [guestNoteDismissed, setGuestNoteDismissed] = useState(false);

  // Temas, municípios e portais regionais têm teto fixo independente do plano —
  // só perfis de rede social e adversários seguem o teto ampliado do premium.
  const selectionLimit = MAX_INTEREST_THEMES;
  const municipalCitiesLimit = MAX_MUNICIPAL_CITIES;
  const municipalPortalsLimit = MAX_MUNICIPAL_PORTALS;
  const interestProfilesLimit = isPremium ? PREMIUM_SELECTION_CAP : MAX_INTEREST_PROFILES;
  const adversaryProfilesLimit = isPremium ? PREMIUM_SELECTION_CAP : MAX_ADVERSARY_PROFILES;

  const municipalAddPortalLabel = `+ adicionar portal (máx ${MAX_MUNICIPAL_PORTALS} - versão teste)`;
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

  const selectedCities = useMemo(
    () => profileForm.municipalCities.filter(Boolean),
    [profileForm.municipalCities],
  );

  const nationalPortals = useMemo(() => getNationalPortalHosts(), []);
  const estadualPortals = useMemo(
    () => getStatePortalHosts(profileForm.state),
    [profileForm.state],
  );

  /** Trocar de UF invalida os municípios escolhidos, que pertencem ao estado anterior. */
  function handleSelectUf(uf: string) {
    setProfileForm((current) =>
      current.state === uf
        ? current
        : { ...current, state: uf, municipalCities: [] },
    );
  }

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

    if (creditsExhausted && !isPremium) {
      setLimitMessage(GUEST_CREDITS_EXHAUSTED_ACTION_MESSAGE);
      return;
    }

    if (!isPremium && readGuestThemeSaveCount() >= GUEST_THEME_SAVE_LIMIT) {
      setLimitMessage(GUEST_THEME_SAVE_BLOCKED_MESSAGE);
      return;
    }

    try {
      const result = await saveProfile({
        allowDraftDefaults: true,
        silent: true,
        throwOnError: true,
        sentinelRefreshPolicy: "themes",
        countGuestThemeSave: true,
      });
      if (!isPremium) {
        incrementGuestThemeSaveCount();
      }
      // Libera o Próximo do passo "Salvar radar" no onboarding guiado.
      markRadarSaved();
      if (result?.sentinelRefreshSkipped && result.sentinelRefreshMessage) {
        setSaveMessage(result.sentinelRefreshMessage);
      } else if (!onboardingGuideOpen) {
        // Durante o onboarding guiado, o próprio tip leva para o próximo passo
        // (bridge "Temas configurados!") — o redirecionamento manual só faz
        // sentido fora dele.
        router.push("/monitoramento");
      }
    } catch {
      // Erro exibido pelo provider (banner global).
    }
  }

  const planNote = limitMessage ? (
    <span className="text-amber-400">{limitMessage}</span>
  ) : creditsExhausted && !isPremium ? (
    <span className="text-amber-400">
      {GUEST_CREDITS_EXHAUSTED_ACTION_MESSAGE}{" "}
      <Link href={PLAN_SELECTION_PATH as Route} className="underline underline-offset-2">
        Ver planos e preços
      </Link>
    </span>
  ) : saveMessage ? (
    <span className="text-[var(--sentinela-text)]" role="status">
      {saveMessage}
    </span>
  ) : !isPremium && !guestNoteDismissed ? (
    <span className="flex items-start gap-2">
      <span>
        Versão convidado: até {MAX_INTEREST_THEMES} temas, {MAX_MUNICIPAL_CITIES} municípios,{" "}
        {MAX_MUNICIPAL_PORTALS} portais, {MAX_INTEREST_PROFILES} perfis de rede sociais e{" "}
        {MAX_ADVERSARY_PROFILES} adversários. O monitoramento das pautas não é em tempo real.
      </span>
      <button
        type="button"
        aria-label="Fechar aviso"
        onClick={() => setGuestNoteDismissed(true)}
        className="shrink-0 text-md-text-soft hover:text-md-text"
      >
        ×
      </button>
    </span>
  ) : null;

  return (
    <div className="relative min-h-full overflow-x-hidden pb-28" data-testid="temas-page">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute top-[-10%] left-[-10%] h-[40%] w-[50%] rounded-full bg-blue-600/10 blur-[140px]" />
        <div className="absolute top-[40%] right-[-10%] h-[40%] w-[40%] rounded-full bg-cyan-600/10 blur-[120px]" />
      </div>

      <div className="max-w-5xl mx-auto relative z-10 px-4 sm:px-6 lg:px-8 pt-10">
        <ProductPageHeader
          title={
            <>
              Monitoramento de Pautas{" "}
              <span className="text-[var(--curador-text)]">&quot;da sua bandeira&quot;</span>
            </>
          }
          description="Monitore todos os assuntos de interesse da sua campanha em um só lugar, incluindo adversários e temas de interesse. Vamos começar."
        />

        <section
          id="territorio"
          data-onboarding-anchor="temas-territorio"
          className={SECTION_CARD_CLASS}
        >
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:divide-x md:divide-md-border">
            <div className="md:pr-8">
              <h2 className="text-2xl font-bold text-md-text">
                Selecione seu <span className="text-[var(--curador-text)]">Estado</span>
              </h2>
              <p className="mt-2 mb-6 text-sm text-md-text-soft">
                Selecione o Estado onde faremos o monitoramento das notícias para sua campanha
                (interesse Estadual).
              </p>
              <BrazilUfMap value={profileForm.state} onSelect={handleSelectUf} />
            </div>

            <div className="md:pl-8">
              <h2 className="text-2xl font-bold text-md-text">
                Selecione seu <span className="text-[var(--sentinela-text)]">Município</span>
              </h2>
              <p className="mt-2 mb-6 text-sm text-md-text-soft">
                Agora selecione até {municipalCitiesLimit} municípios (capital e/ou interior) onde
                faremos o monitoramento das notícias, preferencialmente, mais próximo da sua base
                eleitoral.
              </p>
              <MunicipioPicker
                uf={profileForm.state}
                value={selectedCities}
                maxItems={municipalCitiesLimit}
                onChange={(municipalCities) =>
                  setProfileForm((current) => ({ ...current, municipalCities }))
                }
              />
            </div>
          </div>
        </section>

        <section
          id="temas"
          data-onboarding-anchor="temas-federal"
          className={SECTION_CARD_CLASS}
        >
          <div className="border-b border-md-border pb-4 mb-8">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-bold text-md-text">
                Temas de <span className="text-[var(--curador-text)]">interesse</span>
              </h2>
              <span
                data-testid="temas-selection-count"
                className="inline-flex items-baseline gap-1 rounded-xl border border-[var(--curador-border)] bg-[var(--curador-soft)] px-3 py-1 text-lg font-bold tabular-nums text-[var(--curador-text)] shadow-[0_0_18px_rgba(6,182,212,0.15)]"
              >
                {formatSelectionCount(selectedThemes.length, selectionLimit)}
              </span>
            </div>
            <p className="mt-2 text-sm text-md-text-soft">
              Selecione os temas do seu interesse. O monitoramento se concentrará nas notícias
              desses temas em todas as esferas — nacional, estadual e municipal.
            </p>
          </div>

          <InterestThemeSections
            groups={interestThemeGroups}
            selected={selectedThemes}
            selectionLimit={selectionLimit}
            onToggle={toggleTheme}
          />

          <SemanticExpansionNote />
        </section>

        <section
          id="monitoramento-esferas"
          data-onboarding-anchor="temas-monitoramento-esferas"
          className={SECTION_CARD_CLASS}
        >
          <h2 className="text-2xl font-bold text-md-text mb-1">Detalhes do monitoramento</h2>
          <p className="text-md-text-soft text-sm mb-8 border-b border-md-border pb-4">
            Conheça as fontes das nossas buscas no nível Nacional, Estadual e incremente as fontes
            do nível Municipal.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <SourcesDisclosure title="Nacionais" accentClassName="text-[var(--curador-text)]">
              <p className="text-sm text-md-text-soft mb-4">
                Para a esfera nacional, monitoramos os portais:
              </p>
              <InfoList
                items={[...nationalPortals.map(getPortalHostLabel), ...SEARCH_ENGINE_SOURCE_ITEMS]}
                dotClassName="bg-cyan-400"
              />
            </SourcesDisclosure>

            <SourcesDisclosure title="Estaduais" accentClassName="text-purple-400">
              <p className="text-sm text-md-text-soft mb-4">
                Para a esfera estadual, monitoramos os principais veículos locais do seu estado,
                além de agregadores de notícias:
              </p>
              {estadualPortals.length > 0 ? (
                <InfoList
                  items={[
                    ...estadualPortals.map(getPortalHostLabel),
                    ...SEARCH_ENGINE_SOURCE_ITEMS,
                  ]}
                  dotClassName="bg-purple-400"
                />
              ) : (
                <p className="text-sm text-md-text-soft">
                  Selecione o Estado no primeiro card desta página para ver os portais estaduais
                  monitorados.
                </p>
              )}
            </SourcesDisclosure>
          </div>

          <div
            id="municipal"
            data-onboarding-anchor="temas-municipal"
            className="rounded-2xl border border-md-border bg-md-surface-inset p-6"
          >
            <h3 className="text-lg font-bold text-md-text mb-2">
              Nível <span className="text-[var(--sentinela-text)]">Municipal</span>
            </h3>
            <p className="text-sm text-md-text-soft mb-4">
              Para a esfera municipal, monitoramos os agregadores de notícias:
            </p>
            <InfoList items={SEARCH_ENGINE_SOURCE_ITEMS} dotClassName="bg-emerald-400" />
            <p className="text-sm text-md-text-soft mt-4 mb-8">
              Inclua portais, sites e blogs regionais do seu interesse para monitorarmos. Isso
              aumenta a chance de encontrarmos notícias dos temas selecionados, dentro do seu(s)
              município(s).
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h4 className="text-xs font-bold text-md-text-soft tracking-widest uppercase mb-4">
                  Portais, Sites e Blogs
                </h4>
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
                        className="bg-md-surface-inset border border-md-border text-md-text-muted text-sm rounded-lg w-full min-w-0 px-3 py-2.5 outline-none focus:ring-emerald-500 focus:border-emerald-500"
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
                  className="w-full py-2.5 rounded-xl border border-[var(--sentinela-border)] border-dashed bg-[var(--sentinela-soft)] text-[var(--sentinela-text)] text-sm font-semibold hover:bg-[var(--sentinela-soft)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {municipalAddPortalLabel}
                </button>
              </div>

              <div>
                <h4 className="text-xs font-bold text-md-text-soft tracking-widest uppercase mb-4">
                  Cidades monitoradas
                </h4>
                {selectedCities.length > 0 ? (
                  <InfoList items={selectedCities} dotClassName="bg-emerald-400" />
                ) : (
                  <p className="text-sm text-md-text-soft">
                    Nenhuma cidade escolhida ainda. Selecione o Estado e os municípios no primeiro
                    card desta página.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        <section
          id="interesse"
          data-onboarding-anchor="temas-interesse"
          className={SECTION_CARD_CLASS}
        >
          <h2 className="text-2xl font-bold text-md-text mb-2">
            Perfis de <span className="text-violet-400">rede sociais</span>
          </h2>
          <p className="text-md-text-soft text-sm mb-8 border-b border-md-border pb-4">
            Monitore perfis de interesse. O monitoramento mostra os últimos posts ordenados por
            engajamento social.
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
          className="md-product-section border-red-900/30 mb-0 scroll-mt-24 p-6 md:p-8 shadow-[0_0_20px_rgba(153,27,27,0.08)]"
        >
          <h2 className="text-2xl font-bold text-md-text mb-2">Adversários Políticos</h2>
          <p className="text-md-text-soft text-sm mb-6 border-b border-md-border pb-4">
            Acompanhe os últimos posts deles no monitoramento, ordenados por engajamento
          </p>

          <h3 className="text-xs font-bold text-md-text-soft tracking-widest uppercase mb-4">
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

      {planNote ? (
        <div
          role="note"
          aria-label="Limites do plano"
          data-onboarding-avoid=""
          className="fixed right-6 top-1/2 z-30 hidden w-[min(240px,calc(100vw-2rem))] -translate-y-1/2 rounded-xl border border-md-border bg-md-surface/95 p-3 text-[11px] leading-relaxed text-md-text-soft shadow-[0_16px_36px_rgba(15,23,42,0.28)] backdrop-blur-sm lg:block"
        >
          {planNote}
        </div>
      ) : null}

      <div className="sticky bottom-0 left-0 right-0 mt-10 bg-md-surface/80 backdrop-blur-md z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-center">
          <button
            type="button"
            id="salvar"
            data-testid="salvar-radar-button"
            data-onboarding-anchor="temas-salvar"
            onClick={() => void handleSave()}
            disabled={isSavingProfile || (creditsExhausted && !isPremium)}
            title={
              creditsExhausted && !isPremium
                ? GUEST_CREDITS_EXHAUSTED_ACTION_MESSAGE
                : undefined
            }
            className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-md-text font-semibold py-2.5 px-8 rounded-lg transition-all shadow-[0_0_15px_rgba(6,182,212,0.2)] disabled:opacity-50"
          >
            {isSavingProfile ? "Salvando..." : "Salvar e avançar"}
          </button>
        </div>
      </div>
    </div>
  );
}
