import type { ReactNode } from "react";

import { OnboardingProvider } from "@/components/product/onboarding-provider";
import { ProductAppProvider } from "@/components/product/provider";
import { ProductShell } from "@/components/product/shell";
import { runWithSessionRepository } from "@/lib/auth/runner";
import { requireSessionUser } from "@/lib/auth/session";
import { isFirebaseAuthConfigured } from "@/lib/firebase/env";

export const dynamic = "force-dynamic";

export default async function ProductLayout({
  children,
}: {
  children: ReactNode;
}) {
  const sessionUser = isFirebaseAuthConfigured() ? await requireSessionUser() : null;

  const initialData = await runWithSessionRepository(
    (repository) => repository.getDashboard(),
    sessionUser,
  );

  return (
    <ProductAppProvider initialData={initialData} sessionUser={sessionUser}>
      <OnboardingProvider>
        <ProductShell>{children}</ProductShell>
      </OnboardingProvider>
    </ProductAppProvider>
  );
}
