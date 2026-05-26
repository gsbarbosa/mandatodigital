import { MvpShell } from "@/components/mvp-shell";
import { getRepository } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const initialData = await getRepository().getDashboard();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const e2eParam = resolvedSearchParams.e2e;
  const initialOpenFeedback =
    (Array.isArray(e2eParam) ? e2eParam[0] : e2eParam) === "open-feedback";

  return (
    <MvpShell
      initialData={initialData}
      initialOpenFeedback={initialOpenFeedback}
    />
  );
}
