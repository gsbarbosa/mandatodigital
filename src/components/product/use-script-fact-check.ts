"use client";

import { useCallback, useRef, useState } from "react";

import type { FactCheckResult } from "@/lib/auditor/types";
import { isFactCheckHeuristicFallback } from "@/lib/auditor/types";
import type { MockSentinelSuggestion } from "@/lib/sentinel-mock-suggestions";

export const SCRIPT_EDIT_CONSENT_TEXT =
  "Confirmo que alterei o roteiro após a validação factual e assumo responsabilidade pelo conteúdo publicado.";

export const SCRIPT_MANUAL_REVIEW_CONSENT_TEXT =
  "Confirmo que a validação factual automática não pôde ser concluída, que revisei o roteiro manualmente com base nas fontes da pauta e assumo responsabilidade pelo conteúdo publicado.";

export function useScriptFactCheck() {
  const [isFactChecking, setIsFactChecking] = useState(false);
  const [factCheckResult, setFactCheckResult] = useState<FactCheckResult | null>(null);
  const [scriptEditedAfterApproval, setScriptEditedAfterApproval] = useState(false);
  const [scriptEditConsent, setScriptEditConsent] = useState(false);
  const [manualReviewConsentRequired, setManualReviewConsentRequired] = useState(false);
  const [manualReviewConsent, setManualReviewConsent] = useState(false);
  const wasApprovedRef = useRef(false);

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
    setManualReviewConsentRequired(false);
    setManualReviewConsent(false);
    wasApprovedRef.current = false;
  }, []);

  const approveWithFactCheck = useCallback(
    async (input: {
      script: string;
      topic?: string;
      suggestion: MockSentinelSuggestion | null;
      useFreePrompt: boolean;
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
          }),
        });

        if (response.status === 403) {
          wasApprovedRef.current = true;
          setScriptEditedAfterApproval(false);
          setManualReviewConsentRequired(false);
          setManualReviewConsent(false);
          return { ok: true };
        }

        const payload = (await response.json()) as {
          result?: FactCheckResult;
          message?: string;
        };

        if (!response.ok) {
          return { ok: false, message: payload.message || "Falha ao validar fatos do roteiro." };
        }

        const result = payload.result;
        if (!result) {
          return { ok: false, message: "Resposta invalida do validador." };
        }

        setFactCheckResult(result);

        if (result.verdict === "disputed") {
          return {
            ok: false,
            message:
              result.summary ||
              "O validador encontrou inconsistencias. Revise o roteiro ou as fontes antes de aprovar.",
          };
        }

        wasApprovedRef.current = true;
        setScriptEditedAfterApproval(false);
        if (isFactCheckHeuristicFallback(result)) {
          setManualReviewConsentRequired(true);
          setManualReviewConsent(false);
        } else {
          setManualReviewConsentRequired(false);
          setManualReviewConsent(false);
        }
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
    manualReviewConsentRequired,
    manualReviewConsent,
    setManualReviewConsent,
    markScriptEditedAfterApproval,
    resetFactCheckState,
    approveWithFactCheck,
  };
}
