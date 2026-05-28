import { NextResponse } from "next/server";

import { apiRoute } from "@/lib/auth/api-route";
import { handleRouteError } from "@/lib/api";
import { formatHeyGenError, heygenGetAvatarGroup } from "@/lib/heygen";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    return apiRoute(async () => {
      const params = await context.params;
      const id = String(params.id ?? "").trim();
      if (!id) {
        return NextResponse.json({ message: "group_id ausente." }, { status: 400 });
      }

      const response = await heygenGetAvatarGroup(id);
      return NextResponse.json({
        group: response.data?.avatar_group ?? null,
        raw: response,
      });
    });
  } catch (error) {
    return handleRouteError(new Error(formatHeyGenError(error)));
  }
}

