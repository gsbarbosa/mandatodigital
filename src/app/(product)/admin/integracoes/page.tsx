import {
  AdminAccessDenied,
  AdminIntegracoesPage,
} from "@/components/product/admin-integracoes-page";
import { requireSessionUser } from "@/lib/auth/session";
import { isPlatformAdminEmail } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

export default async function AdminIntegracoesRoute() {
  const user = await requireSessionUser();

  if (!isPlatformAdminEmail(user.email)) {
    return <AdminAccessDenied />;
  }

  return <AdminIntegracoesPage />;
}
