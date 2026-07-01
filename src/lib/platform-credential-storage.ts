import { createClient } from "@supabase/supabase-js";

import {
  decryptPlatformCredential,
  encryptPlatformCredential,
} from "@/lib/platform-credential-crypto";
import {
  maskPlatformCredential,
  type PlatformCredentialId,
} from "@/lib/platform-credential-registry";

export type PlatformCredentialRow = {
  service_id: string;
  ciphertext: string;
  iv: string;
  auth_tag: string;
  masked_hint: string;
  updated_by_email: string;
  updated_at: string;
  last_tested_at: string | null;
  last_test_status: string;
  last_test_message: string;
};

export type PlatformCredentialPublicStatus = {
  serviceId: PlatformCredentialId;
  configured: boolean;
  source: "env" | "database" | "none";
  maskedHint: string;
  updatedAt: string | null;
  updatedByEmail: string;
  lastTestedAt: string | null;
  lastTestStatus: string;
  lastTestMessage: string;
};

function getSupabaseAdminClient() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !key) {
    return null;
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function mapRowToPublicStatus(
  serviceId: PlatformCredentialId,
  row: PlatformCredentialRow | null,
  envConfigured: boolean,
): PlatformCredentialPublicStatus {
  if (envConfigured) {
    return {
      serviceId,
      configured: true,
      source: "env",
      maskedHint: "via ambiente",
      updatedAt: null,
      updatedByEmail: "",
      lastTestedAt: row?.last_tested_at ?? null,
      lastTestStatus: row?.last_test_status ?? "",
      lastTestMessage: row?.last_test_message ?? "",
    };
  }

  if (!row) {
    return {
      serviceId,
      configured: false,
      source: "none",
      maskedHint: "",
      updatedAt: null,
      updatedByEmail: "",
      lastTestedAt: null,
      lastTestStatus: "",
      lastTestMessage: "",
    };
  }

  return {
    serviceId,
    configured: true,
    source: "database",
    maskedHint: row.masked_hint,
    updatedAt: row.updated_at,
    updatedByEmail: row.updated_by_email,
    lastTestedAt: row.last_tested_at,
    lastTestStatus: row.last_test_status,
    lastTestMessage: row.last_test_message,
  };
}

export const platformCredentialStorage = {
  async listStatuses(
    serviceIds: readonly PlatformCredentialId[],
    envReaders: Record<PlatformCredentialId, string>,
  ): Promise<PlatformCredentialPublicStatus[]> {
    const client = getSupabaseAdminClient();
    const rowsById = new Map<string, PlatformCredentialRow>();

    if (client) {
      const { data, error } = await client
        .from("platform_credentials")
        .select("*")
        .in("service_id", serviceIds);

      if (error) {
        throw new Error(error.message);
      }

      for (const row of (data ?? []) as PlatformCredentialRow[]) {
        rowsById.set(row.service_id, row);
      }
    }

    return serviceIds.map((serviceId) =>
      mapRowToPublicStatus(
        serviceId,
        rowsById.get(serviceId) ?? null,
        Boolean(envReaders[serviceId]?.trim()),
      ),
    );
  },

  async readDecryptedCredential(serviceId: PlatformCredentialId): Promise<string | null> {
    const client = getSupabaseAdminClient();
    if (!client) {
      return null;
    }

    const { data, error } = await client
      .from("platform_credentials")
      .select("*")
      .eq("service_id", serviceId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    const row = data as PlatformCredentialRow | null;
    if (!row) {
      return null;
    }

    return decryptPlatformCredential({
      ciphertext: row.ciphertext,
      iv: row.iv,
      authTag: row.auth_tag,
    });
  },

  async upsertCredential(input: {
    serviceId: PlatformCredentialId;
    plaintext: string;
    updatedByEmail: string;
  }) {
    const client = getSupabaseAdminClient();
    if (!client) {
      throw new Error(
        "Supabase nao configurado. Nao e possivel salvar integracoes na base.",
      );
    }

    const encrypted = encryptPlatformCredential(input.plaintext.trim());
    const maskedHint = maskPlatformCredential(input.plaintext);

    const { error } = await client.from("platform_credentials").upsert(
      {
        service_id: input.serviceId,
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        auth_tag: encrypted.authTag,
        masked_hint: maskedHint,
        updated_by_email: input.updatedByEmail,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "service_id" },
    );

    if (error) {
      throw new Error(error.message);
    }

    return maskedHint;
  },

  async deleteCredential(serviceId: PlatformCredentialId) {
    const client = getSupabaseAdminClient();
    if (!client) {
      throw new Error("Supabase nao configurado.");
    }

    const { error } = await client
      .from("platform_credentials")
      .delete()
      .eq("service_id", serviceId);

    if (error) {
      throw new Error(error.message);
    }
  },

  async recordTestResult(input: {
    serviceId: PlatformCredentialId;
    status: "ok" | "error";
    message: string;
  }) {
    const client = getSupabaseAdminClient();
    if (!client) {
      return;
    }

    await client
      .from("platform_credentials")
      .update({
        last_tested_at: new Date().toISOString(),
        last_test_status: input.status,
        last_test_message: input.message.slice(0, 500),
      })
      .eq("service_id", input.serviceId);
  },
};
