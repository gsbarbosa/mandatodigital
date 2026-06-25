/** Limite da HeyGen para vídeo de treino passado por URL (digital twin). */
export const HEYGEN_TRAINING_VIDEO_MAX_BYTES = 32 * 1024 * 1024;

/** Limite de upload no app (Supabase free tier / validação client). */
export const TRAINING_VIDEO_UPLOAD_MAX_BYTES = 50 * 1024 * 1024;

function formatMegabytes(bytes: number) {
  return (bytes / (1024 * 1024)).toFixed(1);
}

export function validateTrainingVideoFile(file: File): string | null {
  if (file.size > TRAINING_VIDEO_UPLOAD_MAX_BYTES) {
    return (
      `Vídeo muito grande (${formatMegabytes(file.size)} MB). ` +
      `O limite de envio é ${formatMegabytes(TRAINING_VIDEO_UPLOAD_MAX_BYTES)} MB.`
    );
  }

  const mime = file.type.trim().toLowerCase();
  if (mime && !mime.startsWith("video/")) {
    return "Envie um arquivo de vídeo para treinar o gêmeo digital.";
  }

  return null;
}
