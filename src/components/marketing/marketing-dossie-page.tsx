import { MarketingCtaBand } from "@/components/marketing/marketing-cta-band";
import { MarketingSection } from "@/components/marketing/marketing-section";
import {
  dossieHeader,
  dossieNotice,
  dossieSections,
  type DossieBullet,
} from "@/lib/marketing/dossie-content";

function DossieBulletItem({ bullet }: { bullet: DossieBullet }) {
  return (
    <li className="grid grid-cols-[20px_minmax(0,1fr)] gap-x-3">
      <span className="mt-[9px] block h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
      <p className="m-0 text-justify text-sm leading-[1.6] text-slate-300 sm:text-base">
        {bullet.lead ? (
          <>
            <strong className="font-semibold text-white">{bullet.lead}</strong> {bullet.body}
          </>
        ) : (
          bullet.body
        )}
      </p>
    </li>
  );
}

export function MarketingDossiePage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-slate-800/40">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_70%_20%,rgba(52,211,153,0.10),transparent_55%)]"
          aria-hidden
        />
        <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <p className="mb-4 inline-flex rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-400">
            {dossieHeader.eyebrow}
          </p>
          <h1 className="whitespace-nowrap text-[clamp(0.55rem,2.6vw,1.7rem)] font-bold tracking-tight text-white">
            {dossieHeader.title}
          </h1>

          <div className="mt-8 max-w-3xl rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 text-left">
            <dl className="grid gap-4 sm:grid-cols-2">
              {dossieHeader.meta.map((item) => (
                <div key={item.label}>
                  <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    {item.label}
                  </dt>
                  <dd className="mt-1 text-justify text-sm leading-relaxed text-slate-300">
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {dossieSections.map((section) => (
        <MarketingSection
          key={section.number}
          title={`${section.number}. ${section.title}`}
          lead={section.body}
          titleNoWrap
          justifyLead
        >
          {section.bullets ? (
            <ul className="m-0 list-none space-y-4 p-0">
              {section.bullets.map((bullet, index) => (
                <DossieBulletItem key={index} bullet={bullet} />
              ))}
            </ul>
          ) : null}
        </MarketingSection>
      ))}

      <MarketingSection>
        <div className="mx-auto max-w-4xl rounded-3xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 via-slate-900/60 to-slate-950 p-8 sm:p-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-400">
            {dossieNotice.title}
          </p>
          <p className="mt-3 text-justify text-sm leading-relaxed text-slate-300 sm:text-base">
            {dossieNotice.body}
          </p>
        </div>
      </MarketingSection>

      <MarketingCtaBand />
    </>
  );
}
