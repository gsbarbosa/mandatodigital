import type { Route } from "next";
import Link from "next/link";

import { AssemblyLine } from "@/components/marketing/assembly-line";
import { FlowTimeline } from "@/components/marketing/flow-timeline";
import {
  AGENT_ICONS,
  IconFingerprint,
  IconGauge,
  IconLayers,
  IconMoon,
  IconScale,
  IconSparkles,
  IconUsers,
  IconVolume,
  IconZapFast,
  MarketingIconBadge,
} from "@/components/marketing/icons";
import { MarketingCard } from "@/components/marketing/marketing-card";
import { MarketingCtaBand } from "@/components/marketing/marketing-cta-band";
import { MarketingSection } from "@/components/marketing/marketing-section";
import {
  homeAssembly,
  homeEcosystemSummary,
  homeFactToFeed,
  homeHero,
  homeScale,
  homeVacuum,
  homeWhy,
} from "@/lib/marketing/home-content";
import {
  AGENT_ACCENT_CLASS,
  MARKETING_CTA_HREF,
  MARKETING_CTA_LABEL,
  type AgentAccent,
} from "@/lib/marketing/shared";

const SCALE_ICONS = [IconUsers, IconLayers, IconFingerprint] as const;
const VACUUM_ICONS = [IconVolume, IconZapFast, IconGauge] as const;
const WHY_ICONS = [IconScale, IconMoon, IconSparkles] as const;

const ECOSYSTEM_ACCENTS: AgentAccent[] = [
  "sentinela",
  "curador",
  "criativo",
  "auditor",
  "distribuidor",
];

function TitleAccent({ lead, accent }: { lead: string; accent: string }) {
  return (
    <>
      {lead} <span className="text-emerald-400">{accent}</span>
    </>
  );
}

function ScaleVisual() {
  return (
    <div className="relative mx-auto flex w-full max-w-[300px] items-center justify-center lg:max-w-[420px]">
      <div
        className="pointer-events-none absolute inset-[6%] rounded-full bg-emerald-500/15 blur-3xl"
        aria-hidden
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/marketing/criativo/content-cards.jpg"
        alt="Painel mostrando dezenas de peças de conteúdo geradas simultaneamente pela plataforma"
        width={757}
        height={1000}
        className="relative z-10 h-auto w-full rounded-3xl border border-md-border shadow-[0_20px_60px_rgba(16,185,129,0.15)]"
        decoding="async"
        loading="lazy"
      />
    </div>
  );
}

function FlowArrow() {
  return (
    <svg
      className="pointer-events-none mx-auto mb-6 hidden w-full max-w-3xl -scale-y-100 md:block"
      viewBox="0 0 700 90"
      fill="none"
      aria-hidden
    >
      <defs>
        <linearGradient id="why-flow-arrow" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgb(148 163 184)" stopOpacity="0" />
          <stop offset="55%" stopColor="rgb(148 163 184)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="rgb(148 163 184)" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <path
        d="M10 78 C 220 78, 420 20, 636 20"
        stroke="url(#why-flow-arrow)"
        strokeWidth="10"
        strokeLinecap="round"
      />
      <path
        d="M606 2 L668 20 L606 42"
        stroke="url(#why-flow-arrow)"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EcosystemVisual() {
  return (
    <div className="relative order-3 mx-auto w-full max-w-[520px] lg:order-none lg:h-full lg:max-w-none">
      <div
        className="pointer-events-none absolute -inset-4 rounded-[2rem] bg-emerald-500/10 blur-3xl"
        aria-hidden
      />
      <figure className="relative m-0 overflow-hidden rounded-3xl border border-md-border/70 bg-md-bg/40 shadow-[0_24px_80px_rgba(0,0,0,0.45)] ring-1 ring-emerald-500/20 lg:h-full">
        <div
          role="img"
          aria-label="Sala de operação com os agentes de IA em sinergia: monitoramento 24/7, produção de conteúdo, treinamento de voz e painel de compliance"
          className="aspect-[525/484] w-full bg-cover bg-center lg:aspect-auto lg:h-full"
          style={{ backgroundImage: "url(/marketing/ecossistema/sinergia.webp)" }}
        />
      </figure>
    </div>
  );
}

const HERO_ALT =
  "Candidato diante do feed do eleitor cercado pelos agentes de IA do Mandato Digital: Sentinela, Curador, Criador, Distribuidor e Auditor";

function HeroCopy() {
  return (
    <>
      <h1 className="m-0 text-4xl font-bold leading-tight tracking-tight text-md-text sm:text-5xl xl:text-5xl xl:leading-[1.12] 2xl:text-7xl 2xl:leading-[1.05]">
        {homeHero.title.lead} <span className="text-emerald-400">{homeHero.title.accent}</span>{" "}
        {homeHero.title.tail} <span className="text-emerald-400">{homeHero.title.year}</span>.
      </h1>
      <p className="mt-5 text-base leading-relaxed text-md-text-muted sm:text-lg xl:mt-5 xl:text-base 2xl:text-lg">
        {homeHero.body.line1}
        <br />
        {homeHero.body.line2Lead}{" "}
        <span className="font-semibold text-emerald-400">{homeHero.body.line2Accent}</span>.
        <br />
        {homeHero.body.line3}
        <br />
        <span className="xl:whitespace-nowrap">{homeHero.body.line4}</span>
      </p>
      <div className="mt-8 flex flex-wrap gap-3 xl:mt-8">
        <Link href={MARKETING_CTA_HREF} className="primary-button">
          {MARKETING_CTA_LABEL}
        </Link>
        <Link href={"/ecossistema" as Route} className="secondary-button inline-flex items-center">
          Conheça o ecossistema
        </Link>
      </div>
    </>
  );
}

/**
 * Hero da home.
 *
 * xl+: uma única caixa com aspect-ratio TRAVADO no da própria arte (1672:941)
 * — cover nunca corta nada porque a proporção da caixa é idêntica à da
 * imagem, só escala como um bloco só. O texto é filho dessa caixa,
 * posicionado em % (não em px/rem), então acompanha a arte 1:1 em qualquer
 * largura: cresce e encolhe junto, sem o salto de breakpoint que existia
 * quando texto e imagem eram elementos irmãos dimensionados por conta
 * própria. O retângulo em %% cai no vão escuro entre a borda e o robô
 * Sentinela — testado de 1280 a 2200px sem tocar em nenhum card/prédio.
 *
 * <xl: empilhado — texto em fluxo normal, a arte inteira abaixo.
 */
function HomeHero() {
  return (
    <section className="marketing-hero-backdrop relative overflow-hidden border-b border-md-border">
      {/*
        aspect-[1672/843] (em vez do 1672/941 nativo) + bg-bottom: a arte não
        tem folga própria pra "subir" dentro da caixa (cover já cobre 100%
        dela, sem sobra). O jeito de subir o conteúdo visível é recortar a
        faixa de céu vazio do topo — encurtando a caixa e prendendo o
        recorte pela base, só o topo é cortado. Os 98px cortados (941→843)
        foram calculados pra a cabeça do Sentinela cair exatamente na mesma
        altura do topo do texto (top-[6.4%] abaixo).
      */}
      <div
        className="relative hidden w-full xl:mx-auto xl:block xl:max-w-[2200px]"
        style={{ aspectRatio: "1672 / 843" }}
      >
        <div
          role="img"
          aria-label={HERO_ALT}
          className="hero-art-wide absolute inset-0 bg-cover bg-bottom bg-no-repeat"
        />
        {/*
          top-[6.4%]: mesmo respiro em px do ajuste anterior (65% de corte no
          espaço do menu), só recalculado pra a caixa mais baixa de agora.
        */}
        <div className="absolute left-[4%] top-[6.4%] w-[39%]">
          <HeroCopy />
        </div>
      </div>

      <div className="xl:hidden">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
          <div className="min-w-0 max-w-xl">
            <HeroCopy />
          </div>
          <div
            role="img"
            aria-label={HERO_ALT}
            className="hero-art-mobile mt-10 aspect-[1400/991] w-full bg-cover bg-right bg-no-repeat"
          />
        </div>
      </div>
    </section>
  );
}

export function MarketingHomePage() {
  return (
    <>
      <HomeHero />

      <MarketingSection
        title={
          <>
            Do Fato ao Feed em <span className="text-emerald-400">15 Minutos</span>
          </>
        }
        lead={homeFactToFeed.body}
        wideLead
      >
        <FlowTimeline />
      </MarketingSection>

      <MarketingSection
        title={
          <>
            Linha de montagem <span className="text-emerald-400">autônoma</span> de propaganda
            contextual
          </>
        }
        lead={homeAssembly.body}
        wideLead
      >
        <AssemblyLine />
      </MarketingSection>

      <MarketingSection
        title={<TitleAccent lead={homeScale.titleLead} accent={homeScale.titleAccent} />}
      >
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-12">
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {homeScale.pillars.map((pillar, index) => {
              const Icon = SCALE_ICONS[index] ?? IconLayers;
              return (
                <MarketingCard
                  key={pillar.title}
                  title={pillar.title}
                  compact
                  titleInline
                  icon={
                    <MarketingIconBadge className="border-emerald-500/25 bg-emerald-500/10 text-emerald-400">
                      <Icon size={20} />
                    </MarketingIconBadge>
                  }
                >
                  <p>{pillar.body}</p>
                </MarketingCard>
              );
            })}
          </div>
          <ScaleVisual />
        </div>
      </MarketingSection>

      <MarketingSection
        title={
          <>
            O vácuo informacional é <span className="text-emerald-400">fatal</span>.
          </>
        }
        lead={homeVacuum.body}
        wideLead
      >
        <FlowArrow />
        <div className="grid gap-4 md:grid-cols-3">
          {homeVacuum.points.map((point, index) => {
            const Icon = VACUUM_ICONS[index] ?? IconGauge;
            return (
              <MarketingCard
                key={point.title}
                title={point.title}
                icon={
                  <MarketingIconBadge className="border-amber-500/25 bg-amber-500/10 text-amber-400">
                    <Icon size={20} />
                  </MarketingIconBadge>
                }
              >
                <p>{point.body}</p>
              </MarketingCard>
            );
          })}
        </div>
      </MarketingSection>

      <MarketingSection
        title={
          <>
            <span className="text-emerald-400">Por que</span> o Mandato Digital?
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-3">
          {homeWhy.benefits.map((benefit, index) => {
            const Icon = WHY_ICONS[index] ?? IconSparkles;
            const isQualitySeal = index === 2;
            return (
              <MarketingCard
                key={benefit.title}
                title={benefit.title}
                className={isQualitySeal ? "relative overflow-visible" : undefined}
                icon={
                  <MarketingIconBadge className="border-emerald-500/25 bg-emerald-500/10 text-emerald-400">
                    <Icon size={20} />
                  </MarketingIconBadge>
                }
              >
                <p>{benefit.body}</p>
                {isQualitySeal ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src="/marketing/home/qualidade-selo.svg"
                    alt="Selo de garantia de qualidade"
                    width={404}
                    height={404}
                    className="pointer-events-none absolute -bottom-14 -right-14 h-28 w-28 select-none"
                    aria-hidden
                  />
                ) : null}
              </MarketingCard>
            );
          })}
        </div>
      </MarketingSection>

      <MarketingSection
        title={
          <>
            O <span className="text-emerald-400">Ecossistema</span> de IA Eleitoral
          </>
        }
        lead={homeEcosystemSummary.subtitle}
      >
        <div className="grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-x-12 lg:gap-y-0">
          <div className="min-w-0">
            <ol className="m-0 list-none space-y-5 p-0">
              {homeEcosystemSummary.agents.map((agent, index) => {
                const accentKey = ECOSYSTEM_ACCENTS[index] ?? "sentinela";
                const accent = AGENT_ACCENT_CLASS[accentKey];
                const AgentIcon = AGENT_ICONS[accentKey];
                return (
                  <li
                    key={agent}
                    className="rounded-xl border border-md-border bg-md-surface/40 px-4 py-3"
                  >
                    <div className="grid grid-cols-[20px_minmax(0,1fr)] gap-x-3">
                      {/*
                        text-sm (14px) × leading 1.5 = 21px na 1ª linha.
                        Ícone 18px + mt 1.5px ≈ centro óptico da 1ª linha.
                      */}
                      <AgentIcon
                        size={18}
                        className={`mt-[1.5px] block ${accent.text}`}
                        aria-hidden
                      />
                      <p className="m-0 text-sm leading-[1.5] text-md-text-muted">
                        <span className="font-semibold text-md-text">{index + 1}.</span> {agent}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          <EcosystemVisual />

          <div className="order-2 min-w-0 lg:order-none">
            <Link href={"/ecossistema" as Route} className="primary-button lg:mt-8 inline-flex">
              {homeEcosystemSummary.ctaLabel}
            </Link>
          </div>
        </div>
      </MarketingSection>

      <MarketingCtaBand />
    </>
  );
}
