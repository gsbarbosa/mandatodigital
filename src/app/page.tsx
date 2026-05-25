import { MvpShell } from "@/components/mvp-shell";
import { getRepository } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const initialData = await getRepository().getDashboard();

  return <MvpShell initialData={initialData} />;
}
