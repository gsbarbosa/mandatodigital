import type { ReactNode } from "react";

import { ProductAppProvider } from "@/components/product/provider";
import { ProductShell } from "@/components/product/shell";
import { runWithSessionRepository } from "@/lib/auth/runner";
import { getSessionUser, requireSessionUser } from "@/lib/auth/session";
import { isFirebaseAuthConfigured } from "@/lib/firebase/env";
import { isProductNavV2Enabled } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

export default async function ProductLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (isFirebaseAuthConfigured()) {
    await requireSessionUser();
  }

  const initialData = await runWithSessionRepository((repository) =>
    repository.getDashboard(),
  );
  const sessionUser = isFirebaseAuthConfigured() ? await getSessionUser() : null;
  const productNavV2 = isProductNavV2Enabled();

  return (
    <ProductAppProvider initialData={initialData} sessionUser={sessionUser}>
      <ProductShell productNavV2={productNavV2}>{children}</ProductShell>
    </ProductAppProvider>
  );
}
