import type { ComponentType, SVGProps } from "react";

import {
  IconBolt,
  IconInstagram,
  IconX,
} from "@/components/marketing/icons";
import {
  AgentDetailClosing,
  AgentDetailHero,
  AgentDetailSection,
} from "@/components/marketing/agent-detail-shell";
import { sentinelaDetail } from "@/lib/marketing/sentinela-detail-content";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const NETWORK_ICONS: Record<"x" | "instagram", ComponentType<IconProps>> = {
  x: IconX,
  instagram: IconInstagram,
};

const THEME_TONE: Record<"purple" | "blue", string> = {
  purple: "bg-violet-500/15 text-violet-300 ring-violet-400/25",
  blue: "bg-sky-500/15 text-sky-300 ring-sky-400/25",
};

export function MarketingSentinelaPage() {
  const { console: liveConsole } = sentinelaDetail;

  return (
    <>
      <AgentDetailHero
        accent="sentinela"
        badge={sentinelaDetail.badge}
        titleLead={sentinelaDetail.titleLead}
        titleAccent={sentinelaDetail.titleAccent}
        metrics={sentinelaDetail.metrics}
        stories={sentinelaDetail.stories}
        visual={{
          src: "/marketing/sentinela/ops.jpg",
          alt: "Console de monitoramento do Agente Sentinela",
          aspect: "video",
        }}
      />

      <AgentDetailSection title={liveConsole.title} lead={liveConsole.subtitle} accent="sentinela">
        <div
          className="overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-900/50"
          aria-hidden
        >
          <div className="overflow-x-auto">
            <table className="min-w-[920px] w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800/80 text-[11px] uppercase tracking-wider text-slate-500">
                  {liveConsole.columns.map((column) => (
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
                {liveConsole.rows.map((row) => {
                  const NetworkIcon = NETWORK_ICONS[row.network];
                  return (
                    <tr key={row.topic} className="border-b border-slate-800/60 last:border-b-0">
                      <td className="px-4 py-3.5 first:pl-5">
                        <span
                          className={`inline-flex rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${THEME_TONE[row.themeTone]}`}
                        >
                          {row.theme}
                        </span>
                      </td>
                      <td className="max-w-[220px] px-4 py-3.5 text-slate-200">{row.topic}</td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-2 text-emerald-400">
                          <NetworkIcon size={14} />
                          {row.handle}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-emerald-400">{row.score}</td>
                      <td className="px-4 py-3.5 tabular-nums text-slate-300">{row.likes}</td>
                      <td className="px-4 py-3.5 tabular-nums text-slate-300">{row.comments}</td>
                      <td className="px-4 py-3.5 tabular-nums text-slate-300">{row.shares}</td>
                      <td className="px-4 py-3.5 last:pr-5">
                        <span className="inline-flex min-w-[8.5rem] items-center justify-between rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-xs text-slate-300">
                          {row.action}
                          <span aria-hidden className="text-slate-500">
                            ▾
                          </span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-800/80 bg-slate-950/40 px-4 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
            <div className="flex shrink-0 items-center gap-2 text-sm font-medium text-sky-300">
              <IconBolt size={16} aria-hidden />
              {liveConsole.newPautaLabel}
            </div>
            <div className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-sm text-slate-500">
              {liveConsole.newPautaPlaceholder}
            </div>
            <div className="flex flex-wrap gap-2">
              {liveConsole.formatOptions.map((option, index) => (
                <span
                  key={option}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                    index === 0
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                      : "border-slate-700 bg-slate-900/80 text-slate-400"
                  }`}
                >
                  {option}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-center">
          <span className="inline-flex cursor-default rounded-2xl bg-sky-600 px-8 py-3 text-sm font-bold text-white shadow-[0_12px_28px_rgba(2,132,199,0.28)]">
            {liveConsole.generateLabel}
          </span>
        </div>
      </AgentDetailSection>

      <AgentDetailClosing />
    </>
  );
}
