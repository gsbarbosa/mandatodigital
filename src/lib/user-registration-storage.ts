import type { DocumentData } from "firebase-admin/firestore";

import { COLLECTIONS, col } from "@/lib/firebase/collections";
import type { EarlyAccessPlanId } from "@/lib/early-access-types";
import { toDatabaseOwnerUserId } from "@/lib/owner-user-id";
import {
  decideSeatAssignment,
  isSeatCappedPlan,
  normalizePartyKey,
  normalizeUfKey,
} from "@/lib/party-uf-seats";
import { getStorageOwnerUserId } from "@/lib/storage-context";
import type {
  SeatAssignment,
  UserRegistration,
  UserRegistrationCompleteInput,
  UserRegistrationStatus,
} from "@/lib/user-registration-types";

function nowIso() {
  return new Date().toISOString();
}

function parsePlanId(value: unknown): EarlyAccessPlanId | "" {
  const raw = String(value ?? "").trim();
  if (raw === "essencial" || raw === "avancado" || raw === "elite") {
    return raw;
  }
  return "";
}

function parseStatus(value: unknown): UserRegistrationStatus {
  if (value === "complete" || value === "reserve") {
    return value;
  }
  return "incomplete";
}

function mapDoc(ownerUserId: string, data: DocumentData | undefined): UserRegistration | null {
  if (!data) {
    return null;
  }

  return {
    ownerUserId,
    profileId: data.profileId == null ? null : String(data.profileId),
    status: parseStatus(data.status),
    fullName: String(data.fullName ?? ""),
    party: String(data.party ?? ""),
    cpf: String(data.cpf ?? ""),
    uf: String(data.uf ?? ""),
    role: String(data.role ?? ""),
    address: String(data.address ?? ""),
    phone: String(data.phone ?? ""),
    email: String(data.email ?? ""),
    teamEmail: String(data.teamEmail ?? ""),
    teamPhone: String(data.teamPhone ?? ""),
    planId: parsePlanId(data.planId),
    createdAt: String(data.createdAt ?? nowIso()),
    updatedAt: String(data.updatedAt ?? nowIso()),
    completedAt: data.completedAt ? String(data.completedAt) : null,
  };
}

/** Migração soft: docs antigos em earlyAccessReservations. */
function mapLegacyReservation(
  ownerUserId: string,
  data: DocumentData | undefined,
): UserRegistration | null {
  if (!data) {
    return null;
  }

  const planId = parsePlanId(data.planId) || "avancado";
  const completedAt = String(data.reservedAt ?? data.updatedAt ?? nowIso());
  const hasCore =
    Boolean(String(data.fullName ?? "").trim()) &&
    Boolean(String(data.cpf ?? "").trim()) &&
    Boolean(String(data.email ?? "").trim());

  return {
    ownerUserId,
    profileId: data.profileId == null ? null : String(data.profileId),
    status: hasCore ? "complete" : "incomplete",
    fullName: String(data.fullName ?? ""),
    party: String(data.party ?? ""),
    cpf: String(data.cpf ?? ""),
    uf: String(data.uf ?? ""),
    role: String(data.role ?? ""),
    address: String(data.address ?? ""),
    phone: String(data.phone ?? ""),
    email: String(data.email ?? ""),
    teamEmail: String(data.teamEmail ?? ""),
    teamPhone: String(data.teamPhone ?? ""),
    planId,
    createdAt: String(data.reservedAt ?? data.createdAt ?? nowIso()),
    updatedAt: String(data.updatedAt ?? nowIso()),
    completedAt: hasCore ? completedAt : null,
  };
}

/** Sempre normaliza para o mesmo id usado em politicianProfiles (ownerUserId). */
function resolveOwnerUserId(explicit?: string) {
  const fromContext = getStorageOwnerUserId()?.trim();
  if (fromContext && !explicit) {
    return fromContext;
  }
  const raw = (explicit ?? fromContext)?.trim();
  if (!raw) {
    throw new Error("Sessao obrigatoria para o cadastro do usuario.");
  }
  return toDatabaseOwnerUserId(raw);
}

async function readRegistrationDoc(ownerUserId: string): Promise<UserRegistration | null> {
  const snap = await col(COLLECTIONS.userRegistrations).doc(ownerUserId).get();
  if (snap.exists) {
    return mapDoc(ownerUserId, snap.data());
  }

  const legacy = await col(COLLECTIONS.earlyAccessReservations).doc(ownerUserId).get();
  if (!legacy.exists) {
    return null;
  }

  const mapped = mapLegacyReservation(ownerUserId, legacy.data());
  if (mapped) {
    await col(COLLECTIONS.userRegistrations).doc(ownerUserId).set(mapped, { merge: true });
  }
  return mapped;
}

/**
 * Conta vagas ativas (status complete) em planos com teto para o mesmo partido+UF.
 * Exclui o próprio usuário (reenvio do form não conta duas vezes).
 */
export async function countActiveSeatsByPartyUf(input: {
  party: string;
  uf: string;
  excludeOwnerUserId?: string;
}): Promise<number> {
  const party = normalizePartyKey(input.party);
  const uf = normalizeUfKey(input.uf);
  if (!party || !uf) {
    return 0;
  }

  const snap = await col(COLLECTIONS.userRegistrations)
    .where("party", "==", party)
    .where("uf", "==", uf)
    .where("status", "==", "complete")
    .get();

  let count = 0;
  for (const doc of snap.docs) {
    if (input.excludeOwnerUserId && doc.id === input.excludeOwnerUserId) {
      continue;
    }
    const planId = parsePlanId(doc.data().planId);
    if (isSeatCappedPlan(planId)) {
      count += 1;
    }
  }
  return count;
}

export async function resolveSeatAssignment(input: {
  planId: EarlyAccessPlanId;
  party: string;
  uf: string;
  ownerUserId: string;
  existingStatus?: UserRegistrationStatus;
}): Promise<SeatAssignment> {
  const activeSeatsExcludingSelf = await countActiveSeatsByPartyUf({
    party: input.party,
    uf: input.uf,
    excludeOwnerUserId: input.ownerUserId,
  });

  return decideSeatAssignment({
    planId: input.planId,
    activeSeatsExcludingSelf,
    existingStatus: input.existingStatus,
  });
}

/**
 * Garante stub de cadastro no 1º login (email do Auth).
 * Idempotente — não apaga dados já preenchidos.
 */
export async function ensureUserRegistration(input: {
  ownerUserId: string;
  email?: string | null;
}): Promise<UserRegistration> {
  const ownerUserId = resolveOwnerUserId(input.ownerUserId);
  const email = String(input.email ?? "").trim().toLowerCase();
  const existing = await readRegistrationDoc(ownerUserId);
  const now = nowIso();

  if (existing) {
    if (email && !existing.email) {
      const patched: UserRegistration = {
        ...existing,
        email,
        updatedAt: now,
      };
      await col(COLLECTIONS.userRegistrations).doc(ownerUserId).set(patched, { merge: true });
      return patched;
    }
    return existing;
  }

  const stub: UserRegistration = {
    ownerUserId,
    profileId: null,
    status: "incomplete",
    fullName: "",
    party: "",
    cpf: "",
    uf: "",
    role: "",
    address: "",
    phone: "",
    email,
    teamEmail: "",
    teamPhone: "",
    planId: "",
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };

  await col(COLLECTIONS.userRegistrations).doc(ownerUserId).set(stub, { merge: true });
  return stub;
}

export async function getUserRegistrationForOwner(
  ownerUserId?: string,
): Promise<UserRegistration | null> {
  return readRegistrationDoc(resolveOwnerUserId(ownerUserId));
}

export async function completeUserRegistration(input: {
  data: UserRegistrationCompleteInput;
  profileId?: string | null;
}): Promise<{ registration: UserRegistration; seat: SeatAssignment }> {
  const ownerUserId = resolveOwnerUserId();
  const existing = await readRegistrationDoc(ownerUserId);
  const now = nowIso();
  const email = input.data.email.trim().toLowerCase();
  const party = normalizePartyKey(input.data.party);
  const uf = normalizeUfKey(input.data.uf);

  const seat = await resolveSeatAssignment({
    planId: input.data.planId,
    party,
    uf,
    ownerUserId,
    existingStatus: existing?.status,
  });

  const row: UserRegistration = {
    ownerUserId,
    profileId: input.profileId ?? existing?.profileId ?? null,
    status: seat.status,
    fullName: input.data.fullName.trim(),
    party,
    cpf: input.data.cpf.trim(),
    uf,
    role: input.data.role.trim(),
    address: input.data.address.trim(),
    phone: input.data.phone.trim(),
    email,
    teamEmail: input.data.teamEmail.trim(),
    teamPhone: input.data.teamPhone.trim(),
    planId: input.data.planId,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    completedAt: existing?.completedAt ?? now,
  };

  await col(COLLECTIONS.userRegistrations).doc(ownerUserId).set(row, { merge: true });
  return { registration: row, seat };
}

export async function updateUserRegistrationTeamContact(input: {
  teamEmail: string;
  teamPhone: string;
}): Promise<UserRegistration> {
  const ownerUserId = resolveOwnerUserId();
  const existing = await readRegistrationDoc(ownerUserId);
  if (!existing || !isUserRegistrationComplete(existing)) {
    throw new Error("Cadastro incompleto. Preencha os dados pessoais primeiro.");
  }

  const updated: UserRegistration = {
    ...existing,
    teamEmail: input.teamEmail.trim(),
    teamPhone: input.teamPhone.trim(),
    updatedAt: nowIso(),
  };

  await col(COLLECTIONS.userRegistrations).doc(ownerUserId).set(updated, { merge: true });
  return updated;
}

/** Cadastro pessoal preenchido (vaga ativa ou lista de reserva). */
export function isUserRegistrationComplete(
  registration: UserRegistration | null | undefined,
): boolean {
  return registration?.status === "complete" || registration?.status === "reserve";
}

/** Shape usado pelo front de early-access (cache local / CNPJ / planos). */
export function toEarlyAccessReservationShape(row: UserRegistration) {
  if (!isUserRegistrationComplete(row) || !row.planId) {
    return null;
  }

  return {
    fullName: row.fullName,
    party: row.party,
    cpf: row.cpf,
    uf: row.uf,
    role: row.role,
    address: row.address,
    phone: row.phone,
    email: row.email,
    teamEmail: row.teamEmail,
    teamPhone: row.teamPhone,
    planId: row.planId,
    reservedAt: row.completedAt ?? row.createdAt,
    seatStatus: row.status === "reserve" ? ("reserve" as const) : ("active" as const),
  };
}
