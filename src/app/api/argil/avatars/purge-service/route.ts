import { NextResponse } from "next/server";

import { purgePrivateArgilAvatars } from "@/lib/argil-avatar-purge";
import { handleRouteError } from "@/lib/api";

function isAuthorized(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return false;
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const purgeSecret = process.env.ARGIL_PURGE_SECRET?.trim();

  return (
    (serviceKey && token === serviceKey) ||
    (purgeSecret && token === purgeSecret)
  );
}

export async function POST(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as { confirm?: boolean };
    if (!body.confirm) {
      return NextResponse.json(
        { message: 'Envie { "confirm": true } para apagar avatares privados.' },
        { status: 400 },
      );
    }

    const result = await purgePrivateArgilAvatars();
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function GET(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
    }

    const { listPrivateArgilAvatars } = await import("@/lib/argil-avatar-purge");
    const privateAvatars = await listPrivateArgilAvatars();

    return NextResponse.json({
      privateCount: privateAvatars.length,
      privateAvatars: privateAvatars.map((avatar) => ({
        id: avatar.id,
        name: avatar.name,
        status: avatar.status,
      })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
