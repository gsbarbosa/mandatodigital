export type SignedTrainingUploadPayload = {
  storageBucket: string;
  storagePath: string;
  signedUrl: string;
  contentType?: string;
};

export function formatStorageUploadError(raw: string, fileSizeBytes?: number) {
  const sizeMb =
    fileSizeBytes && fileSizeBytes > 0
      ? ` (${(fileSizeBytes / (1024 * 1024)).toFixed(1)} MB)`
      : "";
  const lower = raw.toLowerCase();

  if (
    lower.includes("fetch failed") ||
    lower.includes("econnreset") ||
    lower.includes("socket hang up") ||
    lower.includes("network error")
  ) {
    return (
      `Falha de rede ao enviar o arquivo${sizeMb} para o Firebase Storage. Tente novamente em alguns segundos.`
    );
  }

  if (
    raw.includes("413") ||
    lower.includes("payload too large") ||
    lower.includes("maximum size exceeded")
  ) {
    return (
      `O arquivo${sizeMb} excede o limite do Firebase Storage. Comprima o video e tente novamente.`
    );
  }

  return raw || "Falha no upload para o storage.";
}

export async function uploadTrainingFileToSignedStorage(
  input: SignedTrainingUploadPayload & {
    file: File;
    storageProvider?: "firebase";
    contentType?: string;
    uploadMethod?: "put";
  },
) {
  const response = await fetch(input.signedUrl, {
    method: "PUT",
    headers: {
      "Content-Type":
        input.contentType?.trim() || input.file.type || "application/octet-stream",
    },
    body: input.file,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(formatStorageUploadError(text, input.file.size));
  }
}
