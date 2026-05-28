import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api";
import { formatHeyGenError, heygenGetUserMe } from "@/lib/heygen";

export async function GET() {
  try {
    const me = await heygenGetUserMe();
    return NextResponse.json(me);
  } catch (error) {
    return handleRouteError(new Error(formatHeyGenError(error)));
  }
}

