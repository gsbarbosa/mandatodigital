import { createHash, createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { getAdminSessionSecret } from "@/lib/admin/credentials";
import {
  type EditableProviderId,
  type PoolProviderId,
  type ProviderKeyPublic,
  PROVIDER_ENV_KEYS,
  PROVIDER_MAX_KEYS,
  isPoolProviderId,
} from "@/lib/admin/provider-catalog";
import { COLLECTIONS, col } from "@/lib/firebase/collections";

export {
  EDITABLE_PROVIDER_IDS,
  type EditableProviderId,
  type PoolProviderId,
  type ProviderKeyPublic,
  PROVIDER_ENV_KEYS,
  PROVIDER_MAX_KEYS,
  isEditableProviderId,
  isPoolProviderId,
} from "@/lib/admin/provider-catalog";

export type StoredProviderKey = {
  id: string;
  encryptedToken: string;
  tokenHint: string;
  label: string;
  enabled: boolean;
  cooldownUntil: string | null;
  cooldownReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminProviderSecretRecord = {
  providerId: EditableProviderId;
  keys: StoredProviderKey[];
  updatedAt: string;
  updatedBy: string;
  /** Legado single-key — migrado on-read. */
  encryptedToken?: string;
  tokenHint?: string;
};

export type ResolvedProviderKey = {
  token: string;
  hint: string;
  source: "override" | "env";
  keyId: string;
  label: string;
};

const QUOTA_COOLDOWN_MS = 15 * 60 * 1000;

function deriveKey() {
  return createHash("sha256").update(`md-provider-secret:${getAdminSessionSecret()}`).digest();
}

export function encryptProviderSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptProviderSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Segredo de provedor inválido no store.");
  }
  const decipher = createDecipheriv("aes-256-gcm", deriveKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function tokenHint(token: string) {
  const trimmed = token.trim();
  if (trimmed.length <= 4) {
    return "****";
  }
  return `…${trimmed.slice(-4)}`;
}

function newKeyId() {
  return `pk_${randomBytes(8).toString("hex")}`;
}

function isInCooldown(key: StoredProviderKey, now = Date.now()) {
  if (!key.cooldownUntil) {
    return false;
  }
  const until = Date.parse(key.cooldownUntil);
  return Number.isFinite(until) && until > now;
}

export function getEnvTokenForProvider(providerId: EditableProviderId): string {
  for (const key of PROVIDER_ENV_KEYS[providerId]) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }
  return "";
}

function migrateLegacyRecord(
  providerId: EditableProviderId,
  data: AdminProviderSecretRecord,
): AdminProviderSecretRecord {
  if (Array.isArray(data.keys) && data.keys.length > 0) {
    return data;
  }
  if (!data.encryptedToken) {
    return {
      providerId,
      keys: [],
      updatedAt: data.updatedAt || new Date().toISOString(),
      updatedBy: data.updatedBy || "system",
    };
  }
  const now = data.updatedAt || new Date().toISOString();
  return {
    providerId,
    updatedAt: now,
    updatedBy: data.updatedBy || "system",
    keys: [
      {
        id: "legacy",
        encryptedToken: data.encryptedToken,
        tokenHint: data.tokenHint || "…****",
        label: "Principal",
        enabled: true,
        cooldownUntil: null,
        cooldownReason: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
  };
}

async function readSecretDoc(
  providerId: EditableProviderId,
): Promise<AdminProviderSecretRecord | null> {
  const snap = await col(COLLECTIONS.adminProviderSecrets).doc(providerId).get();
  if (!snap.exists) {
    return null;
  }
  const raw = snap.data() as AdminProviderSecretRecord | undefined;
  if (!raw) {
    return null;
  }
  return migrateLegacyRecord(providerId, raw);
}

async function writeSecretDoc(record: AdminProviderSecretRecord) {
  const payload: AdminProviderSecretRecord = {
    providerId: record.providerId,
    keys: record.keys,
    updatedAt: record.updatedAt,
    updatedBy: record.updatedBy,
  };
  await col(COLLECTIONS.adminProviderSecrets).doc(record.providerId).set(payload);
}

function decryptKeyRow(row: StoredProviderKey): string | null {
  try {
    const token = decryptProviderSecret(row.encryptedToken).trim();
    return token || null;
  } catch (error) {
    console.warn("[admin-provider-secrets] falha ao descriptografar key:", row.id, error);
    return null;
  }
}

export async function listProviderKeyPublic(
  providerId: EditableProviderId,
): Promise<ProviderKeyPublic[]> {
  try {
    const doc = await readSecretDoc(providerId);
    if (!doc?.keys.length) {
      return [];
    }
    return doc.keys.map((row) => ({
      id: row.id,
      hint: row.tokenHint,
      label: row.label || "Key",
      enabled: row.enabled,
      cooldownUntil: row.cooldownUntil,
      cooldownReason: row.cooldownReason,
      source: "override" as const,
      updatedAt: row.updatedAt,
    }));
  } catch {
    return [];
  }
}

/** Lista candidatos usable (override enabled + fora de cooldown, depois env). */
export async function listProviderKeyCandidates(
  providerId: EditableProviderId,
): Promise<ResolvedProviderKey[]> {
  const candidates: ResolvedProviderKey[] = [];
  const now = Date.now();

  try {
    const doc = await readSecretDoc(providerId);
    for (const row of doc?.keys ?? []) {
      if (!row.enabled || isInCooldown(row, now)) {
        continue;
      }
      const token = decryptKeyRow(row);
      if (!token) {
        continue;
      }
      candidates.push({
        token,
        hint: row.tokenHint || tokenHint(token),
        source: "override",
        keyId: row.id,
        label: row.label || "Key",
      });
    }
  } catch {
    // Firestore indisponível — só env.
  }

  const envToken = getEnvTokenForProvider(providerId);
  if (envToken) {
    candidates.push({
      token: envToken,
      hint: tokenHint(envToken),
      source: "env",
      keyId: "env",
      label: "Environment",
    });
  }

  return candidates;
}

/** Compat: primeira key disponível. */
export async function resolveProviderApiKey(providerId: EditableProviderId): Promise<{
  token: string;
  source: "override" | "env" | "none";
  hint: string | null;
  keyId?: string;
}> {
  const candidates = await listProviderKeyCandidates(providerId);
  const first = candidates[0];
  if (!first) {
    return { token: "", source: "none", hint: null };
  }
  return {
    token: first.token,
    source: first.source,
    hint: first.hint,
    keyId: first.keyId,
  };
}

/** @deprecated single-key read */
export async function readProviderSecretOverride(
  providerId: EditableProviderId,
): Promise<{
  token: string;
  hint: string;
  updatedAt: string;
} | null> {
  const resolved = await resolveProviderApiKey(providerId);
  if (resolved.source !== "override" || !resolved.token) {
    return null;
  }
  return {
    token: resolved.token,
    hint: resolved.hint || tokenHint(resolved.token),
    updatedAt: new Date().toISOString(),
  };
}

export async function addProviderSecretKey(input: {
  providerId: EditableProviderId;
  token: string;
  updatedBy: string;
  label?: string;
}): Promise<{ key: ProviderKeyPublic; keys: ProviderKeyPublic[] }> {
  const token = input.token.trim();
  if (token.length < 16) {
    throw new Error("API key inválida (muito curta).");
  }

  const max = PROVIDER_MAX_KEYS[input.providerId];
  const existing = (await readSecretDoc(input.providerId)) ?? {
    providerId: input.providerId,
    keys: [] as StoredProviderKey[],
    updatedAt: new Date().toISOString(),
    updatedBy: input.updatedBy,
  };

  // Provedores single-key: substitui.
  if (max <= 1) {
    const now = new Date().toISOString();
    const row: StoredProviderKey = {
      id: existing.keys[0]?.id || newKeyId(),
      encryptedToken: encryptProviderSecret(token),
      tokenHint: tokenHint(token),
      label: input.label?.trim() || "Principal",
      enabled: true,
      cooldownUntil: null,
      cooldownReason: null,
      createdAt: existing.keys[0]?.createdAt || now,
      updatedAt: now,
    };
    await writeSecretDoc({
      providerId: input.providerId,
      keys: [row],
      updatedAt: now,
      updatedBy: input.updatedBy,
    });
    const keys = await listProviderKeyPublic(input.providerId);
    return { key: keys[0]!, keys };
  }

  if (existing.keys.length >= max) {
    throw new Error(`Limite de ${max} API keys atingido para este provedor.`);
  }

  // Dedup por hint+final chars — evita colar a mesma key duas vezes.
  for (const row of existing.keys) {
    const plain = decryptKeyRow(row);
    if (plain && plain === token) {
      throw new Error("Esta API key já está cadastrada no pool.");
    }
  }

  const now = new Date().toISOString();
  const row: StoredProviderKey = {
    id: newKeyId(),
    encryptedToken: encryptProviderSecret(token),
    tokenHint: tokenHint(token),
    label: input.label?.trim() || `Key ${existing.keys.length + 1}`,
    enabled: true,
    cooldownUntil: null,
    cooldownReason: null,
    createdAt: now,
    updatedAt: now,
  };

  await writeSecretDoc({
    providerId: input.providerId,
    keys: [...existing.keys, row],
    updatedAt: now,
    updatedBy: input.updatedBy,
  });

  const keys = await listProviderKeyPublic(input.providerId);
  return { key: keys.find((item) => item.id === row.id)!, keys };
}

/** Compat: save = add (ou replace se max=1). */
export async function writeProviderSecretOverride(input: {
  providerId: EditableProviderId;
  token: string;
  updatedBy: string;
}): Promise<{ hint: string; updatedAt: string }> {
  const result = await addProviderSecretKey(input);
  return { hint: result.key.hint, updatedAt: result.key.updatedAt };
}

export async function removeProviderSecretKey(input: {
  providerId: EditableProviderId;
  keyId: string;
  updatedBy: string;
}): Promise<{ keys: ProviderKeyPublic[] }> {
  const existing = await readSecretDoc(input.providerId);
  if (!existing) {
    return { keys: [] };
  }
  const keys = existing.keys.filter((row) => row.id !== input.keyId);
  await writeSecretDoc({
    providerId: input.providerId,
    keys,
    updatedAt: new Date().toISOString(),
    updatedBy: input.updatedBy,
  });
  return { keys: await listProviderKeyPublic(input.providerId) };
}

export async function setProviderSecretKeyEnabled(input: {
  providerId: EditableProviderId;
  keyId: string;
  enabled: boolean;
  updatedBy: string;
}): Promise<{ keys: ProviderKeyPublic[] }> {
  const existing = await readSecretDoc(input.providerId);
  if (!existing) {
    throw new Error("Nenhuma key cadastrada.");
  }
  const now = new Date().toISOString();
  const keys = existing.keys.map((row) =>
    row.id === input.keyId
      ? {
          ...row,
          enabled: input.enabled,
          cooldownUntil: input.enabled ? null : row.cooldownUntil,
          cooldownReason: input.enabled ? null : row.cooldownReason,
          updatedAt: now,
        }
      : row,
  );
  await writeSecretDoc({
    providerId: input.providerId,
    keys,
    updatedAt: now,
    updatedBy: input.updatedBy,
  });
  return { keys: await listProviderKeyPublic(input.providerId) };
}

export async function reorderProviderSecretKeys(input: {
  providerId: EditableProviderId;
  keyIds: string[];
  updatedBy: string;
}): Promise<{ keys: ProviderKeyPublic[] }> {
  const existing = await readSecretDoc(input.providerId);
  if (!existing) {
    return { keys: [] };
  }
  const byId = new Map(existing.keys.map((row) => [row.id, row]));
  const ordered: StoredProviderKey[] = [];
  for (const id of input.keyIds) {
    const row = byId.get(id);
    if (row) {
      ordered.push(row);
      byId.delete(id);
    }
  }
  for (const row of byId.values()) {
    ordered.push(row);
  }
  await writeSecretDoc({
    providerId: input.providerId,
    keys: ordered,
    updatedAt: new Date().toISOString(),
    updatedBy: input.updatedBy,
  });
  return { keys: await listProviderKeyPublic(input.providerId) };
}

export async function markProviderKeyCooldown(input: {
  providerId: EditableProviderId;
  keyId: string;
  reason: string;
  cooldownMs?: number;
}): Promise<void> {
  if (input.keyId === "env" || !isPoolProviderId(input.providerId)) {
    return;
  }
  try {
    const existing = await readSecretDoc(input.providerId);
    if (!existing) {
      return;
    }
    const now = Date.now();
    const until = new Date(now + (input.cooldownMs ?? QUOTA_COOLDOWN_MS)).toISOString();
    const keys = existing.keys.map((row) =>
      row.id === input.keyId
        ? {
            ...row,
            cooldownUntil: until,
            cooldownReason: input.reason,
            updatedAt: new Date().toISOString(),
          }
        : row,
    );
    await writeSecretDoc({
      providerId: input.providerId,
      keys,
      updatedAt: new Date().toISOString(),
      updatedBy: "failover",
    });
  } catch (error) {
    console.warn("[admin-provider-secrets] falha ao marcar cooldown:", error);
  }
}

export async function markProviderKeyInvalid(input: {
  providerId: EditableProviderId;
  keyId: string;
  reason?: string;
}): Promise<void> {
  if (input.keyId === "env") {
    return;
  }
  try {
    await setProviderSecretKeyEnabled({
      providerId: input.providerId,
      keyId: input.keyId,
      enabled: false,
      updatedBy: "failover",
    });
    const existing = await readSecretDoc(input.providerId);
    if (!existing) {
      return;
    }
    const keys = existing.keys.map((row) =>
      row.id === input.keyId
        ? {
            ...row,
            enabled: false,
            cooldownReason: input.reason || "invalid",
            updatedAt: new Date().toISOString(),
          }
        : row,
    );
    await writeSecretDoc({
      providerId: input.providerId,
      keys,
      updatedAt: new Date().toISOString(),
      updatedBy: "failover",
    });
  } catch (error) {
    console.warn("[admin-provider-secrets] falha ao invalidar key:", error);
  }
}

export async function clearProviderSecretOverride(providerId: EditableProviderId) {
  await col(COLLECTIONS.adminProviderSecrets).doc(providerId).delete();
}

/** @deprecated */
export async function readApifySecretOverride() {
  return readProviderSecretOverride("apify");
}

/** @deprecated */
export async function writeApifySecretOverride(input: {
  token: string;
  updatedBy: string;
}) {
  return writeProviderSecretOverride({
    providerId: "apify",
    token: input.token,
    updatedBy: input.updatedBy,
  });
}

/** @deprecated */
export async function clearApifySecretOverride() {
  return clearProviderSecretOverride("apify");
}

export type { PoolProviderId as ProviderPoolId };
