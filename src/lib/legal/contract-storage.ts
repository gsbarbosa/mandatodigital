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

  const [signedUrl] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + COMPLIANCE_SIGNED_URL_TTL_MS,
  });

  return { storagePath, publicUrl: signedUrl };
}

export async function saveContractAcceptance(row: ContractAcceptanceRow) {
  await col(COLLECTIONS.contractAcceptances).doc(row.id).set(row);
}

export function resolveContractOwnerUserId() {
  return getStorageOwnerUserId()?.trim() || "";
}
