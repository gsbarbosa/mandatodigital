import { cookies } from "next/headers";

import {
  DEV_ACCOUNT_MODE_COOKIE,
  isDevAccountModeEmail,
  parseDevAccountMode,
  type DevAccountMode,
} from "@/lib/dev-account-mode";

/** Modo efetivo: só allowlist pode ser premium; demais contas seguem como convidado. */
export async function resolveDevAccountMode(
  email: string | null | undefined,
): Promise<DevAccountMode> {
  if (!isDevAccountModeEmail(email)) {
    return "guest";
  }

  const cookieStore = await cookies();
  return parseDevAccountMode(cookieStore.get(DEV_ACCOUNT_MODE_COOKIE)?.value);
}

export async function isPremiumAccountMode(email: string | null | undefined) {
  return (await resolveDevAccountMode(email)) === "premium";
}
