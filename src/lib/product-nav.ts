/**
 * Navegação operação-first (v2). Flag pública — usada no shell client-side.
 * Default off: produção mantém pipeline de 5 agentes até smoke test.
 */

import type { ConfigSectionId } from "@/lib/config-setup-status";
import {
  configNavSections,
  configSectionHref,
  parseConfigSectionFromPathname,
  resolveConfigSectionLabel,
} from "@/lib/config-setup-status";

const TRUTHY = new Set(["1", "true", "yes", "on"]);

function readPublicFlag(name: string) {
  const value = process.env[name]?.trim().toLowerCase();
  return value ? TRUTHY.has(value) : false;
}

export const PRODUCT_NAV_V2_FLAG = "NEXT_PUBLIC_PRODUCT_NAV_V2" as const;

export const ONBOARDING_V2_STORAGE_KEY = "mandato_onboarding_v2_completed";

export function isProductNavV2Enabled() {
  return readPublicFlag(PRODUCT_NAV_V2_FLAG);
}

export function resolveDefaultAppPath() {
  return isProductNavV2Enabled() ? "/inicio" : "/curador";
}

export function isOnboardingV2Completed() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(ONBOARDING_V2_STORAGE_KEY) === "1";
}

export function markOnboardingV2Completed() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ONBOARDING_V2_STORAGE_KEY, "1");
}

export type ProductNavV2Section = "operacao" | "configuracoes";

export type ProductNavV2Item = {
  id: string;
  label: string;
  href: string;
  section: ProductNavV2Section;
};

export type ProductNavV2ConfigItem = {
  id: ConfigSectionId;
  label: string;
  href: string;
  section: "configuracoes";
  oneTime?: boolean;
};

export const productNavV2OperacaoItems: ProductNavV2Item[] = [
  { id: "inicio", label: "Início", href: "/inicio", section: "operacao" },
  { id: "criativo", label: "Meus criativos", href: "/criativo", section: "operacao" },
];

export const productNavV2ConfigItems: ProductNavV2ConfigItem[] = configNavSections.map((section) => ({
  id: section.id,
  label: section.label,
  href: configSectionHref(section.id),
  section: "configuracoes" as const,
  oneTime: section.oneTime,
}));

/** @deprecated Use productNavV2OperacaoItems + productNavV2ConfigItems */
export const productNavV2Items: ProductNavV2Item[] = [
  ...productNavV2OperacaoItems,
  ...productNavV2ConfigItems,
];

export function isProductNavV2FocusPath(pathname: string) {
  return (
    pathname === "/inicio" ||
    pathname.startsWith("/inicio/") ||
    pathname === "/configuracoes" ||
    pathname.startsWith("/configuracoes/") ||
    pathname === "/onboarding" ||
    pathname.startsWith("/onboarding/") ||
    pathname === "/sentinela" ||
    pathname.startsWith("/sentinela/") ||
    pathname === "/curador" ||
    pathname.startsWith("/curador/") ||
    pathname === "/curador-v1" ||
    pathname.startsWith("/curador-v1/") ||
    pathname === "/curador-v2" ||
    pathname.startsWith("/curador-v2/") ||
    pathname === "/criativo" ||
    pathname.startsWith("/criativo/") ||
    pathname === "/auditor" ||
    pathname.startsWith("/auditor/") ||
    pathname === "/distribuidor" ||
    pathname.startsWith("/distribuidor/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/")
  );
}

export function resolveProductNavV2ActiveId(pathname: string, configTab?: ConfigSectionId | null) {
  if (pathname === "/inicio" || pathname.startsWith("/inicio/")) {
    return "inicio";
  }
  if (pathname === "/configuracoes" || pathname.startsWith("/configuracoes/")) {
    return parseConfigSectionFromPathname(pathname) ?? configTab ?? "perfil";
  }
  if (pathname === "/criativo" || pathname.startsWith("/criativo/")) {
    return "criativo";
  }
  if (
    pathname === "/sentinela" ||
    pathname.startsWith("/sentinela/") ||
    pathname === "/curador" ||
    pathname.startsWith("/curador/") ||
    pathname === "/distribuidor" ||
    pathname.startsWith("/distribuidor/")
  ) {
    return "radar";
  }
  return "inicio";
}

export function resolveProductNavV2PageMeta(pathname: string, configTab?: ConfigSectionId | null) {
  if (pathname === "/inicio" || pathname.startsWith("/inicio/")) {
    return {
      id: "inicio",
      title: "Painel",
      subtitle: "Sinais de pauta, criativos e atalhos do dia",
    };
  }
  if (pathname === "/onboarding" || pathname.startsWith("/onboarding/")) {
    return {
      id: "onboarding",
      title: "Configuração inicial",
      subtitle: "Perfil, radar e avatar em poucos passos",
    };
  }
  if (pathname === "/configuracoes" || pathname.startsWith("/configuracoes/")) {
    const section = configTab ?? "perfil";
    return {
      id: "configuracoes",
      title: resolveConfigSectionLabel(section),
      subtitle:
        section === "perfil"
          ? "Identidade pública e tom de voz"
          : section === "avatar"
            ? "Voz, foto e gêmeo digital"
            : section === "radar"
              ? "Temas monitorados pelo Sentinela"
              : section === "fontes"
                ? "Portais e blogs consultados"
                : "Publicação e distribuição",
    };
  }
  if (pathname === "/criativo/novo" || pathname.startsWith("/criativo/novo")) {
    return {
      id: "criativo",
      title: "Novo criativo",
      subtitle: "Roteiro, validação e produção de vídeo",
    };
  }
  if (pathname === "/criativo" || pathname.startsWith("/criativo/")) {
    return {
      id: "criativo",
      title: "Meus criativos",
      subtitle:
        "Histórico de roteiros e vídeos. Para peça nova, use o Início — sinais de pauta e Novo criativo.",
    };
  }
  if (pathname === "/sentinela" || pathname.startsWith("/sentinela/")) {
    return {
      id: "sentinela",
      title: "Sentinela",
      subtitle: "Radar e sinais (rota clássica)",
    };
  }
  if (pathname === "/curador" || pathname.startsWith("/curador/")) {
    return {
      id: "curador",
      title: "Curador",
      subtitle: "Persona e avatar (rota clássica)",
    };
  }
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return {
      id: "admin",
      title: "Administração",
      subtitle: "Integrações e chaves da plataforma",
    };
  }
  return {
    id: "app",
    title: "Mandato Digital",
    subtitle: "Comunicação política assistida por IA",
  };
}
