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

export function MarketingHomePage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-md-border/40 bg-md-bg">
        {/* Split em xl (não lg): abaixo de 1280 a coluna de texto fica estreita, a copy
            estica a linha e o object-cover come as laterais da imagem. Empilhado é melhor. */}
        <div className="grid xl:grid-cols-[minmax(0,42fr)_minmax(0,58fr)]">
          <div className="flex items-center px-4 py-14 sm:px-6 sm:py-20 xl:py-24 xl:pl-20 2xl:pl-32">
            {/* -translate-y: sobe o bloco acima do centro geométrico sem alterar a
                altura da linha do grid (padding assimétrico esticaria a seção). */}
            <div className="w-full min-w-0 max-w-2xl xl:-translate-y-8">
              <h1 className="text-4xl font-bold tracking-tight text-md-text sm:text-5xl lg:text-6xl lg:leading-[1.08]">
                A <span className="text-emerald-400">tropa de IA</span> do Candidato em{" "}
                <span className="text-emerald-400">2026</span>.
              </h1>
              <p className="mt-6 text-base leading-relaxed text-md-text-muted sm:text-lg">
                O plenário e o jornal ficaram para trás. A verdadeira briga é{" "}
                <span className="text-emerald-400">dentro do feed do eleitor</span>. Nosso
                ecossistema completo de IA monitora, produz e publica sua comunicação para
                garantir que você vença onde importa.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href={MARKETING_CTA_HREF} className="primary-button">
                  {MARKETING_CTA_LABEL}
                </Link>
                <Link
                  href={"/ecossistema" as Route}
                  className="secondary-button inline-flex items-center"
                >
                  Conheça o ecossistema
                </Link>
              </div>
            </div>
          </div>

          <div className="relative aspect-[3/2] w-full xl:aspect-auto xl:min-h-[42rem]">
            {/* !h-full: .marketing-shell img força height:auto e vence a utilitária */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/marketing/hero-agentes.webp"
              alt="Candidato diante do feed, cercado pelos agentes de IA do Mandato Digital: Sentinela, Curador, Criador, Distribuidor e Auditor"
              width={1536}
              height={1024}
              className="absolute inset-0 !h-full w-full object-cover object-center"
              decoding="async"
              fetchPriority="high"
            />
            <div
              className="pointer-events-none absolute inset-y-0 left-0 hidden w-32 bg-gradient-to-r from-md-bg via-md-bg/60 to-transparent xl:block"
              aria-hidden
            />
          </div>
        </div>
      </section>

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
