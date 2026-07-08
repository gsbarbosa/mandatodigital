import type { CaricatureVariant } from "@/lib/openai-caricature-prompts";

/**
 * Menu-facing avatar types mapped onto the existing tracks/templates
 * (see persona-shared.tsx AVATAR_TYPE_BY_TRACK / ProductionTemplate).
 */
export type AvatarTipoSlug = "gemeo-digital" | "caricato" | "3d";

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
    slug: "gemeo-digital",
    label: "Gêmeo Digital",
    avatarType: "Meu Gêmeo Digital",
    caricatureVariant: null,
    heroDescription: [
      "Modelo de alta fidelidade e simpatia",
      "Sincronia labial neural",
      "Expressões faciais humanizadas",
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
    label: "3D",
    avatarType: "Minha Caricatura",
    caricatureVariant: "mascot_3d",
    heroDescription: [
      "Mascote 3D estilizado",
      "Voz clonada do candidato",
      "Alto compartilhamento nas redes",
    ],
  },
];

export function avatarTipoBySlug(slug: string): AvatarTipo | null {
  return AVATAR_TIPOS.find((tipo) => tipo.slug === slug) ?? null;
}
