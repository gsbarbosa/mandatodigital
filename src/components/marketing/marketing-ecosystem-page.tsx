import { AgentDetailCard } from "@/components/marketing/agent-detail-card";
import { MarketingCtaBand } from "@/components/marketing/marketing-cta-band";
import { MarketingSection } from "@/components/marketing/marketing-section";
import { ecosystemAgents, ecosystemIntro } from "@/lib/marketing/ecossistema-content";

export function MarketingEcosystemPage() {
  return (
    <>
      <MarketingSection
        eyebrow={ecosystemIntro.eyebrow}
        title={ecosystemIntro.title}
        titleAs="h1"
        lead={ecosystemIntro.body}
        className="!border-t-0"
      />

      <div className="mx-auto max-w-6xl space-y-8 px-4 pb-8 sm:px-6">
        {ecosystemAgents.map((agent) => (
          <AgentDetailCard key={agent.id} agent={agent} />
        ))}
      </div>

      <MarketingCtaBand />
    </>
  );
}
