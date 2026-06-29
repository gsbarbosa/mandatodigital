"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { CuradorPageV2 } from "@/components/product/curador-page-v2";
import { SentinelaRadarPanel } from "@/components/product/sentinela-radar-panel";

type ConfigTab = "perfil" | "radar" | "canais";

const tabs: Array<{ id: ConfigTab; label: string }> = [
  { id: "perfil", label: "Perfil & avatar" },
  { id: "radar", label: "Radar & fontes" },
  { id: "canais", label: "Canais" },
];

function parseConfigTab(value: string | null): ConfigTab {
  if (value === "radar" || value === "canais" || value === "perfil") {
    return value;
  }
  return "perfil";
}

export function ConfiguracoesPage() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<ConfigTab>("perfil");

  useEffect(() => {
    setActiveTab(parseConfigTab(searchParams.get("tab")));
  }, [searchParams]);

  return (
    <div className="app-page agent-theme-curador">
      <section className="app-panel app-panel-span-full app-panel-flush-top">
        <div className="config-tabs" role="tablist" aria-label="Seções de configuração">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={["config-tab", activeTab === tab.id ? "is-active" : ""]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setActiveTab(tab.id)}
              data-testid={`config-tab-${tab.id}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="config-tab-panel" role="tabpanel">
          {activeTab === "perfil" ? (
            <div className="config-embed config-embed-curador" data-testid="config-panel-perfil">
              <CuradorPageV2 />
            </div>
          ) : null}

          {activeTab === "radar" ? (
            <div data-testid="config-panel-radar">
              <p className="persona-helper-text">
                Temas, portais e oposição monitorados pelo Sentinela.
              </p>
              <SentinelaRadarPanel />
            </div>
          ) : null}

          {activeTab === "canais" ? (
            <div data-testid="config-panel-canais">
              <div className="config-coming-soon" role="status">
                <p className="config-coming-soon-label">Canais de publicação</p>
                <p className="config-coming-soon-message">Disponível em breve</p>
                <p className="persona-helper-text">
                  Integrações com redes sociais, janelas de disparo e preferências de
                  distribuição entrarão nesta aba em uma próxima versão.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
