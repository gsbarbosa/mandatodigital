import {
  getFirebaseStorageBucketName,
  hasFirebaseServiceAccount,
} from "@/lib/firebase/env";
import { randomUUID } from "node:crypto";

/**
 * Blobs de treino/vídeo vivem exclusivamente no Firebase Storage.
 */
export function getFirebaseTrainingAssetsBucket() {
  return getFirebaseStorageBucketName();
}

export function canUseFirebaseTrainingAssets() {
  return hasFirebaseServiceAccount() && Boolean(getFirebaseTrainingAssetsBucket());
}

export function resolveTrainingAssetsStorageProvider(): "firebase" {
  if (!canUseFirebaseTrainingAssets()) {
    throw new Error(
      "Firebase Storage obrigatorio para assets de treino. " +
        "Configure Admin Firebase e FIREBASE_TRAINING_ASSETS_BUCKET / NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET.",
    );
  }
  return "firebase";
}

export function buildTrainingAssetObjectPath(referenceId: string, safeFilename: string) {
  const id = randomUUID();
  return `training/${referenceId}/${id}-${safeFilename}`;
}
