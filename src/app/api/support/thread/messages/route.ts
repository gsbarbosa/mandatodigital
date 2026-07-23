import { NextResponse } from "next/server";
import { z } from "zod";

import { apiRoute } from "@/lib/auth/api-route";
import { sendUserSupportMessage } from "@/lib/support/service";

const bodySchema = z.object({
  body: z.string().trim().min(1).max(4000),
});

export async function POST(request: Request) {
  return apiRoute(async () => {
    const payload = bodySchema.parse(await request.json());
    const thread = await sendUserSupportMessage(payload.body);
    return NextResponse.json({ thread });
  });
}
