import type { DocumentData } from "firebase-admin/firestore";

import { COLLECTIONS, col } from "@/lib/firebase/collections";
import type { EarlyAccessPlanId } from "@/lib/early-access-types";
import { parseBillingMethod, type BillingMethod } from "@/lib/billing/billing-method";
import { parseBillingStatus, type BillingStatus } from "@/lib/billing/plan-pricing";
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
  UserRegistrationEditableInput,
  UserRegistrationPersonalInput,
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

function parseStringIdList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return [...new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean))];
}

function emptyBillingFields() {
  return {
    billingStatus: "trial" as BillingStatus,
    billingMethod: null as BillingMethod | null,
    asaasCustomerId: null as string | null,
    asaasSubscriptionId: null as string | null,
    asaasInstallmentId: null as string | null,
    asaasPrimaryPaymentId: null as string | null,
    billingFirstDueDate: null as string | null,
    pendingBoletoUrl: null as string | null,
    pendingBoletoLinhaDigitavel: null as string | null,
    pendingBoletoDueDate: null as string | null,
    pendingBoletoValue: null as number | null,
    pendingPixPayload: null as string | null,
    pendingPixQrImage: null as string | null,
    pendingPixExpiration: null as string | null,
    paidInstallments: 0,
    lastPaidPaymentId: null as string | null,
    lastPaidAt: null as string | null,
    lastNfsPdfUrl: null as string | null,
    lastNfsXmlUrl: null as string | null,
    lastNfsNumber: null as string | null,
    lastNfsStatus: null as string | null,
    lastNfsEmailSentFor: null as string | null,
    scheduledNfsPaymentIds: [] as string[],
  };
}

function mapBillingFields(data: DocumentData) {
  const paid = Number(data.paidInstallments ?? 0);
  return {
    billingStatus: parseBillingStatus(data.billingStatus),
    billingMethod: parseBillingMethod(data.billingMethod),
    asaasCustomerId: data.asaasCustomerId ? String(data.asaasCustomerId) : null,
    asaasSubscriptionId: data.asaasSubscriptionId
      ? String(data.asaasSubscriptionId)
      : null,
    asaasInstallmentId: data.asaasInstallmentId ? String(data.asaasInstallmentId) : null,
    asaasPrimaryPaymentId: data.asaasPrimaryPaymentId
      ? String(data.asaasPrimaryPaymentId)
      : null,
    billingFirstDueDate: data.billingFirstDueDate
      ? String(data.billingFirstDueDate).slice(0, 10)
      : null,
    pendingBoletoUrl: data.pendingBoletoUrl ? String(data.pendingBoletoUrl) : null,
    pendingBoletoLinhaDigitavel: data.pendingBoletoLinhaDigitavel
      ? String(data.pendingBoletoLinhaDigitavel)
      : null,
    pendingBoletoDueDate: data.pendingBoletoDueDate
      ? String(data.pendingBoletoDueDate)
      : null,
    pendingBoletoValue:
      data.pendingBoletoValue == null || data.pendingBoletoValue === ""
        ? null
        : Number(data.pendingBoletoValue),
    pendingPixPayload: data.pendingPixPayload ? String(data.pendingPixPayload) : null,
    pendingPixQrImage: data.pendingPixQrImage ? String(data.pendingPixQrImage) : null,
    pendingPixExpiration: data.pendingPixExpiration
      ? String(data.pendingPixExpiration)
      : null,
    paidInstallments: Number.isFinite(paid) && paid > 0 ? Math.floor(paid) : 0,
    lastPaidPaymentId: data.lastPaidPaymentId ? String(data.lastPaidPaymentId) : null,
    lastPaidAt: data.lastPaidAt ? String(data.lastPaidAt) : null,
    lastNfsPdfUrl: data.lastNfsPdfUrl ? String(data.lastNfsPdfUrl) : null,
    lastNfsXmlUrl: data.lastNfsXmlUrl ? String(data.lastNfsXmlUrl) : null,
    lastNfsNumber: data.lastNfsNumber ? String(data.lastNfsNumber) : null,
    lastNfsStatus: data.lastNfsStatus ? String(data.lastNfsStatus) : null,
    lastNfsEmailSentFor: data.lastNfsEmailSentFor
      ? String(data.lastNfsEmailSentFor)
      : null,
    scheduledNfsPaymentIds: parseStringIdList(data.scheduledNfsPaymentIds),
  };
}

function billingFieldsFromRegistration(existing: UserRegistration) {
  return {
    billingStatus: existing.billingStatus,
    billingMethod: existing.billingMethod,
    asaasCustomerId: existing.asaasCustomerId,
    asaasSubscriptionId: existing.asaasSubscriptionId,
    asaasInstallmentId: existing.asaasInstallmentId,
    asaasPrimaryPaymentId: existing.asaasPrimaryPaymentId,
    billingFirstDueDate: existing.billingFirstDueDate,
    pendingBoletoUrl: existing.pendingBoletoUrl,
    pendingBoletoLinhaDigitavel: existing.pendingBoletoLinhaDigitavel,
    pendingBoletoDueDate: existing.pendingBoletoDueDate,
    pendingBoletoValue: existing.pendingBoletoValue,
    pendingPixPayload: existing.pendingPixPayload,
    pendingPixQrImage: existing.pendingPixQrImage,
    pendingPixExpiration: existing.pendingPixExpiration,
    paidInstallments: existing.paidInstallments,
    lastPaidPaymentId: existing.lastPaidPaymentId,
    lastPaidAt: existing.lastPaidAt,
    lastNfsPdfUrl: existing.lastNfsPdfUrl,
    lastNfsXmlUrl: existing.lastNfsXmlUrl,
    lastNfsNumber: existing.lastNfsNumber,
    lastNfsStatus: existing.lastNfsStatus,
    lastNfsEmailSentFor: existing.lastNfsEmailSentFor,
    scheduledNfsPaymentIds: existing.scheduledNfsPaymentIds,
  };
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
    ...mapBillingFields(data),
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
    ...emptyBillingFields(),
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
 * Busca cadastro completo/reserva pelo CPF (apenas dígitos).
 * Aceita docs legados com CPF mascarado.
 */
export async function findRegistrationByCpf(input: {
  cpf: string;
  excludeOwnerUserId?: string;
}): Promise<UserRegistration | null> {
  const cpfDigits = input.cpf.replace(/\D/g, "");
  if (cpfDigits.length !== 11) {
    return null;
  }

  const formatted = `${cpfDigits.slice(0, 3)}.${cpfDigits.slice(3, 6)}.${cpfDigits.slice(6, 9)}-${cpfDigits.slice(9)}`;
  const snap = await col(COLLECTIONS.userRegistrations)
    .where("cpf", "in", [cpfDigits, formatted])
    .limit(10)
    .get();

  for (const doc of snap.docs) {
    if (input.excludeOwnerUserId && doc.id === input.excludeOwnerUserId) {
      continue;
    }
    const row = mapDoc(doc.id, doc.data());
    if (!row) {
      continue;
    }
    if (row.status === "complete" || row.status === "reserve") {
      return row;
    }
  }

  return null;
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
    ...emptyBillingFields(),
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

/** Dados pessoais mínimos preenchidos (ainda pode faltar o plano). */
export function hasRegistrationPersonalData(
  registration: UserRegistration | null | undefined,
): boolean {
  if (!registration) {
    return false;
  }
  return Boolean(
    registration.fullName.trim() &&
      registration.party.trim() &&
      registration.cpf.trim() &&
      registration.uf.trim() &&
      registration.role.trim() &&
      registration.address.trim() &&
      registration.phone.trim() &&
      registration.email.trim(),
  );
}

/** Cadastro incompleto com dados ok — falta só escolher o plano. */
export function needsPlanSelection(
  registration: UserRegistration | null | undefined,
): boolean {
  return (
    Boolean(registration) &&
    !isUserRegistrationComplete(registration) &&
    hasRegistrationPersonalData(registration) &&
    !registration?.planId
  );
}

/** Grava dados pessoais sem concluir a reserva (sem plano ainda). */
export async function saveUserRegistrationPersonalData(input: {
  data: UserRegistrationPersonalInput;
  profileId?: string | null;
}): Promise<UserRegistration> {
  const ownerUserId = resolveOwnerUserId();
  const existing = await readRegistrationDoc(ownerUserId);
  const now = nowIso();
  const email = input.data.email.trim().toLowerCase();
  const party = normalizePartyKey(input.data.party);
  const uf = normalizeUfKey(input.data.uf);

  const row: UserRegistration = {
    ownerUserId,
    profileId: input.profileId ?? existing?.profileId ?? null,
    status: "incomplete",
    fullName: input.data.fullName.trim(),
    party,
    cpf: input.data.cpf.replace(/\D/g, ""),
    uf,
    role: input.data.role.trim(),
    address: input.data.address.trim(),
    phone: input.data.phone.replace(/\D/g, ""),
    email,
    teamEmail: input.data.teamEmail.trim(),
    teamPhone: input.data.teamPhone.replace(/\D/g, ""),
    planId: "",
    ...(existing ? billingFieldsFromRegistration(existing) : emptyBillingFields()),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    completedAt: null,
  };

  await col(COLLECTIONS.userRegistrations).doc(ownerUserId).set(row, { merge: true });
  return row;
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
    cpf: input.data.cpf.replace(/\D/g, ""),
    uf,
    role: input.data.role.trim(),
    address: input.data.address.trim(),
    phone: input.data.phone.replace(/\D/g, ""),
    email,
    teamEmail: input.data.teamEmail.trim(),
    teamPhone: input.data.teamPhone.replace(/\D/g, ""),
    planId: input.data.planId,
    ...(existing ? billingFieldsFromRegistration(existing) : emptyBillingFields()),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    completedAt: existing?.completedAt ?? now,
  };

  await col(COLLECTIONS.userRegistrations).doc(ownerUserId).set(row, { merge: true });
  return { registration: row, seat };
}

/** Associa o plano e conclui a reserva (após dados pessoais já salvos). */
export async function assignUserRegistrationPlan(
  planId: EarlyAccessPlanId,
): Promise<{ registration: UserRegistration; seat: SeatAssignment }> {
  const ownerUserId = resolveOwnerUserId();
  const existing = await readRegistrationDoc(ownerUserId);

  if (!existing || !hasRegistrationPersonalData(existing)) {
    throw new Error("Preencha os dados pessoais antes de escolher o plano.");
  }

  if (isUserRegistrationComplete(existing) && existing.planId) {
    throw new Error("Sua reserva ja possui um plano definido.");
  }

  const seat = await resolveSeatAssignment({
    planId,
    party: existing.party,
    uf: existing.uf,
    ownerUserId,
    existingStatus: existing.status,
  });

  const now = nowIso();
  const row: UserRegistration = {
    ...existing,
    status: seat.status,
    planId,
    updatedAt: now,
    completedAt: existing.completedAt ?? now,
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

  return updateUserRegistrationEditableFields({
    party: existing.party,
    uf: existing.uf,
    role: existing.role,
    address: existing.address,
    phone: existing.phone,
    email: existing.email,
    teamEmail: input.teamEmail,
    teamPhone: input.teamPhone,
  });
}

/**
 * Atualiza campos editáveis do cadastro completo.
 * Preserva fullName, cpf e status da vaga (partido/UF não reavaliam assento).
 */
export async function updateUserRegistrationEditableFields(
  input: UserRegistrationEditableInput,
): Promise<UserRegistration> {
  const ownerUserId = resolveOwnerUserId();
  const existing = await readRegistrationDoc(ownerUserId);
  if (!existing || !isUserRegistrationComplete(existing)) {
    throw new Error("Cadastro incompleto. Preencha os dados pessoais primeiro.");
  }

  const email = input.email.trim().toLowerCase();
  if (!email) {
    throw new Error("Informe um e-mail.");
  }

  const updated: UserRegistration = {
    ...existing,
    party: normalizePartyKey(input.party),
    uf: normalizeUfKey(input.uf),
    role: input.role.trim(),
    address: input.address.trim(),
    phone: input.phone.replace(/\D/g, ""),
    email,
    teamEmail: input.teamEmail.trim(),
    teamPhone: input.teamPhone.replace(/\D/g, ""),
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

export type UserBillingUpdate = Partial<{
  billingStatus: BillingStatus;
  billingMethod: BillingMethod | null;
  asaasCustomerId: string | null;
  asaasSubscriptionId: string | null;
  asaasInstallmentId: string | null;
  asaasPrimaryPaymentId: string | null;
  billingFirstDueDate: string | null;
  pendingBoletoUrl: string | null;
  pendingBoletoLinhaDigitavel: string | null;
  pendingBoletoDueDate: string | null;
  pendingBoletoValue: number | null;
  pendingPixPayload: string | null;
  pendingPixQrImage: string | null;
  pendingPixExpiration: string | null;
  paidInstallments: number;
  lastPaidPaymentId: string | null;
  lastPaidAt: string | null;
  planId: EarlyAccessPlanId;
  lastNfsPdfUrl: string | null;
  lastNfsXmlUrl: string | null;
  lastNfsNumber: string | null;
  lastNfsStatus: string | null;
  lastNfsEmailSentFor: string | null;
  scheduledNfsPaymentIds: string[];
}>;

export async function updateUserRegistrationBilling(
  ownerUserId: string,
  patch: UserBillingUpdate,
): Promise<UserRegistration> {
  const id = toDatabaseOwnerUserId(ownerUserId);
  const existing = await readRegistrationDoc(id);
  if (!existing) {
    throw new Error("Cadastro nao encontrado para atualizar cobranca.");
  }

  const updated: UserRegistration = {
    ...existing,
    ...patch,
    updatedAt: nowIso(),
  };

  await col(COLLECTIONS.userRegistrations).doc(id).set(updated, { merge: true });
  return updated;
}

export async function findRegistrationByAsaasCustomerId(
  asaasCustomerId: string,
): Promise<UserRegistration | null> {
  const trimmed = asaasCustomerId.trim();
  if (!trimmed) {
    return null;
  }
  const snap = await col(COLLECTIONS.userRegistrations)
    .where("asaasCustomerId", "==", trimmed)
    .limit(1)
    .get();
  if (snap.empty) {
    return null;
  }
  const doc = snap.docs[0];
  return mapDoc(doc.id, doc.data());
}

export function isBillingActive(
  registration: UserRegistration | null | undefined,
): boolean {
  return registration?.billingStatus === "active";
}
