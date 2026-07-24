import { redirect } from "next/navigation";

export default async function AuditorDetailRoute({
  params,
}: {
  params: Promise<{ contentId: string }>;
}) {
  await params;
  redirect("/auditoria");
}
