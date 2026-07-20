import { cert, getApps, initializeApp, type App, type ServiceAccount } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore as getAdminFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";

import { getFirebaseStorageBucketName } from "@/lib/firebase/env";

function parseServiceAccount(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as ServiceAccount;
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON invalido (esperado JSON).");
  }
}

function resolveStorageBucket() {
  return getFirebaseStorageBucketName() || undefined;
}

export function getFirebaseAdminApp(): App {
  const existing = getApps()[0];
  if (existing) {
    return existing;
  }

  const storageBucket = resolveStorageBucket();

  if (process.env.FIREBASE_CONFIG || process.env.K_SERVICE) {
    return initializeApp(storageBucket ? { storageBucket } : undefined);
  }

  const serviceAccount = parseServiceAccount();
  if (serviceAccount) {
    return initializeApp({
      credential: cert(serviceAccount),
      ...(storageBucket ? { storageBucket } : {}),
    });
  }

  throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON nao configurado.");
}

export function getFirebaseAdminAuth(): Auth {
  return getAuth(getFirebaseAdminApp());
}

let firestore: Firestore | undefined;

export function getFirestore(): Firestore {
  if (!firestore) {
    firestore = getAdminFirestore(getFirebaseAdminApp());
    firestore.settings({ ignoreUndefinedProperties: true });
  }
  return firestore;
}

export function getFirebaseAdminStorage(): Storage {
  return getStorage(getFirebaseAdminApp());
}

export function getFirebaseAdminBucket(bucketName?: string | null) {
  const storage = getFirebaseAdminStorage();
  const name = bucketName?.trim() || resolveStorageBucket();
  if (!name) {
    throw new Error(
      "Bucket Firebase Storage nao configurado (FIREBASE_TRAINING_ASSETS_BUCKET / NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET).",
    );
  }
  return storage.bucket(name);
}
