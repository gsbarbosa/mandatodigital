import type { Route } from "next";
import Link from "next/link";
import { Fragment } from "react";

import { IconShieldCheck } from "@/components/marketing/icons";
import { MarketingReserveButton } from "@/components/marketing/marketing-reserve-button";
import { MarketingSection } from "@/components/marketing/marketing-section";
import {
  pricingComparison,
  pricingComplianceCta,
  pricingFooterNote,
  pricingIntro,
  pricingPlans,
  pricingRestriction,
  pricingTrialNote,
  pricingUrgencyBanner,
  type PricingAccent,
  type PricingPlan,
} from "@/lib/marketing/planos-content";

const ACCENT: Record<
  PricingAccent,
  {
    name: string;
    currency: string;
    total: string;
    check: string;
    hoverBorder: string;
    hoverGlow: string;
    colSoft: string;
  }
> = {
  slate: {
    name: "text-md-text",
    currency: "text-md-text-soft",
    total: "text-md-text",
    check: "text-cyan-500",
    hoverBorder: "hover:!border-slate-300",
    hoverGlow: "hover:!shadow-[0_0_40px_rgba(255,255,255,0.18)]",
    colSoft: "bg-md-surface/20",
  },
  cyan: {
    name: "text-cyan-400",
    currency: "text-cyan-400",
    total: "text-cyan-300",
    check: "text-cyan-400",
    hoverBorder: "hover:!border-cyan-400",
    hoverGlow: "hover:!shadow-[0_0_40px_rgba(6,182,212,0.25)]",
    colSoft: "bg-cyan-950/5",
  },
  purple: {
    name: "text-purple-400",
    currency: "text-purple-400",
    total: "text-purple-300",
    check: "text-purple-400",
    hoverBorder: "hover:!border-purple-400",
    hoverGlow: "hover:!shadow-[0_0_40px_rgba(168,85,247,0.25)]",
    colSoft: "bg-purple-950/5",
  },
};

function PlanFeature({
  feature,
  checkClass,
}: {
  feature: PricingPlan["features"][number];
  checkClass: string;
}) {
  return (
    <li
      className={`grid grid-cols-[20px_minmax(0,1fr)] gap-x-3 ${
        feature.highlight
          ? "rounded-xl border border-cyan-800/30 bg-cyan-950/20 p-3"
          : ""
      }`}
    >
      <span className={`mt-[1.5px] block text-base font-bold leading-[1.5] ${checkClass}`} aria-hidden>
        ✓
      </span>
      <p className="m-0 text-sm leading-[1.5] text-md-text-muted">
        {feature.strongPrefix ? (
          <>
            <strong className="font-semibold text-md-text">{feature.strongPrefix}</strong>{" "}
            {feature.text}
          </>
        ) : (
          feature.text
        )}
      </p>
    </li>
  );
}

function PlanCard({ plan }: { plan: PricingPlan }) {
  const a = ACCENT[plan.accent];

  return (
    <article
      className={`relative flex h-full flex-col justify-between rounded-[1.75rem] border border-md-border bg-md-surface/30 p-8 shadow-xl backdrop-blur-xl transition-all duration-300 group-hover:scale-[0.98] group-hover:opacity-70 hover:!z-30 hover:!scale-105 hover:!opacity-100 md:p-10 ${a.hoverBorder} ${a.hoverGlow}`}
    >
      {plan.badge ? (
        <div className="absolute -top-4 left-0 right-0 flex justify-center">
          <span className="rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 px-5 py-1.5 text-xs font-extrabold uppercase tracking-widest text-white shadow-lg">
            {plan.badge}
          </span>
        </div>
      ) : null}

      <div>
        <h3 className={`mb-8 text-2xl font-bold tracking-tight ${a.name}`}>{plan.name}</h3>

        <div className="mb-8">
          <div className="mb-1 flex items-center gap-2 text-sm font-medium text-md-text-soft">
            <span className="line-through">{plan.originalPriceLabel}</span>
            <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-bold tracking-wider text-emerald-400">
              50% OFF
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="mr-1 text-xl font-bold tracking-wide text-md-text">
              {plan.installmentPrefix}
            </span>
            <span className={`text-xl font-medium ${a.currency}`}>R$</span>
            <span className="text-5xl font-extrabold tracking-tight text-md-text">
              {plan.installmentValue}
            </span>
          </div>
          <p className={`mt-2 text-left text-xs font-bold tracking-wide sm:text-sm ${a.total}`}>
            {plan.campaignTotalLabel}
          </p>
        </div>

        <ul className="space-y-4 border-t border-md-border-soft pt-6">
          {plan.features.map((feature) => (
            <PlanFeature
              key={`${plan.id}-${feature.strongPrefix ?? ""}${feature.text}`}
              feature={feature}
              checkClass={a.check}
            />
          ))}
        </ul>
      </div>

      <div className="space-y-3 pt-10">
        <div
          className={`mb-4 flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 ${
            plan.restrictionTone === "safe"
              ? "border-md-border/60 bg-md-slate-900"
              : "border-red-900/40 bg-red-950/40"
          }`}
        >
          {plan.restrictionTone === "safe" ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 shrink-0 text-emerald-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 9.9-1" />
            </svg>
          ) : (
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"
              aria-hidden
            />
          )}
          <span
            className={`text-[11px] font-medium sm:text-xs ${
              plan.restrictionTone === "safe" ? "text-md-text-muted" : "text-red-400"
            }`}
          >
            {plan.restriction}
          </span>
        </div>

        <MarketingReserveButton
          planId={plan.id}
          className={`w-full rounded-xl border border-md-border bg-md-slate-800 px-4 py-4 text-center text-sm font-semibold text-md-text shadow-md transition hover:bg-md-overlay-hover focus:outline-none focus:ring-2 focus:ring-slate-600 ${
            plan.accent === "cyan"
              ? "hover:border-cyan-500/40 hover:bg-cyan-900/60 focus:ring-cyan-500"
              : plan.accent === "purple"
                ? "hover:border-purple-500/40 hover:bg-purple-900/60 focus:ring-purple-500"
                : ""
          }`}
        >
          {plan.ctaLabel}
        </MarketingReserveButton>
      </div>
    </article>
  );
}

function ComparisonCell({ value, accent }: { value: string; accent: PricingAccent }) {
  const isCheck = value === "✓" || value.startsWith("✓");
  const isCross = value.startsWith("✕");
  const a = ACCENT[accent];

  return (
    <td className={`px-4 py-3.5 text-center ${a.colSoft}`}>
      {isCheck && value === "✓" ? (
        <span className="text-base font-bold text-emerald-400">✓</span>
      ) : isCheck ? (
        <span className="text-xs font-semibold text-emerald-400">{value}</span>
      ) : isCross ? (
        <span className="text-xs font-normal text-md-text-soft">{value}</span>
      ) : (
        <span
          className={`text-xs ${
            accent === "cyan"
              ? "font-semibold text-cyan-400"
              : accent === "purple"
                ? "font-semibold text-purple-400"
                : "font-normal text-md-text-muted"
          }`}
        >
          {value}
        </span>
      )}
    </td>
  );
}

function TitleAccent({
  lead,
  accent,
  tail,
}: {
  lead: string;
  accent: string;
  tail?: string;
}) {
  return (
    <>
      {lead} <span className="font-bold text-red-400">{accent}</span>
      {tail ? ` ${tail}` : null}
    </>
  );
}

export function MarketingPricingPage() {
  return (
    <>
      <div className="relative z-50 border-b border-cyan-500/30 bg-gradient-to-r from-cyan-500/10 via-sky-500/10 to-cyan-500/10 px-4 py-2 text-center backdrop-blur-sm">
        <p className="m-0 text-xs font-medium text-md-text md:text-sm">
          Planos com <span className="font-bold text-md-text">vagas limitadas</span> por Lote e preço
          promocional com <span className="font-bold text-[var(--sentinela-text)]">50% off</span>.
        </p>
        <span className="sr-only">{pricingUrgencyBanner}</span>
      </div>

      <MarketingSection
        title={pricingIntro.title}
        titleAs="h1"
        lead={pricingIntro.body}
        className="!border-t-0"
        align="center"
        contentGapClassName="mt-16 sm:mt-20"
      >
        <div className="group mx-auto grid max-w-6xl grid-cols-1 items-stretch gap-8 lg:grid-cols-3">
          {pricingPlans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>

        <p className="mx-auto mt-10 max-w-2xl text-center text-sm leading-relaxed text-md-text-soft">
          <strong className="font-semibold text-[var(--sentinela-text)]">
            {pricingTrialNote.emphasis}
          </strong>{" "}
          {pricingTrialNote.tail}
        </p>
      </MarketingSection>

      <div className="mx-auto max-w-xl px-4 pb-8 sm:px-6">
        <Link
          href={pricingComplianceCta.href}
          className="group flex w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-emerald-500 bg-gradient-to-b from-md-bg to-md-bg px-6 py-4 text-center no-underline shadow-[0_0_30px_rgba(16,185,129,0.15)] transition hover:border-emerald-400 hover:from-md-surface hover:to-md-bg"
        >
          <span className="flex items-center justify-center gap-2 text-base font-extrabold uppercase tracking-wider text-emerald-500 sm:text-lg">
            <IconShieldCheck size={20} />
            {pricingComplianceCta.title}
          </span>
          <span className="mt-1 text-xs font-medium tracking-wide text-sky-500 sm:text-sm">
            {pricingComplianceCta.subtitle}
          </span>
        </Link>
      </div>

      <MarketingSection className="!border-t-0">
        <div className="rounded-[2rem] border border-md-border bg-md-surface p-8 shadow-2xl md:p-12">
          <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            {pricingRestriction.eyebrow}
          </div>

          <h2 className="mb-4 text-2xl font-bold leading-tight tracking-tight text-md-text md:text-3xl">
            <TitleAccent
              lead={pricingRestriction.titleLead}
              accent={pricingRestriction.titleAccent}
              tail={pricingRestriction.titleTail}
            />
          </h2>
          <p className="mb-8 max-w-4xl text-sm leading-relaxed text-md-text-soft md:text-base">
            {pricingRestriction.body}
          </p>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {pricingRestriction.lots.map((lot) => (
              <div
                key={lot.number}
                className={`relative flex flex-col justify-between overflow-hidden rounded-2xl border p-6 ${
                  lot.tone === "active"
                    ? "border-cyan-500/60 bg-gradient-to-br from-md-slate-900 to-md-bg"
                    : "border-md-border bg-md-surface"
                }`}
              >
                <div
                  className={`absolute right-0 top-0 rounded-bl-lg px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider shadow-sm ${
                    lot.tone === "active"
                      ? "bg-cyan-500 text-slate-900"
                      : "bg-white text-slate-900"
                  }`}
                >
                  {lot.badge}
                </div>
                <div>
                  <div className="mb-3 flex items-center gap-3">
                    <div
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        lot.tone === "active"
                          ? "bg-cyan-500/20 text-cyan-400"
                          : "bg-md-slate-800 text-md-text-soft"
                      }`}
                    >
                      {lot.number}
                    </div>
                    <h3 className="text-base font-bold text-md-text">{lot.title}</h3>
                  </div>
                  <p className="mb-4 text-sm leading-relaxed text-md-text-muted">{lot.body}</p>
                </div>
                <p
                  className={`mt-2 border-t pt-2.5 text-xs font-medium leading-tight ${
                    lot.tone === "active"
                      ? "border-cyan-500/20 text-cyan-500/90"
                      : "border-md-border text-md-text-soft"
                  }`}
                >
                  {lot.footnote}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-8 grid grid-cols-1 gap-8 border-t border-md-border-soft pt-8 md:grid-cols-3">
            {pricingRestriction.footnotes.map((note) => (
              <div key={note.title}>
                <h4 className="mb-2 text-xs font-bold text-md-text">{note.title}</h4>
                <p className="text-xs leading-relaxed text-md-text-soft">{note.body}</p>
              </div>
            ))}
          </div>
        </div>
      </MarketingSection>

      <MarketingSection
        title={pricingComparison.title}
        lead={pricingComparison.lead}
        align="center"
        className="!border-t-0 !pt-8"
      >
        <div className="overflow-hidden rounded-2xl border border-md-border bg-md-surface/20 shadow-2xl backdrop-blur-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="border-b border-md-border bg-md-bg/80 text-[11px] font-bold uppercase tracking-widest text-md-text-soft">
                  <th className="w-2/5 px-6 py-5">Serviço / Funcionalidade</th>
                  <th className="w-1/5 bg-md-surface/30 px-4 py-5 text-center text-md-text">
                    Essencial
                  </th>
                  <th className="w-1/5 bg-cyan-950/10 px-4 py-5 text-center text-cyan-400">
                    Avançado
                  </th>
                  <th className="w-1/5 bg-purple-950/10 px-4 py-5 text-center text-purple-400">
                    Elite
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-md-border/40 text-xs text-md-text-muted md:text-sm">
                {pricingComparison.rows.map((row) => (
                  <Fragment key={row.label}>
                    {row.section ? (
                      <tr className="bg-md-bg/50 text-[10px] font-bold uppercase tracking-widest text-md-text-soft">
                        <td colSpan={4} className="px-6 py-3 text-cyan-500">
                          {row.section}
                        </td>
                      </tr>
                    ) : null}
                    <tr className="transition-colors hover:bg-md-overlay-hover/20">
                      <td className="px-6 py-3.5 font-medium text-md-text">{row.label}</td>
                      <ComparisonCell value={row.values[0]} accent="slate" />
                      <ComparisonCell value={row.values[1]} accent="cyan" />
                      <ComparisonCell value={row.values[2]} accent="purple" />
                    </tr>
                  </Fragment>
                ))}
                <tr className="border-t-2 border-md-border bg-md-bg/90">
                  <td className="px-6 py-6 text-xs font-bold text-md-text md:text-sm">
                    Concluir reserva VIP no respectivo plano:
                  </td>
                  {pricingPlans.map((plan) => (
                    <td
                      key={`cta-${plan.id}`}
                      className={`px-4 py-6 text-center ${ACCENT[plan.accent].colSoft}`}
                    >
                      <MarketingReserveButton
                        planId={plan.id}
                        className={`block w-full rounded-xl border px-2 py-3.5 text-xs font-semibold text-md-text shadow transition ${
                          plan.id === "avancado"
                            ? "border-transparent bg-gradient-to-r from-cyan-500 to-blue-600 shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:from-cyan-400 hover:to-blue-500"
                            : plan.id === "elite"
                              ? "border-purple-500/30 bg-md-slate-800 hover:bg-purple-900/60"
                              : "border-md-border bg-md-slate-800 hover:bg-md-overlay-hover"
                        }`}
                      >
                        Reservar {plan.name}
                      </MarketingReserveButton>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-10 text-center text-sm font-semibold tracking-wide text-md-text-soft">
          {pricingFooterNote}
        </p>
      </MarketingSection>
    </>
  );
}
