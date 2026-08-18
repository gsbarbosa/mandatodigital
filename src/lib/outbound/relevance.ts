/**
 * Pontuação de relevância do prospect para decidir canal: contato pessoal
 * (VIP) vs disparo de WhatsApp cadenciado.
 *
 * A régua é operacional, não eleitoral: mede o custo de errar o tom
 * (denúncia de spam, assessoria no meio, presidente de partido grande) e o
 * valor de um closing humano. Ver docs/marketing-outbound.md.
 */

import type { ContactGender, MarketingContact, OfficeKey, RelevanceTier } from "@/lib/outbound/types";

const MAJOR_PARTIES = new Set([
  "PL",
  "PT",
  "MDB",
  "UNIÃO",
  "UNIAO",
  "PP",
  "PSD",
  "REPUBLICANOS",
  "PSB",
  "PDT",
  "PSDB",
  "PODE",
]);

/** Celebridade digital: blast frio vira denúncia. */
export const VIP_FOLLOWERS = 400_000;
/** Presença digital real (não só cota). */
export const HIGH_FOLLOWERS_WOMEN = 50_000;

export function isMajorParty(parties: string[]): boolean {
  return parties.some((party) => MAJOR_PARTIES.has(party.trim().toUpperCase()));
}

function strip(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Presidente de diretório, não vice. */
export function isPartyPresidentRole(roles: string[]): boolean {
  return roles.some((role) => {
    const text = strip(role);
    if (!text.includes("presidente")) {
      return false;
    }
    if (text.includes("vice")) {
      return false;
    }
    return true;
  });
}

export type ExtendedOffice = OfficeKey | "senador" | "governador";

export function extendedOffice(contact: Pick<MarketingContact, "candidateRole" | "roles">): ExtendedOffice | null {
  const text = strip(`${contact.candidateRole} ${contact.roles.join(" ")}`);
  if (text.includes("governador") && !text.includes("vice")) return "governador";
  if (text.includes("senador") && !text.includes("suplente")) return "senador";
  if (text.includes("distrital")) return "distrital";
  if (text.includes("estadual")) return "estadual";
  if (text.includes("federal")) return "federal";
  return null;
}

export type RelevanceBreakdown = {
  score: number;
  tier: RelevanceTier;
  reasons: string[];
};

export type RelevanceInput = {
  office: ExtendedOffice | null;
  isReelection: boolean;
  isPartyPresident: boolean;
  gender: ContactGender;
  parties: string[];
  instagramFollowers: number;
};

function officePoints(office: ExtendedOffice | null): number {
  if (office === "governador" || office === "senador") return 28;
  if (office === "federal") return 22;
  if (office === "estadual") return 14;
  if (office === "distrital") return 12;
  return 4;
}

function followerPoints(followers: number): number {
  if (followers <= 0) return 0;
  return Math.min(24, Math.round(Math.log10(followers + 1) * 6));
}

function clampScore(value: number): number {
  return Math.min(99, Math.max(0, Math.round(value)));
}

/**
 * VIP é regra absoluta (não só corte de score): o custo de um template frio
 * nesses casos é maior que o de um falso negativo.
 */
export function scoreRelevance(input: RelevanceInput): RelevanceBreakdown {
  const reasons: string[] = [];
  let score = officePoints(input.office);

  if (input.office === "federal") reasons.push("cargo federal");
  if (input.office === "estadual") reasons.push("cargo estadual");
  if (input.office === "distrital") reasons.push("cargo distrital");
  if (input.office === "senador") reasons.push("senado");
  if (input.office === "governador") reasons.push("governo");

  if (input.isReelection) {
    score += 25;
    reasons.push("reeleição");
  }
  if (input.isPartyPresident) {
    score += 22;
    reasons.push("presidente de partido");
    if (isMajorParty(input.parties)) {
      score += 8;
      reasons.push("partido grande");
    }
  }
  score += followerPoints(input.instagramFollowers);
  if (input.instagramFollowers >= VIP_FOLLOWERS) {
    reasons.push("audiência digital");
  } else if (input.gender === "F" && input.instagramFollowers >= HIGH_FOLLOWERS_WOMEN) {
    reasons.push("candidata com base digital");
  }

  const vip =
    input.instagramFollowers >= VIP_FOLLOWERS ||
    (input.isReelection && input.office === "federal") ||
    input.office === "senador" ||
    input.office === "governador" ||
    (input.isPartyPresident && isMajorParty(input.parties));

  if (vip) {
    return { score: clampScore(Math.max(score, 80)), tier: "vip", reasons };
  }

  const alta =
    score >= 55 ||
    (input.isReelection && (input.office === "estadual" || input.office === "distrital")) ||
    input.isPartyPresident ||
    (input.gender === "F" && input.instagramFollowers >= HIGH_FOLLOWERS_WOMEN);

  if (alta) {
    return { score: clampScore(Math.max(score, 55)), tier: "alta", reasons };
  }
  if (score >= 38) {
    return { score: clampScore(score), tier: "media", reasons };
  }
  return { score: clampScore(score), tier: "padrao", reasons };
}

export function scoreContact(contact: MarketingContact): RelevanceBreakdown {
  return scoreRelevance({
    office: extendedOffice(contact),
    isReelection: contact.isReelection,
    isPartyPresident: isPartyPresidentRole(contact.roles),
    gender: contact.gender,
    parties: contact.parties,
    instagramFollowers: contact.instagramFollowers,
  });
}
