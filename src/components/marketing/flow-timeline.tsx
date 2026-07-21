import {
  IconArrowRight,
  IconBolt,
  IconCheck,
  SOCIAL_ICONS,
} from "@/components/marketing/icons";
import { homeFactToFeed } from "@/lib/marketing/home-content";

const SOCIAL_TILE: Record<string, string> = {
  Instagram: "text-[#E4405F]",
  TikTok: "text-white",
  YouTube: "text-[#FF0033]",
  X: "text-white",
  LinkedIn: "text-[#0A66C2]",
  Facebook: "text-[#1877F2]",
  Threads: "text-white",
};

export function FlowTimeline() {
  const { start, middle, end, networks } = homeFactToFeed;

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-slate-700/70 bg-slate-950/70 px-4 py-8 shadow-[0_0_60px_rgba(16,185,129,0.06)] sm:px-8">
        <div className="flex flex-col items-stretch gap-6 md:flex-row md:items-center md:justify-between md:gap-4">
          <div className="min-w-0 flex-1 text-center md:text-left">
            <p className="text-4xl font-bold tabular-nums tracking-tight text-white sm:text-5xl">
              {start.time}
            </p>
            <p className="mt-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-amber-300">
              <IconBolt size={16} className="text-amber-400" />
              {start.label}
            </p>
          </div>

          <IconArrowRight size={28} className="mx-auto hidden shrink-0 text-sky-400 md:block" aria-hidden />

          <div className="mx-auto w-full min-w-0 max-w-xs shrink rounded-2xl border border-sky-500/40 bg-sky-500/10 px-4 py-3 text-center shadow-[0_0_24px_rgba(56,189,248,0.15)] md:mx-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-200">
              {middle}
            </p>
          </div>

          <IconArrowRight size={28} className="mx-auto hidden shrink-0 text-sky-400 md:block" aria-hidden />

          <div className="min-w-0 flex-1 text-center md:text-right">
            <p className="text-4xl font-bold tabular-nums tracking-tight text-white sm:text-5xl">
              {end.time}
            </p>
            <p className="mt-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-emerald-400">
              <IconCheck size={16} />
              {end.label}
            </p>
          </div>
        </div>
      </div>

      <div>
        <p className="mb-4 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
          Redes atendidas
        </p>
        <ul className="flex flex-wrap items-center justify-center gap-3">
          {networks.map((name) => {
            const SocialIcon = SOCIAL_ICONS[name];
            return (
              <li key={name}>
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-700/80 bg-slate-900/90 shadow-[0_0_20px_rgba(59,130,246,0.12)]"
                  title={name}
                >
                  {SocialIcon ? (
                    <span className={SOCIAL_TILE[name] ?? "text-slate-200"}>
                      <SocialIcon size={22} />
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">{name}</span>
                  )}
                  <span className="sr-only">{name}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
