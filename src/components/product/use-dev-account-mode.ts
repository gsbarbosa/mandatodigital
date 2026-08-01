"use client";

import { useCallback, useEffect, useState } from "react";

import {
  isDevAccountModeEmail,
  isForcePremiumAccountEmail,
  readDevAccountModeFromDocumentCookie,
  type DevAccountMode,
} from "@/lib/dev-account-mode";

export function useDevAccountMode(sessionEmail: string | null | undefined) {
  const allowed = isDevAccountModeEmail(sessionEmail);
  const forcedPremium = isForcePremiumAccountEmail(sessionEmail);
  const [mode, setMode] = useState<DevAccountMode>(forcedPremium ? "premium" : "guest");
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (forcedPremium) {
      setMode("premium");
      setReady(true);
      return;
    }

    if (!allowed) {
      setMode("guest");
      setReady(true);
      return;
    }

    setMode(readDevAccountModeFromDocumentCookie());

    try {
      const response = await fetch("/api/dev/account-mode", { credentials: "same-origin" });
      const payload = (await response.json().catch(() => ({}))) as {
        mode?: DevAccountMode;
      };
      if (response.ok && payload.mode) {
        setMode(payload.mode === "premium" ? "premium" : "guest");
      }
    } catch {
      // mantém cookie local
    } finally {
      setReady(true);
    }
  }, [allowed, forcedPremium]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    allowed,
    forcedPremium,
    mode,
    ready,
    isPremium: forcedPremium || (allowed && mode === "premium"),
    isGuest: !forcedPremium && (!allowed || mode === "guest"),
    refresh,
  };
}
