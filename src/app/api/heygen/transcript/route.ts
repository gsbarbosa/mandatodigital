import { NextResponse } from "next/server";

import { apiRoute } from "@/lib/auth/api-route";
import { handleRouteError } from "@/lib/api";
import { buildAvatarVideoTranscript } from "@/lib/avatar-video-script";

export async function POST(request: Request) {
  try {
    return apiRoute(async (repository) => {
      const body = (await request.json().catch(() => ({}))) as { topic?: string };
      const topic = String(body.topic ?? "").trim();

      if (!topic) {
        return NextResponse.json(
          { message: "Informe o tema do video para gerar o roteiro." },
          { status: 400 },
        );
      }

      const dashboard = await repository.getDashboard();
      const transcript = await buildAvatarVideoTranscript({
        topic,
        profile: dashboard.profile,
      });

      return NextResponse.json({ transcript }, { status: 200 });
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
