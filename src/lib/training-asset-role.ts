import type { TrainingAssetRole } from "@/lib/types";

const TRAINING_ROLES: TrainingAssetRole[] = [
  "avatar_image",
  "avatar_caricature",
  "voice_audio",
  "consent",
  "dataset",
];

export function parseTrainingAssetRole(value: unknown): TrainingAssetRole {
  const raw = String(value ?? "").trim();
  if (TRAINING_ROLES.includes(raw as TrainingAssetRole)) {
    return raw as TrainingAssetRole;
  }

  return "dataset";
}

export function trainingAssetUploadRequirementMessage(trainingRole: TrainingAssetRole) {
  switch (trainingRole) {
    case "avatar_image":
      return "Envie uma imagem PNG, JPEG ou WebP.";
    case "avatar_caricature":
      return "Envie uma imagem PNG, JPEG ou WebP.";
    case "voice_audio":
      return "Envie um áudio MP3, WAV ou M4A.";
    case "consent":
    case "dataset":
      return "Envie um vídeo MP4, MOV ou WebM (até 50 MB). O servidor comprime automaticamente para o treino.";
    default:
      return "Formato de arquivo não suportado.";
  }
}

export function isAllowedTrainingMime(trainingRole: TrainingAssetRole, mimeType: string) {
  const mime = mimeType.trim().toLowerCase();

  if (trainingRole === "avatar_image" || trainingRole === "avatar_caricature") {
    return mime.startsWith("image/");
  }

  if (trainingRole === "voice_audio") {
    return (
      mime.startsWith("audio/") ||
      mime === "application/octet-stream" ||
      mime === ""
    );
  }

  if (trainingRole === "consent" || trainingRole === "dataset") {
    return mime.startsWith("video/");
  }

  return false;
}
