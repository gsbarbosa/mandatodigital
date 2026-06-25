export type CaricatureVariant = "editorial" | "mascot_3d";

export const CARICATURE_VARIANT_FILENAMES: Record<CaricatureVariant, string> = {
  editorial: "caricatura-editorial.png",
  mascot_3d: "caricatura-mascot-3d.png",
};

export const CARICATURE_EDITORIAL_PROMPT =
  "Transform this portrait into a polished editorial political caricature illustration. " +
  "Exaggerate distinctive facial features while keeping the person clearly recognizable. " +
  "Give the expression a warm, friendly and approachable look — soft smile, kind eyes, " +
  "sympathetic and likeable presence, without losing the editorial caricature style. " +
  "Bold clean outlines, warm colors, neutral simple background, front-facing bust, " +
  "suitable as a talking avatar. No text, no logos, no weapons, no extra people.";

export const CARICATURE_MASCOT_3D_PROMPT =
  "A high-quality 3D render of a charming and friendly stylized mascot, based on the facial features " +
  "and characteristics of the input image. The mascot has large, expressive, warm eyes, a soft, " +
  "cheerful smile, and a universally pleasing, cute expression. The art style is high-end 3D " +
  "character design, reminiscent of Pixar or modern animation studios, with soft, rounded forms " +
  "and vibrant but soothing colors. The material should appear tactile and soft, like matte vinyl " +
  "or plush fabric. The mascot is posed in a welcoming manner, perhaps waving gently, with a warm " +
  "and inviting glow. The background is a gently blurred, bright, and cheerful abstract studio " +
  "setting with soft bokeh. No text, no logos, no weapons, no extra people.";

export function resolveCaricaturePrompt(input: {
  variant?: CaricatureVariant;
  styleHint?: string;
}) {
  const variant = input.variant === "mascot_3d" ? "mascot_3d" : "editorial";
  const base =
    variant === "mascot_3d" ? CARICATURE_MASCOT_3D_PROMPT : CARICATURE_EDITORIAL_PROMPT;
  const hint = input.styleHint?.trim();
  if (!hint) {
    return base;
  }
  return `${base} Additional style notes: ${hint}`;
}

export function caricatureVariantFromFilename(filename: string): CaricatureVariant | null {
  const name = filename.toLowerCase();
  if (name.includes("mascot")) {
    return "mascot_3d";
  }
  if (name.includes("editorial")) {
    return "editorial";
  }
  return null;
}

export function caricatureVariantLabel(variant: CaricatureVariant) {
  return variant === "editorial" ? "Versão 1 — Caricatura" : "Versão 2 — Mascote 3D";
}

export function caricatureVariantGeneratingLabel(variant: CaricatureVariant) {
  return variant === "editorial" ? "Gerando caricatura…" : "Gerando mascote 3D…";
}
