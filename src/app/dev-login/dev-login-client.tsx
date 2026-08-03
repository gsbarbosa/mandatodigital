"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { signInWithCustomToken } from "firebase/auth";

import { getFirebaseAuth } from "@/lib/firebase/client";
import { persistFirebaseSession, formatAuthClientError } from "@/lib/firebase/session-client";
import { resolvePostLoginPath } from "@/lib/registration-gate";

export function DevLoginClient() {
  const router = useRouter();
  const [status, setStatus] = useState("Autenticando conta de teste...");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const tokenResponse = await fetch("/api/dev/login", { method: "POST" });
        const tokenPayload = (await tokenResponse.json().catch(() => null)) as {
          customToken?: string;
          email?: string;
          message?: string;
        } | null;

        if (!tokenResponse.ok || !tokenPayload?.customToken) {
          throw new Error(tokenPayload?.message ?? "Falha ao gerar token de teste.");
        }

        await signInWithCustomToken(getFirebaseAuth(), tokenPayload.customToken);
        const session = await persistFirebaseSession();

        if (cancelled) {
          return;
        }

        const destination = resolvePostLoginPath({
          registrationComplete: session.registrationComplete,
          needsPlanSelection: session.needsPlanSelection,
          nextPath: null,
        });

        router.replace(destination as Route);
        router.refresh();
      } catch (error) {
        if (!cancelled) {
          setStatus(formatAuthClientError(error instanceof Error ? error.message : String(error)));
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div style={{ padding: 24, fontFamily: "sans-serif" }}>
      <p>{status}</p>
    </div>
  );
}
