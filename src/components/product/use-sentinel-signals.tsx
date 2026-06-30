"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { MockSentinelSuggestion } from "@/lib/sentinel-mock-suggestions";
import type { SentinelSuggestionsMeta } from "@/lib/sentinel-types";
import {
  buildSentinelRefreshStatusMessage,
  fetchSentinelSuggestionsCache,
  isSentinelCacheNewer,
  refreshSentinelSuggestionsRemote,
} from "@/lib/sentinel-refresh-client";

const POLL_INTERVAL_MS = 3000;
const POLL_MAX_ATTEMPTS = 30;

type PublishMessage = (message: string, durationMs?: number) => void;

export function useSentinelSignalsState(input: {
  publishStatusMessage: PublishMessage;
  publishErrorMessage: PublishMessage;
}) {
  const { publishStatusMessage, publishErrorMessage } = input;

  const [sentinelSuggestions, setSentinelSuggestions] = useState<MockSentinelSuggestion[]>([]);
  const [sentinelMeta, setSentinelMeta] = useState<SentinelSuggestionsMeta | null>(null);
  const [isLoadingSentinel, setIsLoadingSentinel] = useState(true);
  const [sentinelLoadError, setSentinelLoadError] = useState<string | null>(null);
  const [isRefreshingSentinel, setIsRefreshingSentinel] = useState(false);

  const refreshPromiseRef = useRef<Promise<void> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollAttemptsRef = useRef(0);
  const refreshBaselineRef = useRef<string | null>(null);

  const clearPollTimer = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    pollAttemptsRef.current = 0;
  }, []);

  const applyPayload = useCallback(
    (payload: { suggestions: MockSentinelSuggestion[]; meta: SentinelSuggestionsMeta | null }) => {
      setSentinelSuggestions(payload.suggestions);
      setSentinelMeta(payload.meta);
    },
    [],
  );

  const loadSentinelSuggestionsFromCache = useCallback(async () => {
    setIsLoadingSentinel(true);
    setSentinelLoadError(null);

    try {
      const payload = await fetchSentinelSuggestionsCache();
      applyPayload(payload);
    } catch (error) {
      setSentinelLoadError(
        error instanceof Error ? error.message : "Não foi possível carregar os sinais.",
      );
      setSentinelSuggestions([]);
      setSentinelMeta(null);
    } finally {
      setIsLoadingSentinel(false);
    }
  }, [applyPayload]);

  const pollCacheUntilFresh = useCallback(() => {
    clearPollTimer();

    pollTimerRef.current = setInterval(() => {
      pollAttemptsRef.current += 1;

      void (async () => {
        try {
          const payload = await fetchSentinelSuggestionsCache();
          const baseline = refreshBaselineRef.current;

          if (isSentinelCacheNewer(baseline, payload.meta)) {
            applyPayload(payload);
            clearPollTimer();
            setIsRefreshingSentinel(false);
            publishStatusMessage(buildSentinelRefreshStatusMessage(payload.suggestions, payload.meta));
            return;
          }

          if (pollAttemptsRef.current >= POLL_MAX_ATTEMPTS) {
            clearPollTimer();
            setIsRefreshingSentinel(false);
          }
        } catch {
          if (pollAttemptsRef.current >= POLL_MAX_ATTEMPTS) {
            clearPollTimer();
            setIsRefreshingSentinel(false);
          }
        }
      })();
    }, POLL_INTERVAL_MS);
  }, [applyPayload, clearPollTimer, publishStatusMessage]);

  const refreshSentinelSignals = useCallback(async () => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const run = (async () => {
      setIsRefreshingSentinel(true);
      setSentinelLoadError(null);
      refreshBaselineRef.current = sentinelMeta?.refreshedAt ?? null;
      let pollingAfterError = false;

      try {
        const payload = await refreshSentinelSuggestionsRemote();
        applyPayload(payload);
        publishStatusMessage(
          buildSentinelRefreshStatusMessage(payload.suggestions, payload.meta),
          5000,
        );
        clearPollTimer();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Não foi possível atualizar os sinais.";
        publishErrorMessage(message);
        pollingAfterError = true;
        pollCacheUntilFresh();
      } finally {
        refreshPromiseRef.current = null;
        if (!pollingAfterError) {
          setIsRefreshingSentinel(false);
        }
      }
    })();

    refreshPromiseRef.current = run;
    return run;
  }, [
    applyPayload,
    clearPollTimer,
    pollCacheUntilFresh,
    publishErrorMessage,
    publishStatusMessage,
    sentinelMeta?.refreshedAt,
  ]);

  const syncSentinelOnPageEnter = useCallback(async () => {
    if (isRefreshingSentinel || refreshPromiseRef.current) {
      return;
    }

    await loadSentinelSuggestionsFromCache();
  }, [isRefreshingSentinel, loadSentinelSuggestionsFromCache]);

  useEffect(() => {
    void loadSentinelSuggestionsFromCache();
  }, [loadSentinelSuggestionsFromCache]);

  useEffect(() => {
    return () => {
      clearPollTimer();
    };
  }, [clearPollTimer]);

  return {
    sentinelSuggestions,
    sentinelMeta,
    isLoadingSentinel,
    sentinelLoadError,
    isRefreshingSentinel,
    loadSentinelSuggestionsFromCache,
    refreshSentinelSignals,
    syncSentinelOnPageEnter,
  };
}
