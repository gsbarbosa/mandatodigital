import Image from "next/image";

import { IconCheck, IconLink } from "@/components/marketing/icons";
import {
  AgentDetailClosing,
  AgentDetailHero,
  AgentDetailSection,
} from "@/components/marketing/agent-detail-shell";
import { auditorDetail } from "@/lib/marketing/auditor-detail-content";

export function MarketingAuditorPage() {
  const { report, approval } = auditorDetail;

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

      <AgentDetailSection title={approval.title} accent="auditor">
        <div className="grid gap-5 md:grid-cols-3">
          {approval.cards.map((card) => (
            <article
              key={card.title}
              className="flex flex-col rounded-3xl border border-slate-800/80 bg-slate-900/50 p-5"
              aria-hidden
            >
              <p className="text-sm font-semibold text-white">{card.title}</p>
              <div className="relative mt-4 aspect-video overflow-hidden rounded-2xl border border-slate-800">
                <Image
                  src={card.image}
                  alt={card.imageAlt}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
                <span className="absolute inset-0 bg-gradient-to-t from-slate-950/45 via-transparent to-transparent" />
              </div>
              <p className="mt-4 flex-1 text-sm leading-relaxed text-slate-400">{card.body}</p>
              <span className="mt-3 inline-flex w-fit rounded-md bg-slate-800/80 px-2.5 py-1 text-xs text-slate-400">
                {card.tag}
              </span>
              <div className="mt-5 space-y-2">
                <span className="flex w-full items-center justify-center rounded-xl bg-emerald-500 px-3 py-2.5 text-sm font-bold text-slate-950">
                  Aprovar Publicação
                </span>
                <span className="flex w-full items-center justify-center rounded-xl border border-slate-600 px-3 py-2.5 text-sm font-medium text-slate-300">
                  Gerar Nova Matéria
                </span>
              </div>
            </article>
          ))}
        </div>
      </AgentDetailSection>

      <AgentDetailClosing />
    </>
  );
}
