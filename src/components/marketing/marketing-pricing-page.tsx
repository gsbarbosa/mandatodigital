import type { Route } from "next";
import Link from "next/link";
import { Fragment } from "react";

import { IconShieldCheck } from "@/components/marketing/icons";
import { MarketingCtaBand } from "@/components/marketing/marketing-cta-band";
import { MarketingReserveButton } from "@/components/marketing/marketing-reserve-button";
import { MarketingSection } from "@/components/marketing/marketing-section";
import {
  pricingComparison,
  pricingComplianceCta,
  pricingFooterNote,
  pricingIntro,
  pricingPlans,
  pricingRestriction,
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
    name: "text-white",
    currency: "text-slate-400",
    total: "text-white",
    check: "text-cyan-500",
    hoverBorder: "hover:!border-slate-300",
    hoverGlow: "hover:!shadow-[0_0_40px_rgba(255,255,255,0.18)]",
    colSoft: "bg-slate-900/20",
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
      <p className="m-0 text-sm leading-[1.5] text-slate-300">
        {feature.strongPrefix ? (
          <>
            <strong className="font-semibold text-white">{feature.strongPrefix}</strong>{" "}
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
      className={`relative flex h-full flex-col justify-between rounded-[1.75rem] border border-slate-800 bg-slate-900/30 p-8 shadow-xl backdrop-blur-xl transition-all duration-300 group-hover:scale-[0.98] group-hover:opacity-70 hover:!z-30 hover:!scale-105 hover:!opacity-100 md:p-10 ${a.hoverBorder} ${a.hoverGlow}`}
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
          <div className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-500">
            <span className="line-through">{plan.originalPriceLabel}</span>
            <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-bold tracking-wider text-emerald-400">
              50% OFF
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="mr-1 text-xl font-bold tracking-wide text-slate-200">
              {plan.installmentPrefix}
            </span>
            <span className={`text-xl font-medium ${a.currency}`}>R$</span>
            <span className="text-5xl font-extrabold tracking-tight text-white">
              {plan.installmentValue}
            </span>
          </div>
          <p className={`mt-2 text-left text-xs font-bold tracking-wide sm:text-sm ${a.total}`}>
            {plan.campaignTotalLabel}
          </p>
        </div>

        <ul className="space-y-4 border-t border-slate-800/60 pt-6">
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
              ? "border-slate-700/60 bg-[#131C2D]"
              : "border-red-900/40 bg-[#2A151C]"
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
              plan.restrictionTone === "safe" ? "text-slate-300" : "text-red-400"
            }`}
          >
            {plan.restriction}
          </span>
        </div>

        <MarketingReserveButton
          planId={plan.id}
          className={`w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-4 text-center text-sm font-semibold text-white shadow-md transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-600 ${
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
        <span className="text-xs font-normal text-slate-400">{value}</span>
      ) : (
        <span
          className={`text-xs ${
            accent === "cyan"
              ? "font-semibold text-cyan-400"
              : accent === "purple"
                ? "font-semibold text-purple-400"
                : "font-normal text-slate-300"
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
      <div className="relative z-50 border-b border-cyan-500/30 bg-gradient-to-r from-blue-900/50 via-cyan-900/50 to-blue-900/50 px-4 py-3 text-center backdrop-blur-sm">
        <p className="text-xs font-medium text-slate-200 md:text-sm">
          Planos com <span className="font-bold text-white">vagas limitadas</span> por Lote e preço
          promocional com <span className="font-bold text-cyan-400">50% off</span>.
        </p>
        <span className="sr-only">{pricingUrgencyBanner}</span>
      </div>

      <MarketingSection
        eyebrow={pricingIntro.eyebrow}
        title={pricingIntro.title}
        titleAs="h1"
        lead={pricingIntro.body}
        className="!border-t-0"
      >
        <div className="group mx-auto grid max-w-6xl grid-cols-1 items-stretch gap-8 lg:grid-cols-3">
          {pricingPlans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      </MarketingSection>

      <div className="mx-auto max-w-xl px-4 pb-8 sm:px-6">
        <Link
          href={pricingComplianceCta.href}
          className="group flex w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-emerald-500 bg-gradient-to-b from-[#05131A] to-[#040D14] px-6 py-4 text-center shadow-[0_0_30px_rgba(16,185,129,0.15)] transition hover:border-emerald-400 hover:from-[#071B26] hover:to-[#05121D]"
        >
          <span className="flex items-center justify-center gap-2 text-base font-extrabold uppercase tracking-wider text-emerald-500 sm:text-lg">
            <IconShieldCheck size={20} />
            {pricingComplianceCta.title}
          </span>
          <span className="mt-1 text-xs font-medium tracking-wide text-sky-500 group-hover:underline sm:text-sm">
            {pricingComplianceCta.subtitle}
          </span>
        </Link>
      </div>

      <MarketingSection>
        <div className="rounded-[2rem] border border-slate-800/80 bg-[#0B101A] p-8 shadow-2xl md:p-12">
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

          <h2 className="mb-4 text-2xl font-bold leading-tight tracking-tight text-white md:text-3xl">
            <TitleAccent
              lead={pricingRestriction.titleLead}
              accent={pricingRestriction.titleAccent}
              tail={pricingRestriction.titleTail}
            />
          </h2>
          <p className="mb-8 max-w-4xl text-sm leading-relaxed text-slate-400 md:text-base">
            {pricingRestriction.body}
          </p>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {pricingRestriction.lots.map((lot) => (
              <div
                key={lot.number}
                className={`relative flex flex-col justify-between overflow-hidden rounded-2xl border p-6 ${
                  lot.tone === "active"
                    ? "border-cyan-500/60 bg-gradient-to-br from-[#131C2D] to-[#0A1628]"
                    : "border-slate-800/80 bg-[#0F1623]"
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
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {lot.number}
                    </div>
                    <h3 className="text-base font-bold text-white">{lot.title}</h3>
                  </div>
                  <p className="mb-4 text-sm leading-relaxed text-slate-300">{lot.body}</p>
                </div>
                <p
                  className={`mt-2 border-t pt-2.5 text-[11px] font-medium leading-tight ${
                    lot.tone === "active"
                      ? "border-cyan-500/20 text-cyan-500/90"
                      : "border-slate-800 text-slate-500"
                  }`}
                >
                  {lot.footnote}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-8 grid grid-cols-1 gap-8 border-t border-slate-800/60 pt-8 md:grid-cols-3">
            {pricingRestriction.footnotes.map((note) => (
              <div key={note.title}>
                <h4 className="mb-2 text-xs font-bold text-white">{note.title}</h4>
                <p className="text-[11px] leading-relaxed text-slate-500">{note.body}</p>
              </div>
            ))}
          </div>
        </div>
      </MarketingSection>

      <MarketingSection title={pricingComparison.title} lead={pricingComparison.lead}>
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/20 shadow-2xl backdrop-blur-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/80 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                  <th className="w-2/5 px-6 py-5">Serviço / Funcionalidade</th>
                  <th className="w-1/5 bg-slate-900/30 px-4 py-5 text-center text-white">
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
              <tbody className="divide-y divide-slate-800/40 text-xs text-slate-300 md:text-sm">
                {pricingComparison.rows.map((row) => (
                  <Fragment key={row.label}>
                    {row.section ? (
                      <tr className="bg-slate-950/50 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        <td colSpan={4} className="px-6 py-3 text-cyan-500">
                          {row.section}
                        </td>
                      </tr>
                    ) : null}
                    <tr className="transition-colors hover:bg-slate-800/20">
                      <td className="px-6 py-3.5 font-medium text-slate-200">{row.label}</td>
                      <ComparisonCell value={row.values[0]} accent="slate" />
                      <ComparisonCell value={row.values[1]} accent="cyan" />
                      <ComparisonCell value={row.values[2]} accent="purple" />
                    </tr>
                  </Fragment>
                ))}
                <tr className="border-t-2 border-slate-800 bg-slate-950/90">
                  <td className="px-6 py-6 text-xs font-bold text-white md:text-sm">
                    Concluir reserva VIP no respectivo plano:
                  </td>
                  {pricingPlans.map((plan) => (
                    <td
                      key={`cta-${plan.id}`}
                      className={`px-4 py-6 text-center ${ACCENT[plan.accent].colSoft}`}
                    >
                      <MarketingReserveButton
                        planId={plan.id}
                        className={`block w-full rounded-xl border px-2 py-3.5 text-xs font-semibold text-white shadow transition ${
                          plan.id === "avancado"
                            ? "border-transparent bg-gradient-to-r from-cyan-500 to-blue-600 shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:from-cyan-400 hover:to-blue-500"
                            : plan.id === "elite"
                              ? "border-purple-500/30 bg-slate-800 hover:bg-purple-900/60"
                              : "border-slate-700 bg-slate-800 hover:bg-slate-700"
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

        <p className="mt-10 text-center text-sm font-semibold tracking-wide text-slate-500">
          {pricingFooterNote}
        </p>
      </MarketingSection>

      <MarketingCtaBand />
    </>
  );
}
