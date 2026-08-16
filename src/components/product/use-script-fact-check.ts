"use client";

import { useCallback, useRef, useState } from "react";

import { evaluateFactCheckForApproval } from "@/lib/auditor/fact-check-gate";
import type { FactCheckResult } from "@/lib/auditor/types";
import type { MockSentinelSuggestion } from "@/lib/sentinel-mock-suggestions";

export const SCRIPT_EDIT_CONSENT_TEXT =
  "Confirmo que alterei o roteiro após a validação factual e assumo responsabilidade pelo conteúdo publicado.";

export function useScriptFactCheck() {
  const [isFactChecking, setIsFactChecking] = useState(false);
  const [factCheckResult, setFactCheckResult] = useState<FactCheckResult | null>(null);
  const [scriptEditedAfterApproval, setScriptEditedAfterApproval] = useState(false);
  const [scriptEditConsent, setScriptEditConsent] = useState(false);
  const [extraSources, setExtraSources] = useState<string[]>([]);
  const wasApprovedRef = useRef(false);

  const unsupportedClaims = (factCheckResult?.claims ?? []).filter(
    (claim) => claim.verdict === "unsupported",
  );
  const contradictedClaims = (factCheckResult?.claims ?? []).filter(
    (claim) => claim.verdict === "contradicted",
  );

  const addExtraSource = useCallback((url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setExtraSources((current) => (current.includes(trimmed) ? current : [...current, trimmed]));
  }, []);

  const removeExtraSource = useCallback((url: string) => {
    setExtraSources((current) => current.filter((item) => item !== url));
  }, []);

  const markScriptEditedAfterApproval = useCallback(() => {
    if (wasApprovedRef.current) {
      setScriptEditedAfterApproval(true);
      setScriptEditConsent(false);
    }
  }, []);

  const resetFactCheckState = useCallback(() => {
    setFactCheckResult(null);
    setScriptEditedAfterApproval(false);
    setScriptEditConsent(false);
    setExtraSources([]);
    wasApprovedRef.current = false;
  }, []);

  const approveWithFactCheck = useCallback(
    async (input: {
      script: string;
      topic?: string;
      suggestion: MockSentinelSuggestion | null;
      useFreePrompt: boolean;
      /** Fontes adicionais coladas pelo usuario nesta tentativa (evita depender do
       *  estado interno `extraSources`, que so atualiza no proximo render). */
      extraSources?: string[];
    }): Promise<{ ok: boolean; message?: string }> => {
      setIsFactChecking(true);

      try {
        const response = await fetch("/api/auditor/fact-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            script: input.script,
            topic: input.topic,
            suggestionId: input.suggestion?.id,
            useFreePrompt: input.useFreePrompt,
            extraSources: input.extraSources ?? [],
          }),
        });

        const payload = (await response.json().catch(() => ({}))) as {
          result?: FactCheckResult;
          message?: string;
        };

        if (response.status === 403) {
          return {
            ok: false,
            message:
              "O validador factual está indisponível. Não é possível aprovar o roteiro agora.",
          };
        }

        if (!response.ok) {
          return { ok: false, message: payload.message || "Falha ao validar fatos do roteiro." };
        }

        const result = payload.result;
        if (!result) {
          return { ok: false, message: "Resposta invalida do validador." };
        }

        setFactCheckResult(result);

        if (input.useFreePrompt && result.verdict === "skipped") {
          wasApprovedRef.current = true;
          setScriptEditedAfterApproval(false);
          return { ok: true };
        }

        const decision = evaluateFactCheckForApproval(result);
        if (!decision.ok) {
          return { ok: false, message: decision.message };
        }

        wasApprovedRef.current = true;
        setScriptEditedAfterApproval(false);
        return { ok: true };
      } catch {
        return { ok: false, message: "Nao foi possivel contatar o validador factual." };
      } finally {
        setIsFactChecking(false);
      }
    },
    [],
  );

  return {
    isFactChecking,
    factCheckResult,
    scriptEditedAfterApproval,
    scriptEditConsent,
    setScriptEditConsent,
    markScriptEditedAfterApproval,
    resetFactCheckState,
    approveWithFactCheck,
    extraSources,
    addExtraSource,
    removeExtraSource,
    unsupportedClaims,
    contradictedClaims,
  };
}
