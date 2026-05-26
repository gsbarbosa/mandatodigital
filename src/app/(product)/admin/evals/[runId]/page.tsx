import { redirect } from "next/navigation";

export default async function AdminEvalDetailRoute({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  await params;
  redirect("/curador");
}
