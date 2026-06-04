import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api";
import { formatHeyGenError, heygenGetUserMe } from "@/lib/heygen";
import { heygenApiRoute } from "@/lib/heygen-api-route";

export async function GET(request: Request) {
  try {
    return heygenApiRoute(request, async () => {
      const me = await heygenGetUserMe();
      return NextResponse.json(me);
    });
  } catch (error) {
    return handleRouteError(new Error(formatHeyGenError(error)));
  }
}
