import type { ReactNode } from "react";

export function MarketingSection({
  id,
  eyebrow,
  title,
  titleAs = "h2",
  lead,
  children,
  className = "",
  align = "left",
  contentGapClassName = "mt-10",
  titleNoWrap = false,
  justifyLead = false,
  wideLead = false,
  wideTitle = false,
}: {
  id?: string;
  eyebrow?: string;
  title?: ReactNode;
  titleAs?: "h1" | "h2";
  lead?: string;
  children?: ReactNode;
  className?: string;
  align?: "left" | "center";
  contentGapClassName?: string;
  titleNoWrap?: boolean;
  justifyLead?: boolean;
  wideLead?: boolean;
  wideTitle?: boolean;
}) {
  const TitleTag = titleAs;
  const centered = align === "center";
  const titleClass = titleNoWrap
    ? "m-0 whitespace-nowrap text-[clamp(0.65rem,3vw,2.3rem)] font-bold tracking-tight text-white"
    : `m-0 text-3xl font-bold tracking-tight text-white sm:text-4xl ${centered ? "mx-auto text-center" : wideTitle ? "" : "max-w-3xl"}`;
  const leadClass = justifyLead
    ? "mt-4 text-justify text-base leading-relaxed text-slate-400 sm:text-lg"
    : `mt-4 text-base leading-relaxed text-slate-400 sm:text-lg ${centered ? "mx-auto max-w-4xl text-center" : wideLead ? "" : "max-w-3xl"}`;

  return (
    <section
      id={id}
      className={`scroll-mt-24 border-t border-slate-800/60 py-16 sm:py-20 ${className}`}
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        {eyebrow ? (
          <p
            className={`mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-400/90 ${centered ? "text-center" : ""}`}
          >
            {eyebrow}
          </p>
        ) : null}
        {title ? <TitleTag className={titleClass}>{title}</TitleTag> : null}
        {lead ? <p className={leadClass}>{lead}</p> : null}
        {children ? (
          <div className={title || lead ? contentGapClassName : undefined}>{children}</div>
        ) : null}
      </div>
    </section>
  );
}
