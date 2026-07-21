import {
  IconAlert,
  IconBarcode,
  IconFileCheck,
  IconGavel,
  IconIdCard,
  IconLock,
  IconPix,
  IconReceipt,
  IconScale,
  IconScreenshot,
  IconShieldCheck,
  IconSilence,
  MarketingIconBadge,
} from "@/components/marketing/icons";
import { MarketingCard } from "@/components/marketing/marketing-card";
import { MarketingCtaBand } from "@/components/marketing/marketing-cta-band";
import { MarketingSection } from "@/components/marketing/marketing-section";
import {
  complianceAccounting,
  complianceContract,
  complianceElectoral,
  complianceHero,
  complianceNetwork,
  complianceOnboarding,
  compliancePayments,
  compliancePrivacy,
  complianceProtection,
} from "@/lib/marketing/compliance-content";

const emeraldBadge = (
  <MarketingIconBadge className="border-emerald-500/25 bg-emerald-500/10 text-emerald-400">
    <IconShieldCheck size={20} />
  </MarketingIconBadge>
);

export function MarketingCompliancePage() {
  return (
    <>
      <MarketingSection
        eyebrow={complianceHero.eyebrow}
        title={complianceHero.title}
        titleAs="h1"
        lead={complianceHero.body}
        className="!border-t-0"
      />

      <MarketingSection title={complianceElectoral.title}>
        <div className="grid gap-4 md:grid-cols-2">
          <MarketingCard
            title={complianceElectoral.cards[0].title}
            icon={
              <MarketingIconBadge className="border-emerald-500/25 bg-emerald-500/10 text-emerald-400">
                <IconGavel size={20} />
              </MarketingIconBadge>
            }
          >
            <p>{complianceElectoral.cards[0].body}</p>
          </MarketingCard>
          <MarketingCard
            title={complianceElectoral.cards[1].title}
            icon={
              <MarketingIconBadge className="border-amber-500/25 bg-amber-500/10 text-amber-400">
                <IconSilence size={20} />
              </MarketingIconBadge>
            }
          >
            <p>{complianceElectoral.cards[1].body}</p>
          </MarketingCard>
        </div>
      </MarketingSection>

      <MarketingSection title={complianceAccounting.title} lead={complianceAccounting.body}>
        <div className="mb-6 flex items-center gap-3">
          {emeraldBadge}
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-emerald-400">
              {complianceAccounting.highlight}
            </p>
            <h3 className="text-xl font-bold text-white">{complianceAccounting.subtitle}</h3>
          </div>
        </div>
        <ul className="space-y-3">
          {complianceAccounting.items.map((item) => (
            <li
              key={item}
              className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 text-sm text-slate-300"
            >
              <MarketingIconBadge className="mt-0.5 !h-8 !w-8 border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                <IconReceipt size={16} />
              </MarketingIconBadge>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </MarketingSection>

      <MarketingSection title={compliancePrivacy.title}>
        <div className="grid gap-4 md:grid-cols-2">
          <MarketingCard
            title={compliancePrivacy.cards[0].title}
            icon={
              <MarketingIconBadge className="border-rose-500/25 bg-rose-500/10 text-rose-400">
                <IconShieldCheck size={20} />
              </MarketingIconBadge>
            }
          >
            <p>{compliancePrivacy.cards[0].body}</p>
          </MarketingCard>
          <MarketingCard
            title={compliancePrivacy.cards[1].title}
            icon={
              <MarketingIconBadge className="border-blue-500/25 bg-blue-500/10 text-blue-400">
                <IconLock size={20} />
              </MarketingIconBadge>
            }
          >
            <p>{compliancePrivacy.cards[1].body}</p>
          </MarketingCard>
        </div>
      </MarketingSection>

      <MarketingSection title={complianceProtection.title}>
        <div className="grid gap-4 md:grid-cols-3">
          {[IconScale, IconFileCheck, IconScreenshot].map((Icon, index) => {
            const item = complianceProtection.items[index];
            return (
              <MarketingCard
                key={item.title}
                title={item.title}
                icon={
                  <MarketingIconBadge className="border-emerald-500/25 bg-emerald-500/10 text-emerald-400">
                    <Icon size={20} />
                  </MarketingIconBadge>
                }
              >
                <p>{item.body}</p>
              </MarketingCard>
            );
          })}
        </div>
      </MarketingSection>

      <MarketingSection title={compliancePayments.title} lead={compliancePayments.subtitle}>
        <div className="grid gap-4 sm:grid-cols-2">
          {[IconPix, IconBarcode, IconReceipt, IconIdCard].map((Icon, index) => {
            const item = compliancePayments.items[index];
            return (
              <MarketingCard
                key={item.title}
                title={item.title}
                icon={
                  <MarketingIconBadge className="border-slate-700 bg-slate-950/70 text-slate-200">
                    <Icon size={20} />
                  </MarketingIconBadge>
                }
              >
                <p>{item.body}</p>
              </MarketingCard>
            );
          })}
        </div>
      </MarketingSection>

      <MarketingSection title={complianceContract.title}>
        <div className="grid gap-4 md:grid-cols-2">
          <MarketingCard
            title={complianceContract.cards[0].title}
            icon={
              <MarketingIconBadge className="border-emerald-500/25 bg-emerald-500/10 text-emerald-400">
                <IconFileCheck size={20} />
              </MarketingIconBadge>
            }
          >
            <p>{complianceContract.cards[0].body}</p>
          </MarketingCard>
          <MarketingCard
            title={complianceContract.cards[1].title}
            icon={
              <MarketingIconBadge className="border-blue-500/25 bg-blue-500/10 text-blue-400">
                <IconReceipt size={20} />
              </MarketingIconBadge>
            }
          >
            <p>{complianceContract.cards[1].body}</p>
          </MarketingCard>
        </div>
      </MarketingSection>

      <MarketingSection title={complianceOnboarding.title}>
        <div className="grid gap-4 md:grid-cols-3">
          {[IconAlert, IconIdCard, IconScale].map((Icon, index) => {
            const card = complianceOnboarding.cards[index];
            return (
              <MarketingCard
                key={card.title}
                title={card.title}
                icon={
                  <MarketingIconBadge className="border-emerald-500/25 bg-emerald-500/10 text-emerald-400">
                    <Icon size={20} />
                  </MarketingIconBadge>
                }
              >
                <p>{card.body}</p>
              </MarketingCard>
            );
          })}
        </div>
      </MarketingSection>

      <MarketingSection title={complianceNetwork.title}>
        <div className="grid gap-4 md:grid-cols-2">
          <MarketingCard
            title={complianceNetwork.cards[0].title}
            icon={
              <MarketingIconBadge className="border-emerald-500/25 bg-emerald-500/10 text-emerald-400">
                <IconFileCheck size={20} />
              </MarketingIconBadge>
            }
          >
            <p>{complianceNetwork.cards[0].body}</p>
          </MarketingCard>
          <MarketingCard
            title={complianceNetwork.cards[1].title}
            icon={
              <MarketingIconBadge className="border-amber-500/25 bg-amber-500/10 text-amber-400">
                <IconAlert size={20} />
              </MarketingIconBadge>
            }
          >
            <p>{complianceNetwork.cards[1].body}</p>
          </MarketingCard>
        </div>
      </MarketingSection>

      <MarketingCtaBand />
    </>
  );
}
