"use client";

import { useMemo } from "react";

import { useProductApp } from "@/components/product/provider";
import {
  assertMandatorySetup,
  getMandatorySetupBlockMessage,
  isMandatorySetupCompleteForProfile,
  resolveMandatorySetupHref,
} from "@/lib/product-setup-checklist";

export function useMandatorySetupGate() {
  const { profile } = useProductApp();

  return useMemo(
    () => ({
      canGenerateContent: isMandatorySetupCompleteForProfile(profile),
      setupHref: resolveMandatorySetupHref(profile),
      blockMessage: getMandatorySetupBlockMessage(profile),
      assertSetup: () => assertMandatorySetup(profile),
    }),
    [profile],
  );
}
