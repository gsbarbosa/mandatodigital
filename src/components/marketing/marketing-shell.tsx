import type { ReactNode } from "react";

import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { getSessionUser } from "@/lib/auth/session";
import { isFirebaseAuthConfigured } from "@/lib/firebase/env";

export async function MarketingShell({ children }: { children: ReactNode }) {
  const sessionUser = isFirebaseAuthConfigured() ? await getSessionUser() : null;

  return (
    <div className="marketing-shell min-h-screen overflow-x-hidden bg-[#020617] text-slate-100">
      <MarketingHeader isAuthenticated={Boolean(sessionUser)} />
      <main>{children}</main>
      <MarketingFooter />
    </div>
  );
}
