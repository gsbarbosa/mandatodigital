import Link from "next/link";

import { MARKETING_CLOSING } from "@/lib/marketing/shared";

export function MarketingCtaBand({
  title = MARKETING_CLOSING.title,
  body = MARKETING_CLOSING.body,
  ctaLabel = MARKETING_CLOSING.ctaLabel,
  ctaHref = MARKETING_CLOSING.ctaHref,
}: {
  title?: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: typeof MARKETING_CLOSING.ctaHref;
}) {
  return (
    <section className="border-t border-slate-800/60 py-16 sm:py-20">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-slate-900/60 to-slate-950 p-8 sm:p-12">
          <h2 className="max-w-3xl text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {title}
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-300">{body}</p>
          <Link
            href={ctaHref}
            className="primary-button mt-8 inline-flex"
          >
            {ctaLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}
