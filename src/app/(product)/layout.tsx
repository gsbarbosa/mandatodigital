import type { ReactNode } from "react";

import { ProductAppProvider } from "@/components/product/provider";
import { ProductShell } from "@/components/product/shell";
import { getRepository } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function ProductLayout({
  children,
}: {
  children: ReactNode;
}) {
  const initialData = await getRepository().getDashboard();

  return (
    <ProductAppProvider initialData={initialData}>
      <ProductShell>{children}</ProductShell>
    </ProductAppProvider>
  );
}
