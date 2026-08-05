"use client";

import { useCallback, useEffect, useState } from "react";

import {
  GUEST_CREDITS_EXHAUSTED_ACTION_MESSAGE,
  type GuestSentinelCredits,
} from "@/lib/guest-limits";
import { broadcastGuestSentinelCredits, onGuestSentinelCreditsUpdate } from "@/lib/guest-credits-bus";

type CreditsResponse = {
  credits?: GuestSentinelCredits | null;
};

/**
 * Créditos vitalícios do convidado (Sentinela).
 * Premium → `credits: null` → nunca exhausto.
 * Convidado com remaining <= 0 → trava ações (não a navegação).
 */
export function useGuestCreditsGate() {
  const [credits, setCredits] = useState<GuestSentinelCredits | null>(null);
  const [checked, setChecked] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/sentinel/credits", { credentials: "same-origin" });
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as CreditsResponse;
      setCredits(payload.credits ?? null);
      broadcastGuestSentinelCredits(payload.credits ?? null);
    } catch {
      // Em falha de rede, mantém liberado.
    } finally {
      setChecked(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Outra tela (ex.: monitoramento) pode zerar os créditos no meio da sessão —
  // sincroniza sem esperar um novo fetch/reload.
  useEffect(() => {
    return onGuestSentinelCreditsUpdate((updated) => {
      setCredits(updated);
      setChecked(true);
    });
  }, []);

  const exhausted = Boolean(credits && credits.remaining <= 0);

  return {
    credits,
    remaining: credits?.remaining ?? null,
    exhausted,
    checked,
    refresh,
    exhaustedMessage: GUEST_CREDITS_EXHAUSTED_ACTION_MESSAGE,
  };
}
