import {
  extractComplianceStoragePathFromUrl,
  isGcsSignedUrlExpired,
} from "@/lib/legal/compliance-video-url";
import { refreshComplianceReadUrl } from "@/lib/legal/contract-storage";

export async function resolveFreshComplianceVideoUrl(input: {
  videoUrl: string;
  storagePath?: string | null;
}): Promise<{ videoUrl: string; storagePath: string | null; refreshed: boolean }> {
  const videoUrl = input.videoUrl.trim();
  const storagePath =
    input.storagePath?.trim() || extractComplianceStoragePathFromUrl(videoUrl) || null;

  if (!storagePath) {
    return { videoUrl, storagePath: null, refreshed: false };
  }

  const fresh = await refreshComplianceReadUrl(storagePath);
  if (!fresh) {
    throw new Error(
      "O video selado nao esta mais acessivel no armazenamento. Gere o criativo novamente.",
    );
  }

  return { videoUrl: fresh, storagePath, refreshed: true };
}

/** Para listagem/prévia: só assina de novo se a URL GCS já venceu. */
export async function refreshComplianceVideoUrlIfExpired(input: {
  videoUrl: string;
  storagePath?: string | null;
}): Promise<{ videoUrl: string; storagePath: string | null }> {
  const videoUrl = input.videoUrl.trim();
  const storagePath =
    input.storagePath?.trim() || extractComplianceStoragePathFromUrl(videoUrl) || null;

  if (!storagePath || !isGcsSignedUrlExpired(videoUrl)) {
    return { videoUrl, storagePath };
  }

  try {
    return await resolveFreshComplianceVideoUrl({ videoUrl, storagePath });
  } catch {
    return { videoUrl, storagePath };
  }
}
