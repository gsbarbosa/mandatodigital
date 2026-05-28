import { NextResponse } from "next/server";

import { apiRoute } from "@/lib/auth/api-route";
import { handleRouteError } from "@/lib/api";
import { formatHeyGenError, heygenListAvatarLooks } from "@/lib/heygen";

export async function GET(request: Request) {
  try {
    return apiRoute(async () => {
      const searchParams = new URL(request.url).searchParams;
      const ownership = (searchParams.get("ownership")?.trim() ||
        "private") as "private" | "public";
      const avatarType = (searchParams.get("avatarType")?.trim() ||
        "digital_twin") as "digital_twin" | "photo_avatar" | "studio_avatar";

      const response = await heygenListAvatarLooks({
        ownership,
        avatarType,
        limit: 50,
      });

      return NextResponse.json({
        looks: response.data?.avatar_looks ?? [],
        nextToken: response.next_token ?? null,
        hasMore: Boolean(response.has_more),
      });
    });
  } catch (error) {
    return handleRouteError(new Error(formatHeyGenError(error)));
  }
}

