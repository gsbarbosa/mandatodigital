import { isApiUser, requireApiUser } from "@/lib/auth/api";
import { getSessionUser, requireSessionUser, type SessionUser } from "@/lib/auth/session";
import { getRepository, type Repository } from "@/lib/storage";
import { runWithStorageOwner } from "@/lib/storage-context";
import { isFirebaseAuthConfigured } from "@/lib/firebase/env";

export async function runWithSessionRepository<T>(
  fn: (repository: Repository) => Promise<T>,
  sessionUser?: SessionUser | null,
): Promise<T> {
  if (!isFirebaseAuthConfigured()) {
    return fn(getRepository());
  }

  const user = sessionUser ?? (await requireSessionUser());
  return runWithStorageOwner(user.id, () => fn(getRepository()));
}

export async function runWithOptionalSessionRepository<T>(
  fn: (repository: Repository) => Promise<T>,
): Promise<T> {
  if (!isFirebaseAuthConfigured()) {
    return fn(getRepository());
  }

  const user = await getSessionUser();

  if (!user) {
    return fn(getRepository());
  }

  return runWithStorageOwner(user.id, () => fn(getRepository()));
}

export async function runWithApiRepository<T>(
  fn: (repository: Repository) => Promise<T>,
): Promise<T | Response> {
  if (!isFirebaseAuthConfigured()) {
    return fn(getRepository());
  }

  const auth = await requireApiUser();

  if (!isApiUser(auth)) {
    return auth;
  }

  return runWithStorageOwner(auth.id, () => fn(getRepository()));
}
