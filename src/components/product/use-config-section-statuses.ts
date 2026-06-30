"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

import { useProductApp } from "@/components/product/provider";
import {
  avatarNeedsTwinProbe,
  type ConfigSectionId,
  type ConfigSectionStatus,
  configSections,
  isConfigSectionPath,
  resolveConfigSectionStatus,
} from "@/lib/config-setup-status";
import { fetchHeygenApi } from "@/lib/heygen-client-override";
import { isUsableRecordedDigitalTwin, type TwinLookDisplayMeta } from "@/lib/heygen-twin-display";

type UseConfigSectionStatusesOptions = {
  /** Consulta HeyGen só quando necessário e em rotas de configuração. */
  probeTwin?: boolean;
};

export function useConfigSectionStatuses(options: UseConfigSectionStatusesOptions = {}) {
  const pathname = usePathname();
  const { profileForm, trainingAssets } = useProductApp();
  const [hasReadyTwin, setHasReadyTwin] = useState(false);
  const [twinProbeDone, setTwinProbeDone] = useState(false);

  const needsTwinProbe = avatarNeedsTwinProbe({ trainingAssets });
  const shouldProbeTwin =
    Boolean(options.probeTwin) &&
    isConfigSectionPath(pathname) &&
    needsTwinProbe;

  const loadTwinStatus = useCallback(async () => {
    try {
      const response = await fetchHeygenApi(
        "/api/heygen/avatars/looks?ownership=private&avatarType=digital_twin",
      );
      const payload = (await response.json()) as { looks?: TwinLookDisplayMeta[] };
      const looks = payload.looks ?? [];
      setHasReadyTwin(looks.some((look) => isUsableRecordedDigitalTwin(look)));
    } catch {
      setHasReadyTwin(false);
    } finally {
      setTwinProbeDone(true);
    }
  }, []);

  useEffect(() => {
    if (!shouldProbeTwin) {
      return;
    }

    void loadTwinStatus();
  }, [shouldProbeTwin, loadTwinStatus]);

  const sectionStatuses = useMemo(() => {
    const input = { profileForm, trainingAssets, hasReadyTwin };
    return Object.fromEntries(
      configSections.map((section) => [
        section.id,
        resolveConfigSectionStatus(section.id, input),
      ]),
    ) as Record<ConfigSectionId, ConfigSectionStatus>;
  }, [profileForm, trainingAssets, hasReadyTwin]);

  return {
    sectionStatuses,
    trainingAssets,
    hasReadyTwin,
    twinProbeDone,
    loadTwinStatus,
  };
}
