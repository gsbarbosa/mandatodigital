"use client";

import { ConfigAvatarPanel } from "@/components/product/config-avatar-panel";
import { ConfigPerfilPanel } from "@/components/product/config-perfil-panel";
import { SentinelaRadarPanel } from "@/components/product/sentinela-radar-panel";
import {
  isAvatarSectionComplete,
  type ConfigSectionId,
} from "@/lib/config-setup-status";
import { useConfigSectionStatuses } from "@/components/product/use-config-section-statuses";

export function ConfiguracoesPage({ section }: { section: ConfigSectionId }) {
  const { trainingAssets, hasReadyTwin } = useConfigSectionStatuses({ probeTwin: true });
  const avatarComplete = isAvatarSectionComplete({ trainingAssets, hasReadyTwin });

  return (
    <div className="app-page agent-theme-curador">
      <section className="app-panel app-panel-span-full app-panel-flush-top">
        {section === "perfil" ? <ConfigPerfilPanel /> : null}

        {section === "avatar" ? (
          <ConfigAvatarPanel key={avatarComplete ? "avatar-summary" : "avatar-edit"} />
        ) : null}

        {section === "radar" ? (
          <div className="config-panel-body" data-testid="config-panel-radar">
            <p className="config-section-lead">
              Temas monitorados pelo Sentinela — o que entra na busca de pautas no Início.
            </p>
            <SentinelaRadarPanel focus="radar" />
          </div>
        ) : null}

        {section === "fontes" ? (
          <div className="config-panel-body" data-testid="config-panel-fontes">
            <p className="config-section-lead">
              Opcional — refine portais específicos além do Google News. O radar já cobre temas
              gerais; use fontes para sites locais ou blogs que você quer priorizar.
            </p>
            <SentinelaRadarPanel focus="fontes" showRefreshSignals={false} />
          </div>
        ) : null}

        {section === "canais" ? (
          <div data-testid="config-panel-canais">
            <div className="config-coming-soon" role="status">
              <p className="config-coming-soon-label">Canais de publicação</p>
              <p className="config-coming-soon-message">Disponível em breve</p>
              <p className="persona-helper-text">
                Integrações com redes sociais, janelas de disparo e preferências de
                distribuição entrarão nesta seção em uma próxima versão.
              </p>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
