import { getSessionUser } from "@/lib/auth/session";
import { getUserRegistrationForOwner } from "@/lib/user-registration-storage";

export type AdminSession = {
  email: string;
};

/**
 * Acesso ao /admin é só via flag `isAdmin` no cadastro do usuário (userRegistrations).
 * Reavaliado a cada request — desligar a flag revoga o acesso na hora.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const user = await getSessionUser();
  if (!user?.email) {
    return null;
  }

  try {
    const registration = await getUserRegistrationForOwner(user.id);
    if (!registration?.isAdmin) {
      return null;
    }
    return { email: user.email.toLowerCase() };
  } catch (error) {
    console.error("[admin/session] falha ao checar flag isAdmin:", error);
    return null;
  }
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
