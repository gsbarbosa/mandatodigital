import type { ReactNode } from "react";

export function MarketingCard({
  title,
  children,
  eyebrow,
  icon,
  className = "",
  compact = false,
  titleInline = false,
}: {
  title: string;
  children: ReactNode;
  eyebrow?: string;
  icon?: ReactNode;
  className?: string;
  compact?: boolean;
  titleInline?: boolean;
}) {
  return (
    <article
      className={`flex flex-col rounded-2xl border border-md-border bg-md-surface/40 shadow-lg transition hover:border-md-border ${
        compact ? "p-4" : "p-6"
      } ${className}`}
    >
      {titleInline && icon ? (
        <div className={`flex items-center gap-3 ${compact ? "mb-1.5" : "mb-3"}`}>
          {icon}
          <h3 className="text-lg font-bold text-md-text">{title}</h3>
        </div>
      ) : (
        <>
          {icon ? (
            <div className={`flex items-start justify-between gap-3 ${compact ? "mb-3" : "mb-4"}`}>
              {icon}
              {eyebrow ? (
                <p className="text-[11px] font-semibold uppercase tracking-wider text-md-text-soft">
                  {eyebrow}
                </p>
              ) : null}
            </div>
          ) : eyebrow ? (
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-md-text-soft">
              {eyebrow}
            </p>
          ) : null}
          <h3 className="text-lg font-bold text-md-text">{title}</h3>
        </>
      )}
      <div className={`text-sm leading-relaxed text-md-text-soft ${compact ? "mt-1.5" : "mt-3"}`}>
        {children}
      </div>
    </article>
  );
}
