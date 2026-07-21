import type { ReactNode } from "react";

export function MarketingSection({
  id,
  eyebrow,
  title,
  titleAs = "h2",
  lead,
  children,
  className = "",
}: {
  id?: string;
  eyebrow?: string;
  title?: ReactNode;
  titleAs?: "h1" | "h2";
  lead?: string;
  children?: ReactNode;
  className?: string;
}) {
  const TitleTag = titleAs;

  return (
    <section
      id={id}
      className={`scroll-mt-24 border-t border-slate-800/60 py-16 sm:py-20 ${className}`}
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        {eyebrow ? (
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-400/90">
            {eyebrow}
          </p>
        ) : null}
        {title ? (
          <TitleTag className="max-w-3xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {title}
          </TitleTag>
        ) : null}
        {lead ? (
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-400 sm:text-lg">
            {lead}
          </p>
        ) : null}
        {children ? <div className={title || lead ? "mt-10" : undefined}>{children}</div> : null}
      </div>
    </section>
  );
}
