import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_MS,
  getAdminEmail,
  getAdminPassword,
  getAdminSessionSecret,
} from "@/lib/admin/credentials";

export type AdminSession = {
  email: string;
  exp: number;
};

function encodeBase64Url(value: string | Buffer) {
  const buf = typeof value === "string" ? Buffer.from(value, "utf8") : value;
  return buf.toString("base64url");
}

function signPayload(payloadB64: string) {
  return createHmac("sha256", getAdminSessionSecret()).update(payloadB64).digest("base64url");
}

export function createAdminSessionToken(email: string, now = Date.now()) {
  const session: AdminSession = {
    email: email.toLowerCase(),
    exp: now + ADMIN_SESSION_MAX_AGE_MS,
  };
  const payloadB64 = encodeBase64Url(JSON.stringify(session));
  const signature = signPayload(payloadB64);
  return `${payloadB64}.${signature}`;
}

export function verifyAdminSessionToken(token: string | undefined | null): AdminSession | null {
  if (!token) {
    return null;
  }

  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) {
    return null;
  }

  const expected = signPayload(payloadB64);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as AdminSession;
    if (!parsed?.email || typeof parsed.exp !== "number") {
      return null;
    }
    if (parsed.exp < Date.now()) {
      return null;
    }
    if (parsed.email.toLowerCase() !== getAdminEmail()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function passwordsMatch(input: string, expected: string) {
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

export function validateAdminCredentials(email: string, password: string) {
  const emailOk = email.trim().toLowerCase() === getAdminEmail();
  const passwordOk = passwordsMatch(password, getAdminPassword());
  return emailOk && passwordOk;
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  return verifyAdminSessionToken(token);
}

export async function requireAdminSession(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) {
    throw new AdminAuthError("Sessao administrativa ausente ou expirada.");
  }
  return session;
}

export class AdminAuthError extends Error {
  status = 401 as const;
  constructor(message: string) {
    super(message);
    this.name = "AdminAuthError";
  }
}

export function adminSessionCookieOptions(maxAgeSeconds = ADMIN_SESSION_MAX_AGE_MS / 1000) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
