import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  AGENT_ICONS,
  IconInbox,
  IconOutbox,
  MarketingIconBadge,
} from "@/components/marketing/icons";
import type { EcosystemAgent } from "@/lib/marketing/ecossistema-content";
import { AGENT_ACCENT_CLASS } from "@/lib/marketing/shared";

export function AgentDetailCard({ agent }: { agent: EcosystemAgent }) {
  const accent = AGENT_ACCENT_CLASS[agent.accent];
  const AgentIcon = AGENT_ICONS[agent.accent];

  return (
    <article
      id={agent.id}
      className={`scroll-mt-28 rounded-3xl border bg-slate-900/40 p-6 sm:p-8 ${accent.border}`}
    >
      <div className="flex flex-wrap items-start gap-4">
        <MarketingIconBadge className={`${accent.soft} ${accent.text} ${accent.border} !h-12 !w-12`}>
          <AgentIcon size={24} />
        </MarketingIconBadge>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold ${accent.text}`}>
            {agent.number}. {agent.name}
          </p>
          <h2 className="mt-1 text-2xl font-bold text-white">{agent.title}</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-400 sm:text-base">
            {agent.description}
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <IoGroup
          title="Inputs"
          items={agent.inputs}
          icon={
            <MarketingIconBadge className="border-slate-700 bg-slate-950/60 text-slate-300 !h-8 !w-8">
              <IconInbox size={16} />
            </MarketingIconBadge>
          }
        />
        <IoGroup
          title="Outputs"
          items={agent.outputs}
          icon={
            <MarketingIconBadge className="border-slate-700 bg-slate-950/60 text-slate-300 !h-8 !w-8">
              <IconOutbox size={16} />
            </MarketingIconBadge>
          }
        />
      </div>

      {agent.learnMoreHref ? (
        <Link
          href={agent.learnMoreHref as Route}
          className="mt-6 inline-flex text-sm font-semibold text-emerald-400 hover:text-emerald-300"
        >
          Saiba mais →
        </Link>
      ) : null}
    </article>
  );
}

function IoGroup({
  title,
  items,
  icon,
}: {
  title: string;
  items: string[];
  icon: ReactNode;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</h3>
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item}
            className="rounded-xl border border-slate-800/80 bg-slate-950/40 px-3 py-2.5 text-sm leading-relaxed text-slate-300"
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
