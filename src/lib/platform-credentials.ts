import {
  PLATFORM_CREDENTIAL_IDS,
  readPlatformCredentialFromEnv,
  type PlatformCredentialId,
} from "@/lib/platform-credential-registry";
import { platformCredentialStorage } from "@/lib/platform-credential-storage";

const CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry = {
  value: string;
  expiresAt: number;
};

const credentialCache = new Map<PlatformCredentialId, CacheEntry>();
let preloadPromise: Promise<void> | null = null;

export function invalidatePlatformCredentialCache(serviceId?: PlatformCredentialId) {
  if (serviceId) {
    credentialCache.delete(serviceId);
    return;
  }
  credentialCache.clear();
}

export function readPlatformCredentialCached(serviceId: PlatformCredentialId): string {
  const fromEnv = readPlatformCredentialFromEnv(serviceId);
  if (fromEnv) {
    return fromEnv;
  }

  const cached = credentialCache.get(serviceId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  return "";
}

export async function resolvePlatformCredential(
  serviceId: PlatformCredentialId,
): Promise<string> {
  const fromEnv = readPlatformCredentialFromEnv(serviceId);
  if (fromEnv) {
    return fromEnv;
  }

  const cached = credentialCache.get(serviceId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const fromDb = await platformCredentialStorage.readDecryptedCredential(serviceId);
  const value = fromDb?.trim() ?? "";

  if (value) {
    credentialCache.set(serviceId, {
      value,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  }

  return value;
}

export async function preloadPlatformCredentials(
  serviceIds: readonly PlatformCredentialId[] = PLATFORM_CREDENTIAL_IDS,
) {
  await Promise.all(serviceIds.map((serviceId) => resolvePlatformCredential(serviceId)));
}

export function schedulePlatformCredentialPreload(
  serviceIds: readonly PlatformCredentialId[] = PLATFORM_CREDENTIAL_IDS,
) {
  if (!preloadPromise) {
    preloadPromise = preloadPlatformCredentials(serviceIds).finally(() => {
      preloadPromise = null;
    });
  }
  return preloadPromise;
}

export async function listPlatformCredentialStatuses() {
  const envReaders = Object.fromEntries(
    PLATFORM_CREDENTIAL_IDS.map((id) => [id, readPlatformCredentialFromEnv(id)]),
  ) as Record<PlatformCredentialId, string>;

  return platformCredentialStorage.listStatuses(PLATFORM_CREDENTIAL_IDS, envReaders);
}
