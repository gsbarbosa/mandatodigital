import type { Route } from "next";
import Link from "next/link";
import type { ComponentType, ReactNode, SVGProps } from "react";

import {
  AGENT_ICONS,
  IconBadge,
  IconBook,
  IconChessKnight,
  IconClapper,
  IconClock,
  IconFeed,
  IconFileCheck,
  IconFlame,
  IconGavel,
  IconGlobe,
  IconInbox,
  IconLayers,
  IconLink,
  IconList,
  IconOutbox,
  IconPersona,
  IconPodium,
  IconScale,
  IconShareNodes,
  IconShieldCheck,
  IconTag,
  IconUserCog,
  IconUsersFocus,
  IconVideo,
  MarketingIconBadge,
} from "@/components/marketing/icons";
import type {
  EcosystemAgent,
  EcosystemIoIcon,
  EcosystemIoItem,
} from "@/lib/marketing/ecossistema-content";
import { AGENT_ACCENT_CLASS } from "@/lib/marketing/shared";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const IO_ICONS: Record<EcosystemIoIcon, ComponentType<IconProps>> = {
  globe: IconGlobe,
  usersFocus: IconUsersFocus,
  tag: IconTag,
  flame: IconFlame,
  chess: IconChessKnight,
  podium: IconPodium,
  video: IconVideo,
  userCog: IconUserCog,
  book: IconBook,
  shield: IconShieldCheck,
  scale: IconScale,
  persona: IconPersona,
  list: IconList,
  layers: IconLayers,
  link: IconLink,
  badge: IconBadge,
  clapper: IconClapper,
  file: IconFileCheck,
  gavel: IconGavel,
  feed: IconFeed,
  clock: IconClock,
  share: IconShareNodes,
};

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

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <IoGroup
          title="O que recebe (Inputs)"
          items={agent.inputs}
          iconClassName={accent.text}
          headerIcon={
            <MarketingIconBadge className="border-slate-700 bg-slate-950/60 text-slate-300 !h-8 !w-8">
              <IconInbox size={16} />
            </MarketingIconBadge>
          }
        />
        <IoGroup
          title="Entregas (Outputs)"
          items={agent.outputs}
          iconClassName={accent.text}
          headerIcon={
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
  iconClassName,
  headerIcon,
}: {
  title: string;
  items: EcosystemIoItem[];
  iconClassName: string;
  headerIcon: ReactNode;
}) {
  return (
    <div>
      <div className="mb-5 flex items-center gap-2.5 border-b border-slate-800/80 pb-3">
        {headerIcon}
        <h3 className="m-0 text-xs font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </h3>
      </div>
      <ul className="m-0 list-none space-y-4 p-0">
        {items.map((item) => {
          const ItemIcon = IO_ICONS[item.icon];
          return (
            <li key={item.text} className="grid grid-cols-[20px_minmax(0,1fr)] gap-x-3">
              {/*
                text-sm (14px) × leading 1.5 = 21px na 1ª linha.
                Ícone 18px + mt 1.5px ≈ centro óptico da 1ª linha.
              */}
              <ItemIcon
                size={18}
                className={`mt-[1.5px] block ${iconClassName}`}
                aria-hidden
              />
              <p className="m-0 text-sm leading-[1.5] text-slate-300">{item.text}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
