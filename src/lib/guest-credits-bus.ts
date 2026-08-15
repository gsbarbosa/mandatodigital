"use client";

/**
 * Sincroniza créditos do convidado (Sentinela) entre instâncias independentes de
 * `useGuestCreditsGate` (sidebar, hub de avatares, monitoramento...) — cada uma busca
 * `/api/sentinel/credits` só no mount, então sem isso o ponto vermelho da sidebar
 * só atualiza depois de um reload, mesmo com o crédito já zerado em outra tela.
 */
import type { GuestSentinelCredits } from "@/lib/guest-limits";

const GUEST_CREDITS_EVENT = "guest-sentinel-credits-updated";

export function broadcastGuestSentinelCredits(credits: GuestSentinelCredits | null) {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(
    new CustomEvent<GuestSentinelCredits | null>(GUEST_CREDITS_EVENT, { detail: credits }),
  );
}

export function onGuestSentinelCreditsUpdate(
  listener: (credits: GuestSentinelCredits | null) => void,
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  const handler = (event: Event) => {
    listener((event as CustomEvent<GuestSentinelCredits | null>).detail);
  };
  window.addEventListener(GUEST_CREDITS_EVENT, handler);
  return () => window.removeEventListener(GUEST_CREDITS_EVENT, handler);
}
