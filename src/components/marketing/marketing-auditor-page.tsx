import type { ComponentType, SVGProps } from "react";

import {
  IconArrowRight,
  IconCheck,
  IconFileCheck,
  IconGlobe,
  IconLink,
  IconSparkles,
} from "@/components/marketing/icons";
import {
  AgentDetailClosing,
  AgentDetailHero,
  AgentDetailSection,
} from "@/components/marketing/agent-detail-shell";
import { auditorDetail } from "@/lib/marketing/auditor-detail-content";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const VERIFICATION_ICONS: Record<"globe" | "sparkles" | "fileCheck", ComponentType<IconProps>> = {
  globe: IconGlobe,
  sparkles: IconSparkles,
  fileCheck: IconFileCheck,
};

export function MarketingAuditorPage() {
  const { report, verification } = auditorDetail;

  return (
    <>
      <AgentDetailHero
        accent="auditor"
        badge={auditorDetail.badge}
        titleLead={auditorDetail.titleLead}
        titleAccent={auditorDetail.titleAccent}
        metrics={auditorDetail.metrics}
        stories={auditorDetail.stories}
      />

      <AgentDetailSection title={report.title} lead={report.lead} accent="auditor">
        <div
          className="overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-900/50"
          aria-hidden
        >
          <div className="overflow-x-auto">
            <table className="min-w-[780px] w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800/80 text-[11px] uppercase tracking-wider text-slate-500">
                  {report.columns.map((column) => (
                    <th
                      key={column}
                      className="whitespace-nowrap px-4 py-3 font-semibold first:pl-5 last:pr-5"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => {
                  const rejected = row.status === "Reprovado";
                  return (
                    <tr
                      key={row.post}
                      className={`border-b border-slate-800/60 last:border-b-0 ${
                        rejected ? "bg-rose-500/5" : ""
                      }`}
                    >
                      <td
                        className={`px-4 py-3.5 text-slate-200 first:pl-5 ${
                          rejected ? "border-l-2 border-l-rose-500" : ""
                        }`}
                      >
                        {row.post}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                            row.sourceTone === "ok"
                              ? "bg-emerald-500/15 text-emerald-300"
                              : "bg-rose-500/15 text-rose-300"
                          }`}
                        >
                          {row.source}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-300">{row.validator}</td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 text-sm font-medium ${
                            rejected ? "text-rose-400" : "text-emerald-400"
                          }`}
                        >
                          {rejected ? "○" : <IconCheck size={14} />}
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 last:pr-5">
                        <span className="inline-flex items-center gap-2 text-slate-400">
                          <IconLink size={14} />
                          {row.print}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </AgentDetailSection>

      <AgentDetailSection
        title={verification.title}
        titleAccent={verification.titleAccent}
        lead={verification.lead}
        wideLead
        accent="auditor"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-stretch md:gap-3">
          {verification.steps.map((step, index) => {
            const Icon = VERIFICATION_ICONS[step.icon];
            return (
              <div key={step.title} className="flex flex-1 items-stretch gap-3">
                <div className="flex-1 rounded-3xl border border-slate-800/80 bg-slate-900/50 p-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10">
                    <Icon size={20} className="text-emerald-400" />
                  </div>
                  <p className="mt-4 text-sm font-semibold text-white">{step.title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{step.body}</p>
                </div>
                {index < verification.steps.length - 1 ? (
                  <div className="hidden shrink-0 items-center text-slate-700 md:flex">
                    <IconArrowRight size={18} />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <p className="mt-6 flex items-start gap-2 text-sm text-slate-500">
          <IconCheck size={16} className="mt-0.5 shrink-0 text-emerald-400" />
          {verification.footnote}
        </p>
      </AgentDetailSection>

      <AgentDetailClosing />
    </>
  );
}
