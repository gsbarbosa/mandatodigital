"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

import { getFirebaseClientConfig } from "@/lib/firebase/env";

let authInstance: Auth | null = null;

function getFirebaseApp(): FirebaseApp {
  const config = getFirebaseClientConfig();

  if (!config) {
    throw new Error(
      "Configure NEXT_PUBLIC_FIREBASE_API_KEY, AUTH_DOMAIN, PROJECT_ID e APP_ID no ambiente.",
    );
  }

  return getApps().length > 0 ? getApp() : initializeApp(config);
}

export function getFirebaseAuth() {
  if (!authInstance) {
    authInstance = getAuth(getFirebaseApp());
  }

  return authInstance;
}
