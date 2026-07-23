import { adminApiRoute } from "@/lib/admin/api-route";
import { adminCloseSupportThread } from "@/lib/support/service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  return adminApiRoute(async () => {
    const { id } = await context.params;
    const thread = await adminCloseSupportThread(id);
    return { thread };
  });
}
