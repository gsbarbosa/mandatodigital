import * as tus from "tus-js-client";

/** Upload padrao do Supabase costuma falhar acima de ~6MB; acima disso usamos TUS. */
export const SUPABASE_STANDARD_UPLOAD_MAX_BYTES = 6 * 1024 * 1024;

const TUS_CHUNK_SIZE = 6 * 1024 * 1024;

export type SignedTrainingUploadPayload = {
  storageBucket: string;
  storagePath: string;
  signedUrl: string;
  token: string;
  resumableEndpoint: string;
};

export function buildResumableUploadEndpoint(supabaseUrl: string) {
  const normalized = supabaseUrl.replace(/\/$/, "");
  const host = new URL(normalized).hostname;

  if (host.endsWith(".supabase.co")) {
    const projectRef = host.split(".")[0];
    return `https://${projectRef}.storage.supabase.co/storage/v1/upload/resumable`;
  }

  return `${normalized}/storage/v1/upload/resumable`;
}

export function formatStorageUploadError(raw: string, fileSizeBytes?: number) {
  const sizeMb =
    fileSizeBytes && fileSizeBytes > 0
      ? ` (${(fileSizeBytes / (1024 * 1024)).toFixed(1)} MB)`
      : "";

  if (raw.includes("413") || raw.toLowerCase().includes("payload too large")) {
    return (
      `O video${sizeMb} excede o limite do Supabase Storage. ` +
      "No painel: Storage → Settings → Global file size limit (ex.: 100 MB no Pro) " +
      "e edite o bucket persona-training-videos → Restrict file size alinhado ao global."
    );
  }

  return raw || "Falha no upload para o storage.";
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
}) {
  return new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(input.file, {
      endpoint: input.resumableEndpoint,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
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
    await uploadTrainingFileViaTus({
      file: input.file,
      bucketName: input.storageBucket,
      storagePath: input.storagePath,
      token: input.token,
      resumableEndpoint: input.resumableEndpoint,
    });
    return;
  }

  await uploadTrainingFileToSignedUrl({
    signedUrl: input.signedUrl,
    token: input.token,
    file: input.file,
  });
}
