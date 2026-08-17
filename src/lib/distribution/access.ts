import { NextResponse } from "next/server";

import {
  canUsePublisher,
  resolveAccountTierFromBilling,
  type AccountTier,
} from "@/lib/account-tier";
import { getSessionUser } from "@/lib/auth/session";
import { getUserRegistrationForOwner } from "@/lib/user-registration-storage";

/**
 * Publicador é recurso de assinante. O gate real é este, no servidor: a UI
 * apenas reflete o que a API responde.
 */

export const PUBLISHER_PAYWALL_MESSAGE =
  "O Publicador está disponível apenas para assinantes. Escolha um plano para publicar nas redes.";

export type PublisherAccess = {
  allowed: boolean;
  tier: AccountTier;
};

export async function resolvePublisherAccess(): Promise<PublisherAccess> {
  const session = await getSessionUser();
  if (!session?.id) {
    return { allowed: false, tier: "trial" };
  }

  const registration = await getUserRegistrationForOwner(session.id);
  const tier = resolveAccountTierFromBilling({
    billingStatus: registration?.billingStatus,
    planId: registration?.planId,
  });

  return { allowed: canUsePublisher(tier), tier };
}

/**
 * 402 (payment required) em vez de 403: a UI usa o código para abrir o upsell
 * em vez de tratar como erro de permissão.
 */
export async function assertPublisherSubscription(): Promise<NextResponse | null> {
  const access = await resolvePublisherAccess();
  if (access.allowed) {
    return null;
  }
  return NextResponse.json(
    { message: PUBLISHER_PAYWALL_MESSAGE, paywall: true, tier: access.tier },
    { status: 402 },
  );
}
