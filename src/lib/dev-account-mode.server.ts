/**
 * Conta paga (boleto confirmado) ou sócio/e2e premium.
 * Free trial = guest (cotas); billingStatus active libera limites de plano.
 */

import { cookies } from "next/headers";

import {
  DEV_ACCOUNT_MODE_COOKIE,
  isDevAccountModeEmail,
  isForcePremiumAccountEmail,
  parseDevAccountMode,
  type DevAccountMode,
} from "@/lib/dev-account-mode";
import { getSessionUser } from "@/lib/auth/session";
import {
  getUserRegistrationForOwner,
  isBillingActive,
} from "@/lib/user-registration-storage";

export async function resolveDevAccountMode(
  email: string | null | undefined,
): Promise<DevAccountMode> {
  if (isForcePremiumAccountEmail(email)) {
    return "premium";
  }

  if (isDevAccountModeEmail(email)) {
    const cookieStore = await cookies();
    return parseDevAccountMode(cookieStore.get(DEV_ACCOUNT_MODE_COOKIE)?.value);
  }

  try {
    const session = await getSessionUser();
    if (session?.id) {
      const registration = await getUserRegistrationForOwner(session.id);
      if (isBillingActive(registration)) {
        return "premium";
      }
    }
  } catch {
    // Sem sessão/Firestore — trata como guest.
  }

  return "guest";
}

export async function isPremiumAccountMode(email: string | null | undefined) {
  return (await resolveDevAccountMode(email)) === "premium";
}
