"use client";

import type { ReactNode } from "react";

import { ProductShellV1 } from "./product-shell-v1";
import { ProductShellV2 } from "./product-shell-v2";

export function ProductShell({
  children,
  productNavV2 = false,
}: {
  children: ReactNode;
  productNavV2?: boolean;
}) {
  if (productNavV2) {
    return <ProductShellV2>{children}</ProductShellV2>;
  }

  return <ProductShellV1>{children}</ProductShellV1>;
}
