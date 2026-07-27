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
  const [preference, setPreferenceState] = useState<AppearancePreference>("dark");

  useEffect(() => {
    const stored = readStoredAppearance();
    setPreferenceState(stored);
    applyResolvedAppearance(stored);
  }, []);

  const setPreference = useCallback((next: AppearancePreference) => {
    setPreferenceState(next);
    writeStoredAppearance(next);
    applyResolvedAppearance(next);
  }, []);

  const value = useMemo(
    () => ({ preference, resolved: preference, setPreference }),
    [preference, setPreference],
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
