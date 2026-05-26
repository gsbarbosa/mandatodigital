import { AuditorDetailPage } from "@/components/product/auditor-detail-page";

export default async function AuditorDetailRoute({
  params,
}: {
  params: Promise<{ contentId: string }>;
}) {
  const { contentId } = await params;

  return <AuditorDetailPage contentId={contentId} />;
}
