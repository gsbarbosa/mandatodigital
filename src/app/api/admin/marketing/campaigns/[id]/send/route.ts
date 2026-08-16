import { NextResponse } from "next/server";

import { adminApiRoute } from "@/lib/admin/api-route";
import { getMarketingCampaign } from "@/lib/outbound/campaigns-storage";
import { DispatchError, dispatchCampaign } from "@/lib/outbound/dispatch";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  return adminApiRoute(async () => {
    const { id } = await context.params;
    const campaign = await getMarketingCampaign(id);
    if (!campaign) {
      return NextResponse.json({ message: "Campanha não encontrada." }, { status: 404 });
    }

    try {
      const result = await dispatchCampaign(campaign);
      return NextResponse.json({
        ok: true,
        stats: result.stats,
        skippedAlreadySent: result.skippedAlreadySent,
      });
    } catch (error) {
      // Recusa esperada (segmento vazio, canal desligado, teto) é 400, não 500.
      if (error instanceof DispatchError) {
        return NextResponse.json({ message: error.message }, { status: 400 });
      }
      throw error;
    }
  });
}
