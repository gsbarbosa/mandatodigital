import { promises as fs } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import {
  assertLocalFilesystemAllowed,
  canUseLocalFilesystem,
  supabaseSchemaOutdatedMessage,
} from "@/lib/server-runtime";
import { getStorageOwnerUserId } from "@/lib/storage-context";

const LOCAL_DIR = path.join(process.cwd(), "data", "compliance");
const LOCAL_DB = path.join(process.cwd(), "data", "mandato-digital.json");

export type ContractAcceptanceRow = {
  id: string;
  ownerUserId: string;
  campaignName: string;
  campaignCnpj: string;
  campaignAddress: string;
  financialResponsible: string;
  email: string;
  planId: string;
  amountCents: number;
  naturezaJuridica: string;
  ip: string;
  userAgent: string;
  acceptedAt: string;
  contractTextHash: string;
  dossierTextHash: string;
  contractTemplateVersion: string;
  dossierTemplateVersion: string;
  contractPdfPath: string;
  dossierPdfPath: string;
  emailSent: boolean;
};

type LocalDatabase = {
  contractAcceptances?: ContractAcceptanceRow[];
  [key: string]: unknown;
};

function isSupabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorios.");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function isSchemaCompatibilityError(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return false;
  }
  const code = String(error.code);
  return code === "PGRST205" || code === "PGRST204" || code === "42703" || code === "42P01";
}

function getComplianceBucket() {
  return process.env.SUPABASE_COMPLIANCE_BUCKET?.trim() || process.env.SUPABASE_TRAINING_ASSETS_BUCKET?.trim() || "persona-training-videos";
}

async function readLocalDatabase(): Promise<LocalDatabase> {
  try {
    const raw = await fs.readFile(LOCAL_DB, "utf8");
    return raw.trim() ? (JSON.parse(raw) as LocalDatabase) : {};
  } catch {
    return {};
  }
}

async function writeLocalDatabase(database: LocalDatabase) {
  assertLocalFilesystemAllowed();
  await fs.mkdir(path.dirname(LOCAL_DB), { recursive: true });
  await fs.writeFile(LOCAL_DB, JSON.stringify(database, null, 2));
}

export async function storeComplianceBuffer(input: {
  relativePath: string;
  buffer: Buffer;
  mimeType: string;
}) {
  if (isSupabaseConfigured()) {
    const client = getSupabaseClient();
    const bucket = getComplianceBucket();
    const storagePath = `compliance/${input.relativePath}`;
    const { error } = await client.storage.from(bucket).upload(storagePath, input.buffer, {
      contentType: input.mimeType,
      upsert: true,
    });
    if (error) {
      throw new Error(error.message);
    }

    const { data: signed, error: signedError } = await client.storage
      .from(bucket)
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

    if (signedError || !signed?.signedUrl) {
      const { data } = client.storage.from(bucket).getPublicUrl(storagePath);
      return { storagePath, publicUrl: data.publicUrl };
    }

    return { storagePath, publicUrl: signed.signedUrl };
  }

  assertLocalFilesystemAllowed();
  const fullPath = path.join(LOCAL_DIR, input.relativePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, input.buffer);
  return {
    storagePath: fullPath,
    publicUrl: `/api/compliance/files?path=${encodeURIComponent(input.relativePath)}`,
  };
}

export async function saveContractAcceptance(row: ContractAcceptanceRow) {
  if (isSupabaseConfigured()) {
    const client = getSupabaseClient();
    const { error } = await client.from("contract_acceptances").insert({
      id: row.id,
      owner_user_id: row.ownerUserId,
      campaign_name: row.campaignName,
      campaign_cnpj: row.campaignCnpj,
      campaign_address: row.campaignAddress,
      financial_responsible: row.financialResponsible,
      email: row.email,
      plan_id: row.planId,
      amount_cents: row.amountCents,
      natureza_juridica: row.naturezaJuridica,
      ip: row.ip,
      user_agent: row.userAgent,
      accepted_at: row.acceptedAt,
      contract_text_hash: row.contractTextHash,
      dossier_text_hash: row.dossierTextHash,
      contract_template_version: row.contractTemplateVersion,
      dossier_template_version: row.dossierTemplateVersion,
      contract_pdf_path: row.contractPdfPath,
      dossier_pdf_path: row.dossierPdfPath,
      email_sent: row.emailSent,
    });

    if (error) {
      if (isSchemaCompatibilityError(error) && canUseLocalFilesystem()) {
        const database = await readLocalDatabase();
        database.contractAcceptances = [row, ...(database.contractAcceptances ?? [])];
        await writeLocalDatabase(database);
        return;
      }
      if (isSchemaCompatibilityError(error)) {
        throw new Error(supabaseSchemaOutdatedMessage(error));
      }
      throw error;
    }
    return;
  }

  assertLocalFilesystemAllowed();
  const database = await readLocalDatabase();
  database.contractAcceptances = [row, ...(database.contractAcceptances ?? [])];
  await writeLocalDatabase(database);
}

export function resolveContractOwnerUserId() {
  return getStorageOwnerUserId()?.trim() || "";
}
