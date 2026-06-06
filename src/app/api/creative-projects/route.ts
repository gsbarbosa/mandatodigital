import { NextResponse } from "next/server";
import { z } from "zod";

import { apiRoute } from "@/lib/auth/api-route";
import { creativeProjectStorage } from "@/lib/creative-project-storage";
import { creativeProjectStatuses } from "@/lib/types";

const creativeProjectInputSchema = z.object({
  topic: z.string().default(""),
  personaArchetypes: z.array(z.string()).default([]),
  voiceTones: z.array(z.string()).default([]),
  scriptDraft: z.string().default(""),
  scriptApproved: z.boolean().default(false),
  freePrompt: z.string().default(""),
  useFreePrompt: z.boolean().default(false),
  avatarTrack: z.enum(["realistic", "caricature"]).default("realistic"),
  caricatureAssetId: z.string().default(""),
  heygenVideoId: z.string().nullable().optional(),
  videoUrl: z.string().default(""),
  captionUrl: z.string().default(""),
  status: z.enum(creativeProjectStatuses).default("ready"),
  errorMessage: z.string().default(""),
});

export async function GET() {
  return apiRoute(async (repository) => {
    const dashboard = await repository.getDashboard();
    const profileId = dashboard.profile?.id;

    if (!profileId) {
      return NextResponse.json({ projects: [] });
    }

    const projects = await creativeProjectStorage.listByProfileId(profileId);

    return NextResponse.json({ projects });
  });
}

export async function POST(request: Request) {
  return apiRoute(async (repository) => {
    const dashboard = await repository.getDashboard();
    const profileId = dashboard.profile?.id ?? null;

    if (!profileId) {
      return NextResponse.json(
        { message: "Salve o perfil no Curador antes de criar um criativo." },
        { status: 400 },
      );
    }

    const parsed = creativeProjectInputSchema.parse(await request.json());
    const project = await creativeProjectStorage.create({
      profileId,
      ...parsed,
      heygenVideoId: parsed.heygenVideoId ?? null,
    });

    return NextResponse.json({ project }, { status: 201 });
  });
}
