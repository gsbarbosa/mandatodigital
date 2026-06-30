"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { CuradorPageV2 } from "@/components/product/curador-page-v2";
import { TrainingAssetMediaPreview } from "@/components/product/persona-shared";
import { useProductApp } from "@/components/product/provider";
import { isAvatarSectionComplete } from "@/lib/config-setup-status";
import { fetchHeygenApi } from "@/lib/heygen-client-override";
import { isUsableRecordedDigitalTwin, type TwinLookDisplayMeta } from "@/lib/heygen-twin-display";

type PrivateTwinLook = TwinLookDisplayMeta;

export function ConfigAvatarPanel() {
  const { trainingAssets } = useProductApp();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [hasReadyTwin, setHasReadyTwin] = useState(false);
  const [isCheckingTwin, setIsCheckingTwin] = useState(true);

  const assetReferenceId = useMemo(() => {
    const first = trainingAssets[0];
    return first?.profileId ?? first?.draftProfileId ?? null;
  }, [trainingAssets]);

  const visibleTrainingAssets = useMemo(
    () =>
      assetReferenceId
        ? trainingAssets.filter(
            (asset) =>
              asset.profileId === assetReferenceId ||
              asset.draftProfileId === assetReferenceId,
          )
        : trainingAssets,
    [assetReferenceId, trainingAssets],
  );

  const previewAsset = useMemo(() => {
    const photo = visibleTrainingAssets.find((asset) => asset.trainingRole === "avatar_image");
    const video = visibleTrainingAssets.find(
      (asset) =>
        asset.trainingRole === "dataset" &&
        String(asset.mimeType ?? "").toLowerCase().startsWith("video/"),
    );
    return photo ?? video ?? null;
  }, [visibleTrainingAssets]);

  const loadTwinStatus = useCallback(async () => {
    setIsCheckingTwin(true);

    try {
      const response = await fetchHeygenApi(
        "/api/heygen/avatars/looks?ownership=private&avatarType=digital_twin",
      );
      const payload = (await response.json()) as { looks?: PrivateTwinLook[] };
      const looks = payload.looks ?? [];
      setHasReadyTwin(looks.some((look) => isUsableRecordedDigitalTwin(look)));
    } catch {
      setHasReadyTwin(false);
    } finally {
      setIsCheckingTwin(false);
    }
  }, []);

  useEffect(() => {
    void loadTwinStatus();
  }, [loadTwinStatus]);

  const isComplete = isAvatarSectionComplete({
    trainingAssets: visibleTrainingAssets,
    hasReadyTwin,
  });

  if (isComplete && !showAdvanced) {
    return (
      <div data-testid="config-panel-avatar">
        <div className="config-section-complete-card">
          <div className="config-section-complete-header">
            <span className="config-section-badge">Concluído</span>
            <h3 className="config-section-complete-title">Avatar pronto para produção</h3>
          </div>
          <p className="persona-helper-text">
            Você já configurou voz e aparência. Não precisa mexer aqui no dia a dia — só volte se
            quiser refazer o gêmeo ou trocar materiais.
          </p>
          {previewAsset ? (
            <div className="config-avatar-preview-thumb persona-top-gap">
              <TrainingAssetMediaPreview
                assetId={previewAsset.id}
                preferVideo={previewAsset.trainingRole === "dataset"}
              />
            </div>
          ) : null}
          {hasReadyTwin ? (
            <p className="persona-helper-text persona-top-gap">
              Gêmeo digital ativo na plataforma.
            </p>
          ) : null}
          <div className="persona-cta-row persona-top-gap">
            <button
              type="button"
              className="persona-btn persona-btn-secondary"
              onClick={() => setShowAdvanced(true)}
              data-testid="config-avatar-reconfigure"
            >
              Reconfigurar avatar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="config-panel-avatar">
      {isComplete ? (
        <div className="config-section-advanced-notice persona-top-gap" role="status">
          <p className="persona-helper-text">
            Reconfiguração avançada — alterar materiais ou refazer o gêmeo pode exigir novo
            treinamento.
          </p>
          <button
            type="button"
            className="persona-btn persona-btn-secondary persona-btn-compact"
            onClick={() => setShowAdvanced(false)}
          >
            Voltar ao resumo
          </button>
        </div>
      ) : null}

      {!isComplete && !isCheckingTwin ? (
        <p className="persona-helper-text">
          Configure uma vez: áudio de voz, foto e — se quiser — vídeo para o gêmeo digital. Depois
          disso, esta etapa fica marcada como concluída.
        </p>
      ) : null}

      <div className="config-embed config-embed-curador persona-top-gap">
        <CuradorPageV2 scope="avatar" onTwinStatusChange={loadTwinStatus} />
      </div>
    </div>
  );
}
