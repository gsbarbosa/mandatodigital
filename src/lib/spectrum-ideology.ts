import { SPECTRUM_CENTER_INDEX, spectrumToIndex } from "@/lib/constants";

export type IdeologyLane = "esquerda" | "centro" | "direita";

export function classifyIdeologyLane(spectrum: string | undefined): IdeologyLane | null {
  const trimmed = spectrum?.trim();
  if (!trimmed) {
    return null;
  }

  const index = spectrumToIndex(trimmed);
  if (index === SPECTRUM_CENTER_INDEX) {
    return "centro";
  }

  return index < SPECTRUM_CENTER_INDEX ? "esquerda" : "direita";
}
