import type { Metadata } from "next";
import type { ReactNode } from "react";

import { MarketingShell } from "@/components/marketing/marketing-shell";

export const metadata: Metadata = {
  robots: { index: true, follow: true },
};

export const dynamic = "force-dynamic";

export default async function MarketingLayout({ children }: { children: ReactNode }) {
  return <MarketingShell>{children}</MarketingShell>;
}
