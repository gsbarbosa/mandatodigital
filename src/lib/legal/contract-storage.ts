import { getFirebaseAdminBucket } from "@/lib/firebase/admin";
import { COLLECTIONS, col } from "@/lib/firebase/collections";
import { getStorageOwnerUserId } from "@/lib/storage-context";

const COMPLIANCE_SIGNED_URL_TTL_MS = 60 * 60 * 24 * 7 * 1000;

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

export async function storeComplianceBuffer(input: {
  relativePath: string;
  buffer: Buffer;
  mimeType: string;
}) {
  const storagePath = `compliance/${input.relativePath}`;
  const bucket = getFirebaseAdminBucket();
  const file = bucket.file(storagePath);

  await file.save(input.buffer, {
    resumable: false,
    contentType: input.mimeType,
    metadata: {
      contentType: input.mimeType,
      cacheControl: "private, max-age=3600",
    },
  });

  const publicUrl = await signComplianceReadUrl(storagePath);
  return { storagePath, publicUrl };
}

export async function signComplianceReadUrl(storagePath: string) {
  const path = storagePath.trim();
  if (!path) {
    throw new Error("storagePath ausente para assinar o arquivo de compliance.");
  }
  const bucket = getFirebaseAdminBucket();
  const file = bucket.file(path);
  const [signedUrl] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + COMPLIANCE_SIGNED_URL_TTL_MS,
  });
  return signedUrl;
}

/** Renova a URL de leitura. GCS v4 dura no máximo 7 dias. */
export async function refreshComplianceReadUrl(storagePath: string): Promise<string | null> {
  const path = storagePath.trim();
  if (!path) {
    return null;
  }
  const bucket = getFirebaseAdminBucket();
  const file = bucket.file(path);
  const [exists] = await file.exists();
  if (!exists) {
    return null;
  }
  return signComplianceReadUrl(path);
}

export async function saveContractAcceptance(row: ContractAcceptanceRow) {
  await col(COLLECTIONS.contractAcceptances).doc(row.id).set(row);
}

/** Último aceite de contrato do owner (CNPJ/endereço de campanha). */
export async function getLatestContractAcceptanceForOwner(
  ownerUserId: string,
): Promise<ContractAcceptanceRow | null> {
  const uid = ownerUserId.trim();
  if (!uid) {
    return null;
  }

  const snap = await col(COLLECTIONS.contractAcceptances)
    .where("ownerUserId", "==", uid)
    .limit(25)
    .get();

  if (snap.empty) {
    return null;
  }

  const rows = snap.docs
    .map((doc) => doc.data() as ContractAcceptanceRow)
    .filter((row) => row?.campaignCnpj)
    .sort((a, b) => String(b.acceptedAt ?? "").localeCompare(String(a.acceptedAt ?? "")));

  return rows[0] ?? null;
}

export function resolveContractOwnerUserId() {
  return getStorageOwnerUserId()?.trim() || "";
}
