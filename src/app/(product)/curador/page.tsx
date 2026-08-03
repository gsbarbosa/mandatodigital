import { Suspense } from "react";

import { CuradorPageV2 } from "@/components/product/curador-page-v2";

export default function CuradorRoute() {
  return (
    <Suspense fallback={null}>
      <CuradorPageV2 />
    </Suspense>
  );
}
