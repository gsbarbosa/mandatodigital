import {
  accountTierFromDevMode,
  DEV_ACCOUNT_MODE_COOKIE,
  isDevAccountModeEmail,
  isForcePremiumAccountEmail,
  parseDevAccountMode,
} from "@/lib/dev-account-mode";
import {
  getEntitlements,
  resolveAccountTierFromBilling,
  type AccountEntitlements,
  type AccountTier,
} from "@/lib/account-tier";
import { getSessionUser } from "@/lib/auth/session";
import { getUserRegistrationForOwner } from "@/lib/user-registration-storage";
import { cookies } from "next/headers";

export type AccountTierResolution = {
  tier: AccountTier;
  entitlements: AccountEntitlements;
  source: "dev-cookie" | "billing" | "anonymous";
  billingStatus: string | null;
  planId: string | null;
};

export async function resolveSessionAccountTier(
  email?: string | null,
): Promise<AccountTierResolution> {
  const session = await getSessionUser().catch(() => null);
  const resolvedEmail = email ?? session?.email ?? null;

  if (isDevAccountModeEmail(resolvedEmail)) {
    const cookieStore = await cookies();
    const raw = cookieStore.get(DEV_ACCOUNT_MODE_COOKIE)?.value;
    const mode = raw
      ? parseDevAccountMode(raw)
      : isForcePremiumAccountEmail(resolvedEmail)
        ? "elite"
        : "guest";
    const tier = accountTierFromDevMode(mode);
    return {
      tier,
      entitlements: getEntitlements(tier),
      source: "dev-cookie",
      billingStatus: null,
      planId: tier === "trial" ? null : tier,
    };
  }

  try {
    const ownerId = session?.id;
    if (!ownerId) {
      return {
        tier: "trial",
        entitlements: getEntitlements("trial"),
        source: "anonymous",
        billingStatus: null,
        planId: null,
      };
    }
    const registration = await getUserRegistrationForOwner(ownerId);
    const tier = resolveAccountTierFromBilling({
      billingStatus: registration?.billingStatus,
      planId: registration?.planId,
    });
    return {
      tier,
      entitlements: getEntitlements(tier),
      source: "billing",
      billingStatus: registration?.billingStatus ?? null,
      planId: registration?.planId || null,
    };
  } catch {
    return {
      tier: "trial",
      entitlements: getEntitlements("trial"),
      source: "anonymous",
      billingStatus: null,
      planId: null,
    };
  }
}
