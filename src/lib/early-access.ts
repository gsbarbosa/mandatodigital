"use client";

import { useCallback, useEffect, useState } from "react";

import type {
  EarlyAccessPlanId,
  EarlyAccessReservation,
  EarlyAccessState,
} from "@/lib/early-access-types";

export type {
  EarlyAccessPlanId,
  EarlyAccessReservation,
  EarlyAccessState,
} from "@/lib/early-access-types";

/**
 * Camada de UI de “acesso antecipado” (urgência, planos, CNPJ no browser).
 * O cadastro real vive em Firestore (`userRegistrations`) via `/api/user/registration`.
 */

const STORAGE_KEY = "mandato-digital-early-access-v1";
const CHANGE_EVENT = "mandato-early-access-change";

const emptyState: EarlyAccessState = {
  reservation: null,
  cnpj: "",
  cnpjSignedAt: "",
  reservationPopupSeen: false,
};

export function readEarlyAccessState(): EarlyAccessState {
  if (typeof window === "undefined") {
    return emptyState;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return emptyState;
    }
    const parsed = JSON.parse(raw) as Partial<EarlyAccessState>;
    const reservation = parsed.reservation
      ? {
          ...parsed.reservation,
          address:
            typeof parsed.reservation.address === "string"
              ? parsed.reservation.address
              : "",
        }
      : null;
    return {
      reservation,
      cnpj: typeof parsed.cnpj === "string" ? parsed.cnpj : "",
      cnpjSignedAt: typeof parsed.cnpjSignedAt === "string" ? parsed.cnpjSignedAt : "",
      reservationPopupSeen: Boolean(parsed.reservationPopupSeen),
    };
  } catch {
    return emptyState;
  }
}

export function writeEarlyAccessState(update: Partial<EarlyAccessState>) {
  if (typeof window === "undefined") {
    return;
  }
  const next = { ...readEarlyAccessState(), ...update };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function clearEarlyAccessBrowserState() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
  window.sessionStorage.removeItem(PLAN_INTENT_STORAGE_KEY);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export const PLAN_INTENT_STORAGE_KEY = "mandato-early-access-plan-intent";

export function parseEarlyAccessPlanId(
  value: string | null | undefined,
): EarlyAccessPlanId | null {
  if (value === "essencial" || value === "avancado" || value === "elite") {
    return value;
  }
  return null;
}

/**
 * Lê plano escolhido (URL ?plan= ou sessionStorage).
 * Retorna null se o usuário ainda não escolheu (ex.: veio só de "Entrar").
 */
export function readPlanIntent(searchPlan?: string | null): EarlyAccessPlanId | null {
  const fromQuery = parseEarlyAccessPlanId(searchPlan ?? null);
  if (fromQuery) {
    return fromQuery;
  }
  if (typeof window === "undefined") {
    return null;
  }
  return parseEarlyAccessPlanId(window.sessionStorage.getItem(PLAN_INTENT_STORAGE_KEY));
}

export function writePlanIntent(planId: EarlyAccessPlanId) {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.setItem(PLAN_INTENT_STORAGE_KEY, planId);
}

export function clearPlanIntent() {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.removeItem(PLAN_INTENT_STORAGE_KEY);
}

export function useEarlyAccess(): [EarlyAccessState, (update: Partial<EarlyAccessState>) => void] {
  const [state, setState] = useState<EarlyAccessState>(emptyState);

  useEffect(() => {
    const sync = () => setState(readEarlyAccessState());
    sync();
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const update = useCallback((patch: Partial<EarlyAccessState>) => {
    writeEarlyAccessState(patch);
  }, []);

  return [state, update];
}

export const earlyAccessPlans: Array<{
  id: EarlyAccessPlanId;
  name: string;
  priceLabel: string;
  originalPriceLabel: string;
  accent: "slate" | "cyan" | "purple";
  features: string[];
  restriction: string;
}> = [
  {
    id: "essencial",
    name: "Essencial",
    priceLabel: "R$ 499",
    originalPriceLabel: "De R$ 997",
    accent: "slate",
    features: [
      "Monitoramento ilimitado de redes sociais, portais, sites e blogs",
      "Produção de 5 avatares/mês (2 digitais e 3 caricaturas/3D), vídeos de até 1 minuto",
      "Checagem de fatos básica.",
    ],
    restriction: "Sem restrição de vagas por Partido",
  },
  {
    id: "avancado",
    name: "Avançado",
    priceLabel: "R$ 1.998",
    originalPriceLabel: "De R$ 3.997",
    accent: "cyan",
    features: [
      "Todos os benefícios do plano Essencial.",
      "Produção de 22 avatares/mês (livre escolha) com renderização avançada de Gêmeo Digital, vídeos de até 90 segundos.",
      "Compliance Legal Pack Institucional: provas geradas e protocoladas para o seu corpo jurídico.",
    ],
    restriction: "Máximo 03 vagas por partido/UF",
  },
  {
    id: "elite",
    name: "Elite",
    priceLabel: "R$ 4.998",
    originalPriceLabel: "De R$ 9.997",
    accent: "purple",
    features: [
      "Todos os benefícios do plano Avançado.",
      "Produção de 60 avatares/mês (livre escolha) com renderização avançada de Gêmeo Digital, vídeos de até 3 minutos.",
      "Publicação simultânea e adaptada em 07 redes: Instagram, TikTok, Twitter/X, YouTube, Threads e LinkedIn.",
    ],
    restriction: "Máximo 03 vagas por partido/UF",
  },
];
