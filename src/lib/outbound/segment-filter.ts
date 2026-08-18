/**
 * Avaliação de segmento em memória.
 *
 * A base outbound é pequena (ordem de milhares) e os filtros são muitos e
 * opcionais — resolver via query composta no Firestore exigiria um índice por
 * combinação. Enquanto a base couber em uma leitura, filtrar em memória é mais
 * simples e mais barato. Ver "Limites" em docs/marketing-outbound.md.
 */

import { isPartyPresidentRole } from "@/lib/outbound/relevance";
import {
  EMPTY_SEGMENT_FILTER,
  isCampaignChannel,
  isContactSource,
  isOfficeKey,
  isRelevanceTier,
  type MarketingContact,
  type OfficeKey,
  type SegmentFilter,
} from "@/lib/outbound/types";

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Contato pode receber pelo canal? E-mail exige e-mail; WhatsApp exige móvel. */
export function contactSupportsChannel(
  contact: MarketingContact,
  channel: SegmentFilter["channel"],
): boolean {
  if (channel === "email") {
    return Boolean(contact.email);
  }
  if (channel === "whatsapp") {
    return Boolean(contact.phoneE164);
  }
  return true;
}

/** Cargo estadual/distrital/federal a partir do texto livre da fonte. */
export function contactOffice(contact: MarketingContact): OfficeKey | null {
  const text = normalize(`${contact.candidateRole} ${contact.roles.join(" ")}`);
  if (text.includes("distrital")) return "distrital";
  if (text.includes("estadual")) return "estadual";
  if (text.includes("federal")) return "federal";
  return null;
}

export function matchesSegment(contact: MarketingContact, filter: SegmentFilter): boolean {
  if (filter.sources.length > 0 && !filter.sources.includes(contact.source)) {
    return false;
  }
  if (filter.ufs.length > 0 && !filter.ufs.includes(contact.uf)) {
    return false;
  }
  if (filter.parties.length > 0 && !contact.parties.some((party) => filter.parties.includes(party))) {
    return false;
  }
  if (filter.onlyCandidates2026 && !contact.isCandidate2026) {
    return false;
  }
  if (filter.onlyWomen && contact.gender !== "F") {
    return false;
  }
  if (filter.onlyMen && contact.gender !== "M") {
    return false;
  }
  if (filter.onlyReelection && !contact.isReelection) {
    return false;
  }
  if (filter.excludeReelection && contact.isReelection) {
    return false;
  }
  if (filter.onlyPartyPresidents && !isPartyPresidentRole(contact.roles)) {
    return false;
  }
  if (filter.offices.length > 0) {
    const office = contactOffice(contact);
    if (!office || !filter.offices.includes(office)) {
      return false;
    }
  }
  if (filter.relevanceTiers.length > 0 && !filter.relevanceTiers.includes(contact.relevanceTier)) {
    return false;
  }
  if (filter.excludeVip && contact.relevanceTier === "vip") {
    return false;
  }
  if (filter.excludeSuspended && contact.suspended) {
    return false;
  }
  if (!contactSupportsChannel(contact, filter.channel)) {
    return false;
  }

  const search = normalize(filter.search);
  if (search) {
    const haystack = normalize(
      [contact.name, contact.email, contact.municipality, contact.parties.join(" ")].join(" "),
    );
    if (!haystack.includes(search)) {
      return false;
    }
  }

  return true;
}

export function applySegment(
  contacts: MarketingContact[],
  filter: SegmentFilter,
): MarketingContact[] {
  return contacts.filter((contact) => matchesSegment(contact, filter));
}

/** Normaliza entrada crua (API/Firestore) para um filtro completo e confiável. */
export function coerceSegmentFilter(value: unknown): SegmentFilter {
  const raw = (value ?? {}) as Partial<Record<keyof SegmentFilter, unknown>>;

  const stringArray = (input: unknown): string[] =>
    Array.isArray(input) ? input.map((item) => String(item).trim()).filter(Boolean) : [];

  const channel = isCampaignChannel(raw.channel) ? raw.channel : null;

  return {
    sources: stringArray(raw.sources).filter(isContactSource),
    ufs: stringArray(raw.ufs).map((uf) => uf.toUpperCase()),
    parties: stringArray(raw.parties),
    channel,
    onlyCandidates2026: Boolean(raw.onlyCandidates2026),
    onlyWomen: Boolean(raw.onlyWomen),
    onlyMen: Boolean(raw.onlyMen),
    onlyReelection: Boolean(raw.onlyReelection),
    excludeReelection: Boolean(raw.excludeReelection),
    onlyPartyPresidents: Boolean(raw.onlyPartyPresidents),
    offices: stringArray(raw.offices).filter(isOfficeKey),
    relevanceTiers: stringArray(raw.relevanceTiers).filter(isRelevanceTier),
    excludeVip:
      raw.excludeVip === undefined ? EMPTY_SEGMENT_FILTER.excludeVip : Boolean(raw.excludeVip),
    excludeSuspended:
      raw.excludeSuspended === undefined
        ? EMPTY_SEGMENT_FILTER.excludeSuspended
        : Boolean(raw.excludeSuspended),
    search: typeof raw.search === "string" ? raw.search.trim() : "",
  };
}
