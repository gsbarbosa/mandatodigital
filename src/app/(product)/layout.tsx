import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ProductAppProvider } from "@/components/product/provider";
import { ProductShell } from "@/components/product/shell";
import { runWithSessionRepository } from "@/lib/auth/runner";
import { requireSessionUser } from "@/lib/auth/session";
import { isFirebaseAuthConfigured } from "@/lib/firebase/env";
import {
  isRegistrationAllowedPath,
  REGISTRATION_REQUIRED_PATH,
} from "@/lib/registration-gate";
import {
  ensureUserRegistration,
  isUserRegistrationComplete,
} from "@/lib/user-registration-storage";

export const dynamic = "force-dynamic";

export default async function ProductLayout({
  children,
}: {
  children: ReactNode;
}) {
  const sessionUser = isFirebaseAuthConfigured() ? await requireSessionUser() : null;

  if (sessionUser && isFirebaseAuthConfigured()) {
    const registration = await ensureUserRegistration({
      ownerUserId: sessionUser.id,
      email: sessionUser.email,
    });

    if (!isUserRegistrationComplete(registration)) {
      const pathname = (await headers()).get("x-pathname") ?? "";
      if (!isRegistrationAllowedPath(pathname)) {
        redirect(REGISTRATION_REQUIRED_PATH);
      }
    }
  }

  const initialData = await runWithSessionRepository(
    (repository) => repository.getDashboard(),
    sessionUser,
  );

  return (
    <ProductAppProvider initialData={initialData} sessionUser={sessionUser}>
      <ProductShell>{children}</ProductShell>
    </ProductAppProvider>
  );
}
