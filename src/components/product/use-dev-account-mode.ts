"use client";

import { useEffect, useState } from "react";

import { useAccountTier } from "@/components/product/use-account-tier";
import {
  isDevAccountModeEmail,
  isForcePremiumAccountEmail,
  type DevAccountMode,
} from "@/lib/dev-account-mode";

export function useDevAccountMode(sessionEmail: string | null | undefined) {
  const allowed = isDevAccountModeEmail(sessionEmail);
  const forcedPremium = isForcePremiumAccountEmail(sessionEmail);
  const account = useAccountTier();
  const [mode, setMode] = useState<DevAccountMode>("guest");

  useEffect(() => {
    setMode(account.tier === "trial" ? "guest" : account.tier);
  }, [account.tier]);

  return {
    allowed,
    forcedPremium,
    mode,
    ready: account.ready,
    isPremium: account.isPaid,
    isGuest: account.isTrial,
    refresh: account.refresh,
  };
}
