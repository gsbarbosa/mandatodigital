/**
 * Conta trial (guest) vs um dos 3 planos pagos.
 * billingStatus=active escolhe Essencial / Avançado / Elite.
 */

import {
  devModeFromAccountTier,
  isPaidDevAccountMode,
  type DevAccountMode,
} from "@/lib/dev-account-mode";
import { resolveSessionAccountTier } from "@/lib/account-tier.server";

export async function resolveDevAccountMode(
  email: string | null | undefined,
): Promise<DevAccountMode> {
  const resolved = await resolveSessionAccountTier(email);
  return devModeFromAccountTier(resolved.tier);
}

export async function isPremiumAccountMode(email: string | null | undefined) {
  const mode = await resolveDevAccountMode(email);
  return isPaidDevAccountMode(mode);
}
