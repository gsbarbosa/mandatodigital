"use client";

import { useCallback, useEffect, useState } from "react";

import {
  isDevAccountModeEmail,
  readDevAccountModeFromDocumentCookie,
  type DevAccountMode,
} from "@/lib/dev-account-mode";

export function useDevAccountMode(sessionEmail: string | null | undefined) {
  const allowed = isDevAccountModeEmail(sessionEmail);
  const [mode, setMode] = useState<DevAccountMode>("guest");
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
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
  }, [allowed]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    allowed,
    mode,
    ready,
    isPremium: allowed && mode === "premium",
    isGuest: !allowed || mode === "guest",
    refresh,
  };
}
