"use client";

import { useCallback, useEffect, useState } from "react";

import {
  getEntitlements,
  type AccountEntitlements,
  type AccountTier,
} from "@/lib/account-tier";

const TRIAL = getEntitlements("trial");

export function useAccountTier() {
  const [tier, setTier] = useState<AccountTier>("trial");
  const [entitlements, setEntitlements] = useState<AccountEntitlements>(TRIAL);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/account/tier", { credentials: "same-origin" });
      const payload = (await response.json().catch(() => ({}))) as {
        tier?: AccountTier;
        entitlements?: AccountEntitlements;
      };
      if (response.ok && payload.tier && payload.entitlements) {
        setTier(payload.tier);
        setEntitlements(payload.entitlements);
      }
    } catch {
      // mantém trial até conseguir ler o servidor
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onRefresh = () => {
      void refresh();
    };
    window.addEventListener("focus", onRefresh);
    window.addEventListener("mandato-account-tier-changed", onRefresh);
    return () => {
      window.removeEventListener("focus", onRefresh);
      window.removeEventListener("mandato-account-tier-changed", onRefresh);
    };
  }, [refresh]);

  return {
    tier,
    entitlements,
    ready,
    isPaid: entitlements.isPaid,
    isTrial: tier === "trial",
    isPremium: entitlements.isPaid,
    refresh,
  };
}
