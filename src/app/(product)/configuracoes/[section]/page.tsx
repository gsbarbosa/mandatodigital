import { notFound } from "next/navigation";

import { ConfiguracoesPage } from "@/components/product/configuracoes-page";
import { parseConfigSectionSlug } from "@/lib/config-setup-status";

export default async function ConfiguracoesSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section: sectionSlug } = await params;
  const section = parseConfigSectionSlug(sectionSlug);

  if (!section) {
    notFound();
  }

  return <ConfiguracoesPage section={section} />;
}
