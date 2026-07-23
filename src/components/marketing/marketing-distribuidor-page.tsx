import { SOCIAL_ICONS } from "@/components/marketing/icons";
import {
  AgentDetailClosing,
  AgentDetailHero,
  AgentDetailSection,
} from "@/components/marketing/agent-detail-shell";
import { distribuidorDetail } from "@/lib/marketing/distribuidor-detail-content";
import { AGENT_ACCENT_CLASS } from "@/lib/marketing/shared";

export function MarketingDistribuidorPage() {
  const accent = AGENT_ACCENT_CLASS.distribuidor;
  const { painel } = distribuidorDetail;

  return (
    <>
      <AgentDetailHero
        accent="distribuidor"
        badge={distribuidorDetail.badge}
        titleLead={distribuidorDetail.titleLead}
        titleAccent={distribuidorDetail.titleAccent}
        metrics={distribuidorDetail.metrics}
        stories={distribuidorDetail.stories}
        visual={{
          src: "/marketing/distribuidor/painel.jpg",
          alt: "Painel de disparo coordenado do Agente Distribuidor",
          aspect: "video",
        }}
      />

      <AgentDetailSection
        title={painel.title}
        titleAccent={painel.titleAccent}
        accent="distribuidor"
      >
        <div className="rounded-3xl border border-slate-800/80 bg-slate-900/40 px-4 py-8 sm:px-8">
          <div className="relative mx-auto max-w-4xl">
            <div className="absolute left-4 right-4 top-[0.55rem] h-px bg-slate-600 sm:left-8 sm:right-8" />
            <div className="relative grid grid-cols-2 gap-6 sm:grid-cols-4 sm:gap-4">
              {painel.slots.map((slot) => (
                <div key={slot.time} className="flex flex-col items-center text-center">
                  <span
                    className={`relative z-10 h-3 w-3 rounded-full ${accent.soft} ring-2 ring-amber-400`}
                  />
                  <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-3">
                    <p className="text-sm font-bold text-white">{slot.time}</p>
                    <p className={`mt-1 text-xs font-semibold ${accent.text}`}>{slot.reach}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            {painel.networks.map((network) => {
              const Icon = SOCIAL_ICONS[network];
              return (
                <span
                  key={network}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-sky-500/30 bg-slate-950/70 text-sky-300"
                  title={network}
                >
                  <Icon size={18} />
                </span>
              );
            })}
          </div>

          <div className="mt-8 flex justify-center">
            <span
              className={`inline-flex rounded-full border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] ${accent.border} ${accent.soft} ${accent.text}`}
            >
              {painel.status}
            </span>
          </div>
        </div>
      </AgentDetailSection>

      <AgentDetailClosing />
    </>
  );
}
