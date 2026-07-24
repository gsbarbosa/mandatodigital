import type { Route } from "next";

import { MARKETING_CLOSING, MARKETING_CTA_HREF, MARKETING_CTA_LABEL } from "@/lib/marketing/shared";

export const AGENT_DETAIL_BACK = {
  href: "/ecossistema" as Route,
  label: "Voltar",
} as const;

export const AGENT_DETAIL_CLOSING = {
  title: MARKETING_CLOSING.title,
  titleAccent: "adversário trave",
  body: MARKETING_CLOSING.body,
  bodyAccent: "limitadas por ordem de chegada e UF",
  ctaLabel: MARKETING_CTA_LABEL,
  ctaHref: MARKETING_CTA_HREF,
} as const;

export type AgentDetailMetric = {
  value: string;
  label: string;
};

export type AgentDetailStory = {
  title: string;
  body: string;
};
