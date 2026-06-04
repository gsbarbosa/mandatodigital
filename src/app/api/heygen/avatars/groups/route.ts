import { NextResponse } from "next/server";

import { heygenApiRoute } from "@/lib/heygen-api-route";
import { handleRouteError } from "@/lib/api";
import { formatHeyGenError, heygenListAvatarGroups } from "@/lib/heygen";

export async function GET(request: Request) {
  try {
    return heygenApiRoute(request, async () => {
      const searchParams = new URL(request.url).searchParams;
      const ownership = (searchParams.get("ownership")?.trim() ||
        "private") as "private" | "public";

      const response = await heygenListAvatarGroups({
        ownership,
        limit: 50,
      });

      return NextResponse.json({
        groups: response.data ?? [],
        nextToken: response.next_token ?? null,
        hasMore: Boolean(response.has_more),
      });
    });
  } catch (error) {
    return handleRouteError(new Error(formatHeyGenError(error)));
  }
}
