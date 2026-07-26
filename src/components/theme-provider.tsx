"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  applyResolvedAppearance,
  readStoredAppearance,
  resolveAppearance,
  writeStoredAppearance,
  type AppearancePreference,
  type ResolvedAppearance,
} from "@/lib/appearance";

type AppearanceContextValue = {
  preference: AppearancePreference;
  resolved: ResolvedAppearance;
  setPreference: (preference: AppearancePreference) => void;
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<AppearancePreference>("system");
  const [resolved, setResolved] = useState<ResolvedAppearance>("dark");

  const syncResolved = useCallback((nextPreference: AppearancePreference) => {
    const nextResolved = resolveAppearance(nextPreference);
    setResolved(nextResolved);
    applyResolvedAppearance(nextResolved);
  }, []);

  useEffect(() => {
    const stored = readStoredAppearance();
    setPreferenceState(stored);
    syncResolved(stored);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onMediaChange = () => {
      setPreferenceState((current) => {
        if (current === "system") {
          syncResolved("system");
        }
        return current;
      });
    };

    media.addEventListener("change", onMediaChange);
    return () => media.removeEventListener("change", onMediaChange);
  }, [syncResolved]);

  const setPreference = useCallback(
    (next: AppearancePreference) => {
      setPreferenceState(next);
      writeStoredAppearance(next);
      syncResolved(next);
    },
    [syncResolved],
  );

  const value = useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  const ctx = useContext(AppearanceContext);
  if (!ctx) {
    throw new Error("useAppearance must be used within ThemeProvider");
  }
  return ctx;
}
