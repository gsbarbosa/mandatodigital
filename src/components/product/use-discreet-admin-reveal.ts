"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef } from "react";

const ADMIN_CLICK_TARGET = 5;
const ADMIN_CLICK_WINDOW_MS = 900;

export function useDiscreetAdminReveal() {
  const router = useRouter();
  const clickCountRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSecretClick = useCallback(() => {
    clickCountRef.current += 1;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      clickCountRef.current = 0;
    }, ADMIN_CLICK_WINDOW_MS);

    if (clickCountRef.current >= ADMIN_CLICK_TARGET) {
      clickCountRef.current = 0;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      router.push("/admin/integracoes");
    }
  }, [router]);

  return { handleSecretClick };
}
