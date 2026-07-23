import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { IconArrowRight } from "@/components/marketing/icons";
import {
  AGENT_DETAIL_BACK,
  AGENT_DETAIL_CLOSING,
  type AgentDetailMetric,
  type AgentDetailStory,
} from "@/lib/marketing/agent-detail-shared";
import { AGENT_ACCENT_CLASS, type AgentAccent } from "@/lib/marketing/shared";

function highlightPhrase(text: string, phrase: string, accentClass: string) {
  const index = text.indexOf(phrase);
  if (index < 0) return text;
  return (
    <>
      {text.slice(0, index)}
      <span className={accentClass}>{phrase}</span>
      {text.slice(index + phrase.length)}
    </>
  );
}

export function AgentDetailBackLink() {
  return (
    <Link
      href={AGENT_DETAIL_BACK.href}
      className="mb-8 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-slate-400 no-underline transition hover:text-white"
    >
      <IconArrowRight size={14} className="rotate-180 opacity-80" aria-hidden />
      {AGENT_DETAIL_BACK.label}
    </Link>
  );
}

export function AgentDetailVisual({
  src,
  alt,
  accent,
  aspect = "video",
  className = "",
}: {
  src: string;
  alt: string;
  accent?: AgentAccent;
  aspect?: "video" | "square" | "portrait";
  className?: string;
}) {
  const border = accent ? AGENT_ACCENT_CLASS[accent].border : "border-slate-800/80";
  const aspectClass =
    aspect === "square" ? "aspect-square" : aspect === "portrait" ? "aspect-[4/5]" : "aspect-video";

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border bg-slate-950 ${aspectClass} ${border} ${className}`}
    >
      <Image src={src} alt={alt} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 720px" />
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/40 via-transparent to-transparent" />
    </div>
  );
}

export function AgentDetailMetricsStories({
  accent,
  metrics,
  stories,
  className = "",
}: {
  accent: AgentAccent;
  metrics: readonly AgentDetailMetric[];
  stories: readonly AgentDetailStory[];
  className?: string;
}) {
  const classes = AGENT_ACCENT_CLASS[accent];
  const rows = Math.max(metrics.length, stories.length);

  return (
    <div
      className={`grid gap-x-10 gap-y-10 sm:gap-y-12 lg:grid-cols-2 lg:gap-x-12 ${className}`}
    >
      {Array.from({ length: rows }, (_, index) => {
        const metric = metrics[index];
        const story = stories[index];

        return (
          <div key={metric?.label ?? story?.title ?? index} className="contents">
            <div className="min-w-0">
              {metric ? (
                <>
                  <p className={`text-4xl font-bold tracking-tight sm:text-5xl ${classes.text}`}>
                    {metric.value}
                  </p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                    {metric.label}
                  </p>
                </>
              ) : null}
            </div>
            <div className="min-w-0">
              {story ? (
                <>
                  <h2 className="text-base font-semibold text-emerald-400 sm:text-lg">
                    {story.title}
                  </h2>
                  <p className="mt-2.5 text-sm leading-relaxed text-slate-300 sm:text-[15px] sm:leading-relaxed">
                    {story.body}
                  </p>
                </>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AgentDetailHero({
  accent,
  badge,
  titleLead,
  titleAccent,
  subtitle,
  metrics,
  stories,
  visual,
}: {
  accent: AgentAccent;
  badge: string;
  titleLead: string;
  titleAccent: string;
  subtitle?: string;
  metrics: readonly AgentDetailMetric[];
  stories: readonly AgentDetailStory[];
  visual?: {
    src: string;
    alt: string;
    aspect?: "video" | "square" | "portrait";
  };
}) {
  const classes = AGENT_ACCENT_CLASS[accent];

  return (
    <section className="border-t-0 py-10 sm:py-14">
      <div className="mx-auto flex w-full max-w-6xl flex-col px-4 sm:px-6">
        <AgentDetailBackLink />

        <div
          className={`inline-flex w-fit rounded-full border px-3.5 py-1.5 ${classes.border} ${classes.soft}`}
        >
          <span
            className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${classes.text}`}
          >
            {badge}
          </span>
        </div>

        <h1 className="mt-5 max-w-4xl text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
          {titleLead}{" "}
          <span className={`whitespace-nowrap ${classes.text}`}>{titleAccent}</span>
        </h1>

        {subtitle ? (
          <p className="mt-3 text-base font-medium text-sky-300 sm:text-lg">{subtitle}</p>
        ) : null}

        {visual ? (
          <AgentDetailVisual
            src={visual.src}
            alt={visual.alt}
            accent={accent}
            aspect={visual.aspect}
            className={
              visual.aspect === "portrait" ? "mt-8 max-w-md" : "mt-8 max-w-4xl"
            }
          />
        ) : null}

        <AgentDetailMetricsStories
          accent={accent}
          metrics={metrics}
          stories={stories}
          className="mt-10"
        />
      </div>
    </section>
  );
}

export function AgentDetailSection({
  title,
  titleAccent,
  accent = "sentinela",
  lead,
  children,
}: {
  title: string;
  titleAccent?: string;
  accent?: AgentAccent;
  lead?: string;
  children: ReactNode;
}) {
  const classes = AGENT_ACCENT_CLASS[accent];

  return (
    <section className="border-t border-slate-800/60 py-14 sm:py-16">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          {title}
          {titleAccent ? (
            <>
              {" "}
              <span className={`whitespace-nowrap ${classes.text}`}>{titleAccent}</span>
            </>
          ) : null}
        </h2>
        {lead ? (
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400 sm:text-base">
            {lead}
          </p>
        ) : null}
        <div className={title || lead ? "mt-8" : undefined}>{children}</div>
      </div>
    </section>
  );
}

export function AgentDetailClosing() {
  const { title, titleAccent, body, bodyAccent, ctaHref, ctaLabel } = AGENT_DETAIL_CLOSING;

  return (
    <section className="border-t border-slate-800/60 py-16 sm:py-20">
      <div className="mx-auto w-full max-w-3xl px-4 text-center sm:px-6">
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {highlightPhrase(title, titleAccent, "text-emerald-400")}
        </h2>
        <p className="mt-5 text-base leading-relaxed text-slate-400 sm:text-lg">
          {highlightPhrase(body, bodyAccent, "text-emerald-400")}
        </p>
        <Link href={ctaHref as Route} className="primary-button mt-8 inline-flex">
          {ctaLabel}
        </Link>
      </div>
    </section>
  );
}
