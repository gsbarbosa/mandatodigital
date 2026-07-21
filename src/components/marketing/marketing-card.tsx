import type { ReactNode } from "react";

export function MarketingCard({
  title,
  children,
  eyebrow,
  icon,
  className = "",
}: {
  title: string;
  children: ReactNode;
  eyebrow?: string;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={`flex flex-col rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 shadow-lg transition hover:border-slate-700 ${className}`}
    >
      {icon ? (
        <div className="mb-4 flex items-start justify-between gap-3">
          {icon}
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {eyebrow}
            </p>
          ) : null}
        </div>
      ) : eyebrow ? (
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {eyebrow}
        </p>
      ) : null}
      <h3 className="text-lg font-bold text-white">{title}</h3>
      <div className="mt-3 text-sm leading-relaxed text-slate-400">{children}</div>
    </article>
  );
}
