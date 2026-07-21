import type { ReactNode } from "react";

import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="marketing-shell min-h-screen overflow-x-hidden bg-[#020617] text-slate-100">
      <MarketingHeader />
      <main>{children}</main>
      <MarketingFooter />
    </div>
  );
}
