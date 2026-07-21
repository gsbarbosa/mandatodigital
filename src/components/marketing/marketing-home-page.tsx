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

export function MarketingHomePage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-slate-800/40">
        <div
          className="pointer-events-none absolute inset-0 opacity-35"
          style={{
            backgroundImage: "url(/marketing/hero-bg.jpg)",
            backgroundSize: "cover",
            backgroundPosition: "right center",
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#020617] via-[#020617]/95 to-[#020617]/70"
          aria-hidden
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-2 lg:gap-12">
          <div className="min-w-0">
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:leading-tight">
              A{" "}
              <span className="text-emerald-400">Tropa de Inteligência Artificial</span> para
              sua (re)eleição.
            </h1>
            <p className="mt-5 text-base leading-relaxed text-slate-300 sm:text-lg">
              Um ecossistema completo para{" "}
              <span className="underline decoration-slate-500 underline-offset-4">monitorar</span>,{" "}
              <span className="underline decoration-slate-500 underline-offset-4">produzir</span>,{" "}
              <span className="underline decoration-slate-500 underline-offset-4">auditar</span> e{" "}
              <span className="underline decoration-slate-500 underline-offset-4">publicar</span> a
              sua comunicação em ritmo industrial, preservando a sua personalidade e ideologia.
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

          <div className="relative mx-auto w-full min-w-0 max-w-xl lg:max-w-none">
            <div className="absolute -inset-3 rounded-[2rem] bg-emerald-500/10 blur-2xl" aria-hidden />
            <div className="relative overflow-hidden rounded-3xl border border-slate-700/70 bg-slate-950/40 shadow-[0_24px_80px_rgba(0,0,0,0.45)] ring-1 ring-emerald-500/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/marketing/hero-tropa.webp"
                alt="Tropa de agentes de IA do Mandato Digital"
                width={1100}
                height={757}
                className="block h-auto w-full max-w-full object-cover"
                decoding="async"
                fetchPriority="high"
              />
            </div>
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
      >
        <FlowTimeline />
      </MarketingSection>

      <MarketingSection title={homeAssembly.title} lead={homeAssembly.body}>
        <AssemblyLine />
      </MarketingSection>

      <MarketingSection title={homeScale.title}>
        <div className="grid gap-4 md:grid-cols-3">
          {homeScale.pillars.map((pillar, index) => {
            const Icon = SCALE_ICONS[index] ?? IconLayers;
            return (
              <MarketingCard
                key={pillar.title}
                title={pillar.title}
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
      </MarketingSection>

      <MarketingSection title={homeVacuum.title} lead={homeVacuum.body}>
        <div className="grid gap-4 md:grid-cols-3">
          {homeVacuum.points.map((point, index) => {
            const Icon = VACUUM_ICONS[index] ?? IconGauge;
            return (
              <MarketingCard
                key={point.title}
                title={point.title}
                eyebrow={`${index + 1}`}
                icon={
                  <MarketingIconBadge className="border-slate-700 bg-slate-950/70 text-slate-200">
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

      <MarketingSection title={homeWhy.title}>
        <div className="grid gap-4 md:grid-cols-3">
          {homeWhy.benefits.map((benefit, index) => {
            const Icon = WHY_ICONS[index] ?? IconSparkles;
            return (
              <MarketingCard
                key={benefit.title}
                title={benefit.title}
                icon={
                  <MarketingIconBadge className="border-emerald-500/25 bg-emerald-500/10 text-emerald-400">
                    <Icon size={20} />
                  </MarketingIconBadge>
                }
              >
                <p>{benefit.body}</p>
              </MarketingCard>
            );
          })}
        </div>
      </MarketingSection>

      <MarketingSection title={homeEcosystemSummary.title} lead={homeEcosystemSummary.subtitle}>
        <ol className="space-y-3">
          {homeEcosystemSummary.agents.map((agent, index) => {
            const accentKey = ECOSYSTEM_ACCENTS[index] ?? "sentinela";
            const accent = AGENT_ACCENT_CLASS[accentKey];
            const AgentIcon = AGENT_ICONS[accentKey];
            return (
              <li
                key={agent}
                className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 text-sm text-slate-300"
              >
                <MarketingIconBadge
                  className={`mt-0.5 !h-9 !w-9 ${accent.soft} ${accent.text} ${accent.border}`}
                >
                  <AgentIcon size={18} />
                </MarketingIconBadge>
                <span>
                  <span className="font-semibold text-white">{index + 1}.</span> {agent}
                </span>
              </li>
            );
          })}
        </ol>
        <Link href={"/ecossistema" as Route} className="primary-button mt-8 inline-flex">
          {homeEcosystemSummary.ctaLabel}
        </Link>
      </MarketingSection>

      <MarketingCtaBand />
    </>
  );
}
