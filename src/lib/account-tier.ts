import type { BillingStatus } from "@/lib/billing/plan-pricing";
import type { EarlyAccessPlanId } from "@/lib/early-access-types";

/** trial + 3 planos pagos. Não existe mais um “premium” genérico. */
export type AccountTier = "trial" | "essencial" | "avancado" | "elite";

export type AccountEntitlements = {
  tier: AccountTier;
  label: string;
  isPaid: boolean;
  /** Aplica cotas de convidado (temas, vídeos/avatar, créditos de radar). */
  guestQuotas: boolean;
  maxScriptWords: number;
  maxVideoSecondsLabel: string;
  /** Teto mensal de avatares/vídeos pagos. null = usa cota guest, não mensal. */
  avatarsPerMonth: number | null;
  advancedDigitalTwinRender: boolean;
  complianceLegalPack: boolean;
  multiNetworkPublish: boolean;
  maxPublishNetworks: number;
  expandedSocialProfileCaps: boolean;
};

export const ACCOUNT_TIER_LABELS: Record<AccountTier, string> = {
  trial: "Trial",
  essencial: "Essencial",
  avancado: "Avançado",
  elite: "Elite",
};

export const ACCOUNT_ENTITLEMENTS: Record<AccountTier, AccountEntitlements> = {
  trial: {
    tier: "trial",
    label: ACCOUNT_TIER_LABELS.trial,
    isPaid: false,
    guestQuotas: true,
    maxScriptWords: 140,
    maxVideoSecondsLabel: "até 1 minuto",
    avatarsPerMonth: null,
    advancedDigitalTwinRender: false,
    complianceLegalPack: false,
    multiNetworkPublish: false,
    maxPublishNetworks: 0,
    expandedSocialProfileCaps: false,
  },
  essencial: {
    tier: "essencial",
    label: ACCOUNT_TIER_LABELS.essencial,
    isPaid: true,
    guestQuotas: false,
    maxScriptWords: 140,
    maxVideoSecondsLabel: "até 1 minuto",
    avatarsPerMonth: 5,
    advancedDigitalTwinRender: false,
    complianceLegalPack: false,
    multiNetworkPublish: true,
    maxPublishNetworks: 7,
    expandedSocialProfileCaps: true,
  },
  avancado: {
    tier: "avancado",
    label: ACCOUNT_TIER_LABELS.avancado,
    isPaid: true,
    guestQuotas: false,
    maxScriptWords: 210,
    maxVideoSecondsLabel: "até 90 segundos",
    avatarsPerMonth: 22,
    advancedDigitalTwinRender: true,
    complianceLegalPack: true,
    multiNetworkPublish: true,
    maxPublishNetworks: 7,
    expandedSocialProfileCaps: true,
  },
  elite: {
    tier: "elite",
    label: ACCOUNT_TIER_LABELS.elite,
    isPaid: true,
    guestQuotas: false,
    maxScriptWords: 420,
    maxVideoSecondsLabel: "até 3 minutos",
    avatarsPerMonth: 60,
    advancedDigitalTwinRender: true,
    complianceLegalPack: true,
    multiNetworkPublish: true,
    maxPublishNetworks: 7,
    expandedSocialProfileCaps: true,
  },
};

export function parsePaidPlanId(value: string | null | undefined): EarlyAccessPlanId | null {
  if (value === "essencial" || value === "avancado" || value === "elite") {
    return value;
  }
  return null;
}

/**
 * Trial enquanto a cobrança não estiver ativa.
 * Plano pago só vale com billingStatus=active.
 * past_due (inadimplente, ex.: última parcela em atraso) volta para trial.
 */
export function resolveAccountTierFromBilling(input: {
  billingStatus?: BillingStatus | string | null;
  planId?: string | null;
}): AccountTier {
  if (input.billingStatus === "active") {
    return parsePaidPlanId(input.planId) ?? "essencial";
  }
  return "trial";
}

export function getEntitlements(tier: AccountTier): AccountEntitlements {
  return ACCOUNT_ENTITLEMENTS[tier];
}

export function isPaidAccountTier(tier: AccountTier): boolean {
  return ACCOUNT_ENTITLEMENTS[tier].isPaid;
}

/**
 * Publicador é exclusivo de assinante: qualquer plano pago entra, trial não.
 * Inadimplente cai em trial via `resolveAccountTierFromBilling` e perde o acesso
 * junto — não há exceção só para o Publicador.
 */
export function canUsePublisher(tier: AccountTier): boolean {
  return ACCOUNT_ENTITLEMENTS[tier].multiNetworkPublish;
}
