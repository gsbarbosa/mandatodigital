export const APPEARANCE_STORAGE_KEY = "md-appearance";

export type AppearancePreference = "light" | "dark";
export type ResolvedAppearance = "light" | "dark";

export const APPEARANCE_OPTIONS: Array<{
  value: AppearancePreference;
  label: string;
}> = [
  { value: "light", label: "Claro" },
  { value: "dark", label: "Escuro" },
];

export function isAppearancePreference(value: unknown): value is AppearancePreference {
  return value === "light" || value === "dark";
}

export function getSystemAppearance(): ResolvedAppearance {
  if (typeof window === "undefined") {
    return "dark";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function readStoredAppearance(): AppearancePreference {
  if (typeof window === "undefined") {
    return "dark";
  }
  try {
    const raw = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
    if (isAppearancePreference(raw)) {
      return raw;
    }
  } catch {
    // localStorage pode estar bloqueado (modo privado / iframe).
  }
  return getSystemAppearance();
}

export function writeStoredAppearance(preference: AppearancePreference) {
  try {
    window.localStorage.setItem(APPEARANCE_STORAGE_KEY, preference);
  } catch {
    // ignore
  }
}

export function applyResolvedAppearance(resolved: ResolvedAppearance) {
  const root = document.documentElement;
  root.setAttribute("data-theme", resolved);
  root.style.colorScheme = resolved;
}

/** Script inline anti-FOUC — mantém sincronizado com readStoredAppearance acima. */
export const APPEARANCE_BOOTSTRAP_SCRIPT = `(function(){try{var k=${JSON.stringify(APPEARANCE_STORAGE_KEY)};var p=localStorage.getItem(k);var r=(p==="light"||p==="dark")?p:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");var d=document.documentElement;d.setAttribute("data-theme",r);d.style.colorScheme=r;}catch(e){document.documentElement.setAttribute("data-theme","dark");document.documentElement.style.colorScheme="dark";}})();`;
