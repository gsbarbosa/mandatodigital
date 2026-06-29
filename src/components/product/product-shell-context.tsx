"use client";

import { createContext, useContext, type ReactNode } from "react";

type ProductShellContextValue = {
  /** Shell v2 já exibe título e subtítulo no topo da área principal. */
  hasPageHeader: boolean;
};

const ProductShellContext = createContext<ProductShellContextValue>({
  hasPageHeader: false,
});

export function ProductShellProvider({
  hasPageHeader,
  children,
}: {
  hasPageHeader: boolean;
  children: ReactNode;
}) {
  return (
    <ProductShellContext.Provider value={{ hasPageHeader }}>
      {children}
    </ProductShellContext.Provider>
  );
}

export function useProductShell() {
  return useContext(ProductShellContext);
}
