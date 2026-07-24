import {
  IconClapper,
  IconList,
  IconPersona,
} from "@/components/marketing/icons";
import {
  AgentDetailClosing,
  AgentDetailHero,
  AgentDetailSection,
} from "@/components/marketing/agent-detail-shell";
import { criativoDetail } from "@/lib/marketing/criativo-detail-content";

const CARD_TONE = {
  purple: {
    bar: "bg-purple-500",
    icon: "bg-purple-500/15 text-purple-300 border-purple-500/30",
    footer: "bg-purple-500/10 text-purple-300",
  },
  emerald: {
    bar: "bg-emerald-500",
    icon: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    footer: "bg-emerald-500/10 text-emerald-300",
  },
  rose: {
    bar: "bg-rose-500",
    icon: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    footer: "bg-rose-500/10 text-rose-300",
  },
} as const;

const CARD_ICONS = [IconList, IconPersona, IconClapper] as const;

export function MarketingCriativoPage() {
  return (
    <>
      <AgentDetailHero
        accent="criativo"
        badge={criativoDetail.badge}
        titleLead={criativoDetail.titleLead}
        titleAccent={criativoDetail.titleAccent}
        metrics={criativoDetail.metrics}
        stories={criativoDetail.stories}
        visual={{
          src: "/marketing/criativo/content-cards.jpg",
          alt: "Painel de Content Creation Cards do Agente Criativo",
          aspect: "portrait",
        }}
      />

      <AgentDetailSection
        title={criativoDetail.entregas.title}
        lead={criativoDetail.entregas.lead}
        accent="criativo"
      >
        <div className="grid gap-5 md:grid-cols-3">
          {criativoDetail.entregas.cards.map((card, index) => {
            const tone = CARD_TONE[card.tone];
            const Icon = CARD_ICONS[index];
            return (
              <article
                key={card.title}
                className="overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-900/50"
              >
                <div className={`h-1 w-full ${tone.bar}`} />
                <div className="flex h-full flex-col p-6">
                  <div
                    className={`mb-5 flex h-12 w-12 items-center justify-center rounded-full border ${tone.icon}`}
                  >
                    <Icon size={22} />
                  </div>
                  <h3 className="text-lg font-semibold text-white">{card.title}</h3>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-400">
                    {card.body}
                  </p>
                  <span
                    className={`mt-5 inline-flex w-fit rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider ${tone.footer}`}
                  >
                    {card.footer}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </AgentDetailSection>

      <AgentDetailClosing />
    </>
  );
}
