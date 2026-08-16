import { NextResponse } from "next/server";

import { adminApiRoute } from "@/lib/admin/api-route";
import {
  createMarketingCampaign,
  listMarketingCampaigns,
} from "@/lib/outbound/campaigns-storage";
import { campaignInputSchema } from "@/lib/outbound/schemas";

export async function GET() {
  return adminApiRoute(async () => ({ campaigns: await listMarketingCampaigns() }));
}

export async function POST(request: Request) {
  return adminApiRoute(async () => {
    const body = campaignInputSchema.parse(await request.json());
    const campaign = await createMarketingCampaign(body);
    return NextResponse.json({ campaign }, { status: 201 });
  });
}
