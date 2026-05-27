import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api";
import { runWithApiRepository } from "@/lib/auth/runner";
import type { Repository } from "@/lib/storage";

export async function apiRoute(
  handler: (repository: Repository) => Promise<NextResponse>,
) {
  try {
    const result = await runWithApiRepository(handler);

    if (result instanceof Response) {
      return result;
    }

    return result;
  } catch (error) {
    return handleRouteError(error);
  }
}
