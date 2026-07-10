import type { CaricatureVariant } from "@/lib/openai-caricature-prompts";

/**
 * Menu-facing avatar types mapped onto the existing tracks/templates
 * (see persona-shared.tsx AVATAR_TYPE_BY_TRACK / ProductionTemplate).
 */
export type AvatarTipoSlug = "foto-real" | "caricato" | "3d";

export type AvatarTipo = {
  slug: AvatarTipoSlug;
  label: string;
  /** Existing profile.avatarType value written by the Criativo flow. */
  avatarType: string;
  /** null = uses the raw avatar_image; otherwise the caricature variant asset. */
  caricatureVariant: CaricatureVariant | null;
  heroDescription: string[];
};

export const AVATAR_TIPOS: AvatarTipo[] = [
  {
    slug: "foto-real",
    label: "Gêmeo Digital",
    avatarType: "Meu Gêmeo Digital",
    caricatureVariant: null,
    heroDescription: [
      "Retrato fotorrealista a partir da sua foto",
      "Sincronia labial com a voz clonada",
      "Ideal para pronunciamentos diretos ao eleitor",
    ],
  },
  {
    slug: "caricato",
    label: "Caricato",
    avatarType: "Minha Caricatura",
    caricatureVariant: "editorial",
    heroDescription: [
      "Traço editorial com identidade própria",
      "Voz clonada do candidato",
      "Ideal para pautas leves e didáticas",
    ],
  },
  {
    slug: "3d",
    label: "Mascote 3D",
    avatarType: "Minha Caricatura",
    caricatureVariant: "mascot_3d",
    heroDescription: [
      "Mascote 3D estilizado",
      "Voz clonada do candidato",
      "Alto compartilhamento nas redes",
    ],
  },
];

export type AvatarProductionTemplate =
  | "photo_real"
  | "caricature_editorial"
  | "caricature_mascot_3d";

export function productionTemplateFromAvatarSlug(
  slug: AvatarTipoSlug,
): AvatarProductionTemplate {
  switch (slug) {
    case "foto-real":
      return "photo_real";
    case "caricato":
      return "caricature_editorial";
    case "3d":
      return "caricature_mascot_3d";
  }
}

export function avatarSlugFromProductionTemplate(
  template: AvatarProductionTemplate | "digital_twin",
): AvatarTipoSlug | null {
  switch (template) {
    case "photo_real":
    case "digital_twin":
      return "foto-real";
    case "caricature_editorial":
      return "caricato";
    case "caricature_mascot_3d":
      return "3d";
    default:
      return null;
  }
}

export function avatarSlugFromSearchParam(
  value: string | null | undefined,
): AvatarTipoSlug | null {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }
  if (normalized === "foto-real" || normalized === "gemeo-digital") {
    return "foto-real";
  }
  if (normalized === "caricato") {
    return "caricato";
  }
  if (normalized === "3d") {
    return "3d";
  }
  return null;
}

export function avatarTipoBySlug(slug: string): AvatarTipo | null {
  return AVATAR_TIPOS.find((tipo) => tipo.slug === slug) ?? null;
}
