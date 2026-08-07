import type { Route } from "next";

/** CTA comercial padrão do marketing site — mesmo destino do Entrar. */
export const MARKETING_CTA_HREF = "/login" as Route;
export const MARKETING_CTA_LABEL = "Reserve sua vaga";

export const MARKETING_CLOSING = {
  title: "Saia na frente. Antes que o adversário trave a sua vaga.",
  body: "Monitoramento em tempo real, avatares personalizados com a voz do candidato e compliance total com o TSE. Para garantir a performance da plataforma as vagas são limitadas por ordem de chegada e UF.",
  ctaLabel: MARKETING_CTA_LABEL,
  ctaHref: MARKETING_CTA_HREF,
} as const;

export const MARKETING_NAV = [
  { href: "/" as Route, label: "Home" },
  { href: "/ecossistema" as Route, label: "Ecossistema" },
  { href: "/conformidade" as Route, label: "Compliance" },
  { href: "/planos" as Route, label: "Planos" },
] as const;

/** Dados institucionais do rodapé (briefing comercial). */
export const MARKETING_FOOTER = {
  siteUrl: "https://www.mandatodigital.ia.br",
  siteLabel: "www.mandatodigital.ia.br",
  razaoSocial: "EATEASY SERVIÇOS DIGITAIS LTDA",
  cnpj: "48.142.514/0001-08",
  address: "Av. Getúlio Vargas 671, sala 500, Savassi, Belo Horizonte, MG",
} as const;

export type AgentAccent = "sentinela" | "curador" | "criativo" | "auditor" | "distribuidor";

export const AGENT_ACCENT_CLASS: Record<
  AgentAccent,
  { ring: string; text: string; soft: string; border: string }
> = {
  sentinela: {
    ring: "ring-emerald-500/30",
    text: "text-emerald-400",
    soft: "bg-emerald-500/10",
    border: "border-emerald-500/25",
  },
  curador: {
    ring: "ring-blue-500/30",
    text: "text-blue-400",
    soft: "bg-blue-500/10",
    border: "border-blue-500/25",
  },
  criativo: {
    ring: "ring-purple-500/30",
    text: "text-purple-400",
    soft: "bg-purple-500/10",
    border: "border-purple-500/25",
  },
  auditor: {
    ring: "ring-rose-500/30",
    text: "text-rose-400",
    soft: "bg-rose-500/10",
    border: "border-rose-500/25",
  },
  distribuidor: {
    ring: "ring-amber-500/30",
    text: "text-amber-400",
    soft: "bg-amber-500/10",
    border: "border-amber-500/25",
  },
};
