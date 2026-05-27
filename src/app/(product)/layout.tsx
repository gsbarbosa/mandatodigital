import type { ReactNode } from "react";

import { ProductAppProvider } from "@/components/product/provider";
import { ProductShell } from "@/components/product/shell";
import { runWithSessionRepository } from "@/lib/auth/runner";
import { getSessionUser, requireSessionUser } from "@/lib/auth/session";
import { isSupabaseAuthConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function ProductLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (isSupabaseAuthConfigured()) {
    await requireSessionUser();
  }

  const initialData = await runWithSessionRepository((repository) =>
    repository.getDashboard(),
  );
  const sessionUser = isSupabaseAuthConfigured() ? await getSessionUser() : null;

  return (
    <ProductAppProvider initialData={initialData} sessionUser={sessionUser}>
      <ProductShell>{children}</ProductShell>
    </ProductAppProvider>
  );
}
