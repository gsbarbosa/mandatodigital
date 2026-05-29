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
