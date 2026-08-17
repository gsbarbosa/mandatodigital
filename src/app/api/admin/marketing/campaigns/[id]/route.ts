import { NextResponse } from "next/server";

import { adminApiRoute } from "@/lib/admin/api-route";
import {
  deleteMarketingCampaign,
  getMarketingCampaign,
  listCampaignSends,
  updateMarketingCampaign,
} from "@/lib/outbound/campaigns-storage";
import { previewCampaignAudience } from "@/lib/outbound/dispatch";
import { campaignPatchSchema } from "@/lib/outbound/schemas";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  return adminApiRoute(async () => {
    const { id } = await context.params;
    const campaign = await getMarketingCampaign(id);
    if (!campaign) {
      return NextResponse.json({ message: "Campanha não encontrada." }, { status: 404 });
    }

    const sends = await listCampaignSends(id);

    // Prévia é best-effort: segmento apagado não pode derrubar a tela de detalhe.
    let audience = null;
    try {
      audience = await previewCampaignAudience(campaign);
    } catch {
      audience = null;
    }

    return { campaign, sends, audience };
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  return adminApiRoute(async () => {
    const { id } = await context.params;
    const body = campaignPatchSchema.parse(await request.json());
    const campaign = await updateMarketingCampaign(id, body);
    return { campaign };
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  return adminApiRoute(async () => {
    const { id } = await context.params;
    await deleteMarketingCampaign(id);
    return NextResponse.json({ ok: true });
  });
}
