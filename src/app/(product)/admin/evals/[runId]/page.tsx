import { AdminEvalDetailPage } from "@/components/product/admin-eval-detail-page";

export default async function AdminEvalDetailRoute({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;

  return <AdminEvalDetailPage runId={runId} />;
}
