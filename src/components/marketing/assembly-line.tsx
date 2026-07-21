import { AGENT_ICONS, IconShieldCheck } from "@/components/marketing/icons";
import { homeAssembly } from "@/lib/marketing/home-content";
import { AGENT_ACCENT_CLASS } from "@/lib/marketing/shared";

const ACCENT_BAR: Record<string, string> = {
  sentinela: "bg-emerald-500",
  curador: "bg-blue-500",
  criativo: "bg-purple-500",
  auditor: "bg-rose-500",
  distribuidor: "bg-amber-500",
};

const ACCENT_PILL: Record<string, string> = {
  sentinela: "bg-emerald-500 text-slate-950",
  curador: "bg-blue-500 text-white",
  criativo: "bg-purple-500 text-white",
  auditor: "bg-rose-500 text-white",
  distribuidor: "bg-amber-500 text-slate-950",
};

export function AssemblyLine() {
  return (
    <div>
      <ol className="grid list-none gap-5 p-0 sm:grid-cols-2 xl:grid-cols-4 xl:gap-4">
        {homeAssembly.steps.map((step) => {
          const accent = AGENT_ACCENT_CLASS[step.accent];
          const StepIcon = AGENT_ICONS[step.accent];

          return (
            <li key={step.stage} className="min-w-0 list-none">
              <article
                className={`flex h-full flex-col overflow-hidden rounded-2xl border bg-slate-900/55 shadow-lg ${accent.border}`}
              >
                <div className={`h-1 w-full ${ACCENT_BAR[step.accent]}`} aria-hidden />

                <div className="flex flex-1 flex-col p-5">
                  <div
                    className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl border ${accent.soft} ${accent.text} ${accent.border}`}
                    aria-hidden
                  >
                    <StepIcon size={22} />
                  </div>

                  <h3 className="text-xl font-bold tracking-tight text-white">{step.stage}</h3>

                  <span
                    className={`mt-3 inline-flex w-fit rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${ACCENT_PILL[step.accent]}`}
                  >
                    {step.agent}
                  </span>

                  <p className="mt-4 flex-1 text-sm leading-relaxed text-slate-400">
                    {step.description}
                  </p>
                </div>
              </article>
            </li>
          );
        })}
      </ol>

      <aside className="mt-8 rounded-2xl border border-slate-800/80 bg-slate-950/50 p-5 sm:p-6">
        <div className="flex gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-400">
            <IconShieldCheck size={18} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-100">{homeAssembly.footer}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{homeAssembly.note}</p>
          </div>
        </div>
      </aside>
    </div>
  );
}
