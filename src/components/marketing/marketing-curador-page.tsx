import Image from "next/image";

import { IconCheck } from "@/components/marketing/icons";
import {
  AgentDetailBackLink,
  AgentDetailClosing,
  AgentDetailMetricsStories,
  AgentDetailSection,
} from "@/components/marketing/agent-detail-shell";
import { curadorDetail } from "@/lib/marketing/curador-detail-content";
import { AGENT_ACCENT_CLASS } from "@/lib/marketing/shared";

export function MarketingCuradorPage() {
  const accent = AGENT_ACCENT_CLASS.curador;
  const { persona } = curadorDetail;

  return (
    <>
      <section className="border-t-0 py-10 sm:py-14">
        <div className="mx-auto flex w-full max-w-6xl flex-col px-4 sm:px-6">
          <AgentDetailBackLink />

          <div
            className={`inline-flex w-fit rounded-full border px-3.5 py-1.5 ${accent.border} ${accent.soft}`}
          >
            <span
              className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${accent.text}`}
            >
              {curadorDetail.badge}
            </span>
          </div>

          <h1 className="mt-5 max-w-4xl text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
            {curadorDetail.titleLead}{" "}
            <span className={`whitespace-nowrap ${accent.text}`}>{curadorDetail.titleAccent}</span>
          </h1>
          <p className="mt-3 text-base font-medium text-sky-300 sm:text-lg">
            {curadorDetail.subtitle}
          </p>

          <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-center lg:gap-12">
            <div
              className={`relative aspect-square max-w-md overflow-hidden rounded-3xl border ${accent.border}`}
            >
              <Image
                src="/marketing/curador/persona.jpg"
                alt="Ilustração da identidade política preservada pelo Agente Curador"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 420px"
                priority
              />
              <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/50 via-transparent to-transparent" />
            </div>

            <div>
              <p className="text-sm leading-relaxed text-slate-300 sm:text-base">
                {curadorDetail.identityBody}
              </p>
              <div className="mt-6 rounded-2xl border border-slate-800/80 bg-slate-900/50 p-5 sm:p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {curadorDetail.personality.title}
                </p>
                <ul className="mt-4 space-y-3">
                  {curadorDetail.personality.items.map((item) => (
                    <li key={item} className="flex gap-3 text-sm text-slate-300">
                      <IconCheck size={16} className={`mt-0.5 shrink-0 ${accent.text}`} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <AgentDetailSection
        title="Base de Conhecimento:"
        titleAccent="O Impacto Real"
        accent="curador"
      >
        <AgentDetailMetricsStories
          accent="curador"
          metrics={curadorDetail.metrics}
          stories={curadorDetail.stories}
        />
      </AgentDetailSection>

      <AgentDetailSection
        title={persona.title}
        titleAccent={persona.titleAccent}
        accent="curador"
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-800/80 bg-slate-900/50 p-6">
            <p className="text-sm font-semibold text-white">Perfil e Vocabulário</p>
            <div className="mt-6 flex flex-col items-center">
              <div
                className={`flex h-36 w-36 items-center justify-center rounded-full border-4 ${accent.border} ${accent.soft}`}
              >
                <div className="text-center">
                  <p className={`text-3xl font-bold ${accent.text}`}>{persona.coherence}</p>
                  <p className="mt-1 max-w-[7rem] text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {persona.coherenceLabel}
                  </p>
                </div>
              </div>
            </div>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              {persona.vocabularyTitle}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {persona.vocabulary.map((term) => (
                <span
                  key={term}
                  className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-xs font-medium text-slate-300"
                >
                  {term}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800/80 bg-slate-900/50 p-6">
            <p className="text-sm font-semibold text-white">{persona.toneTitle}</p>
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-rose-400">
                  {persona.genericLabel}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{persona.genericQuote}</p>
              </div>
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  {persona.curatedLabel}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{persona.curatedQuote}</p>
              </div>
            </div>
          </div>
        </div>
      </AgentDetailSection>

      <AgentDetailClosing />
    </>
  );
}
