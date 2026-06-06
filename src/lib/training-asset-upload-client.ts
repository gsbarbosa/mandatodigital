import * as tus from "tus-js-client";

/** Upload padrao do Supabase costuma falhar acima de ~6MB; acima disso usamos TUS. */
export const SUPABASE_STANDARD_UPLOAD_MAX_BYTES = 6 * 1024 * 1024;

/** Limite global tipico do plano Free do Supabase Storage. */
export const SUPABASE_FREE_TIER_MAX_BYTES = 50 * 1024 * 1024;

const TUS_CHUNK_SIZE = 6 * 1024 * 1024;

export type SignedTrainingUploadPayload = {
  storageBucket: string;
  storagePath: string;
  signedUrl: string;
  token: string;
  resumableEndpoint: string;
  /** Chave anon do Supabase (publica); obrigatoria para TUS no browser. */
  storageApiKey?: string;
};

export function buildResumableUploadEndpoint(supabaseUrl: string) {
  const normalized = supabaseUrl.replace(/\/$/, "");
  const host = new URL(normalized).hostname;

  if (host.endsWith(".supabase.co")) {
    const projectRef = host.split(".")[0];
    return `https://${projectRef}.storage.supabase.co/storage/v1/upload/resumable/sign`;
  }

  return `${normalized}/storage/v1/upload/resumable/sign`;
}

export function formatStorageUploadError(raw: string, fileSizeBytes?: number) {
  const sizeMb =
    fileSizeBytes && fileSizeBytes > 0
      ? ` (${(fileSizeBytes / (1024 * 1024)).toFixed(1)} MB)`
      : "";
  const lower = raw.toLowerCase();
  const sizeMbNum = fileSizeBytes ? fileSizeBytes / (1024 * 1024) : 0;

  if (
    lower.includes("fetch failed") ||
    lower.includes("econnreset") ||
    lower.includes("socket hang up") ||
    lower.includes("network error")
  ) {
    if (sizeMbNum >= 45) {
      return (
        `Falha de rede ao enviar o video${sizeMb} (comum perto do limite de 50 MB do Supabase Free). ` +
        "Comprima para ~40 MB ou aumente o limite em Storage → Settings."
      );
    }

    return (
      `Falha de rede ao enviar o arquivo${sizeMb} para o Supabase Storage. Tente novamente em alguns segundos.`
    );
  }

  if (
    raw.includes("413") ||
    lower.includes("payload too large") ||
    lower.includes("maximum size exceeded")
  ) {
    if (sizeMbNum > 50) {
      return (
        `O video tem ${sizeMbNum.toFixed(1)} MB. No plano Free do Supabase o limite global e 50 MB ` +
        `(seu arquivo passa disso). Opcoes: (1) comprimir o video para ~40–45 MB; ` +
        `(2) no plano Pro, em Storage → Settings, subir "Global file size limit" para 100 MB+ ` +
        `e alinhar o bucket persona-training-videos.`
      );
    }

    return (
      `O video${sizeMb} excede o limite do Supabase Storage. ` +
      "No painel: Storage → Settings → Global file size limit " +
      "e edite o bucket persona-training-videos (limite do bucket <= limite global)."
    );
  }

  return raw || "Falha no upload para o storage.";
}

export async function uploadTrainingBufferViaSignedUrl(input: {
  signedUrl: string;
  token: string;
  buffer: Buffer;
  mimeType: string;
}) {
  const url = new URL(input.signedUrl);
  if (!url.searchParams.get("token")) {
    url.searchParams.set("token", input.token);
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "PUT",
      headers: {
        "x-upsert": "false",
        "Content-Type": input.mimeType || "application/octet-stream",
      },
      body: new Uint8Array(input.buffer),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(formatStorageUploadError(message, input.buffer.byteLength));
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(formatStorageUploadError(text, input.buffer.byteLength));
  }
}

export function uploadTrainingBufferViaTus(input: {
  buffer: Buffer;
  mimeType: string;
  bucketName: string;
  storagePath: string;
  token: string;
  resumableEndpoint: string;
  apiKey: string;
}) {
  return new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(input.buffer, {
      endpoint: input.resumableEndpoint,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        apikey: input.apiKey,
        "x-signature": input.token,
        "x-upsert": "false",
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: input.bucketName,
        objectName: input.storagePath,
        contentType: input.mimeType || "application/octet-stream",
        cacheControl: "3600",
      },
      chunkSize: TUS_CHUNK_SIZE,
      onError(error) {
        reject(new Error(formatStorageUploadError(error.message, input.buffer.byteLength)));
      },
      onSuccess() {
        resolve();
      },
    });

    upload.start();
  });
}

export async function uploadTrainingFileToSignedUrl(input: {
  signedUrl: string;
  token: string;
  file: File;
}) {
  const url = new URL(input.signedUrl);
  if (!url.searchParams.get("token")) {
    url.searchParams.set("token", input.token);
  }

  const body = new FormData();
  body.append("cacheControl", "3600");
  body.append("", input.file);

  const response = await fetch(url.toString(), {
    method: "PUT",
    headers: {
      "x-upsert": "false",
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(formatStorageUploadError(text, input.file.size));
  }
}

export function uploadTrainingFileViaTus(input: {
  file: File;
  bucketName: string;
  storagePath: string;
  token: string;
  resumableEndpoint: string;
  anonKey: string;
}) {
  return new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(input.file, {
      endpoint: input.resumableEndpoint,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        apikey: input.anonKey,
        "x-signature": input.token,
        "x-upsert": "false",
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: input.bucketName,
        objectName: input.storagePath,
        contentType: input.file.type || "video/mp4",
        cacheControl: "3600",
      },
      chunkSize: TUS_CHUNK_SIZE,
      onError(error) {
        reject(new Error(formatStorageUploadError(error.message, input.file.size)));
      },
      onSuccess() {
        resolve();
      },
    });

    void upload.findPreviousUploads().then((previousUploads) => {
      if (previousUploads.length > 0) {
        upload.resumeFromPreviousUpload(previousUploads[0]);
      }
      upload.start();
    });
  });
}

export async function uploadTrainingFileToSupabase(input: SignedTrainingUploadPayload & {
  file: File;
}) {
  if (input.file.size > SUPABASE_STANDARD_UPLOAD_MAX_BYTES) {
    const anonKey =
      input.storageApiKey?.trim() ||
      (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
    if (!anonKey) {
      throw new Error(
        "Upload direto indisponivel para arquivos grandes sem chave anon do Supabase. " +
          "O app deve enviar pelo servidor automaticamente; recarregue a pagina e tente de novo.",
      );
    }

    await uploadTrainingFileViaTus({
      file: input.file,
      bucketName: input.storageBucket,
      storagePath: input.storagePath,
      token: input.token,
      resumableEndpoint: input.resumableEndpoint,
      anonKey,
    });
    return;
  }

  await uploadTrainingFileToSignedUrl({
    signedUrl: input.signedUrl,
    token: input.token,
    file: input.file,
  });
}
