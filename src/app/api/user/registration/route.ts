import { NextResponse } from "next/server";
import { z } from "zod";

import { apiRoute } from "@/lib/auth/api-route";
import { handleRouteError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth/session";
import { mergeProfileInputForSave } from "@/lib/profile-save";
import { profileInputSchema } from "@/lib/schemas";
import {
  completeUserRegistration,
  ensureUserRegistration,
  getUserRegistrationForOwner,
  toEarlyAccessReservationShape,
  updateUserRegistrationTeamContact,
} from "@/lib/user-registration-storage";

const completeSchema = z.object({
  fullName: z.string().trim().min(3),
  party: z.string().trim().min(2),
  cpf: z
    .string()
    .trim()
    .refine((value) => value.replace(/\D/g, "").length === 11, {
      message: "CPF invalido — informe os 11 digitos.",
    }),
  uf: z
    .string()
    .trim()
    .length(2)
    .transform((value) => value.toUpperCase()),
  role: z.string().trim().min(2),
  address: z.string().trim().min(5),
  phone: z.string().trim().min(8),
  email: z.string().trim().email().or(z.literal("")).optional(),
  teamEmail: z.string().trim().email().or(z.literal("")).default(""),
  teamPhone: z.string().trim().default(""),
  planId: z.enum(["essencial", "avancado", "elite"]),
});

const teamSchema = z.object({
  teamEmail: z.string().trim().email().or(z.literal("")).default(""),
  teamPhone: z.string().trim().default(""),
});

export async function GET() {
  return apiRoute(async () => {
    const session = await getSessionUser();
    const stored = session
      ? await ensureUserRegistration({
          ownerUserId: session.id,
          email: session.email,
        })
      : await getUserRegistrationForOwner();

    return NextResponse.json({
      registration: stored,
      /** Compat com UI de early-access (planos/CNPJ/cache local). */
      reservation: stored ? toEarlyAccessReservationShape(stored) : null,
      profileId: stored?.profileId ?? null,
      authEmail: session?.email?.trim() || null,
    });
  });
}

export async function POST(request: Request) {
  try {
    return await apiRoute(async (repository) => {
      const session = await getSessionUser();
      const body = completeSchema.parse(await request.json());
      const authEmail = session?.email?.trim() || "";
      const email = String(body.email ?? "").trim() || authEmail;

      if (!email) {
        return NextResponse.json(
          { message: "Informe um e-mail ou faca login com uma conta que tenha e-mail." },
          { status: 400 },
        );
      }

      const data = { ...body, email };

      const dashboard = await repository.getDashboard();
      const merged = mergeProfileInputForSave(
        {
          fullName: data.fullName,
          role: data.role,
          city: "",
          state: data.uf,
          audience: "",
          spectrum: "",
          archetype: "",
          voiceTones: [],
          keyIssues: [],
          slogans: [],
          redLines: [],
          referenceExamples: [],
          bio: "",
          personaArchetypes: [],
          sentinelThemes: [],
          sentinelThemesFederal: [],
          sentinelThemesEstadual: [],
          oppositionThemes: [],
          customRadarThemes: [],
          interestProfiles: [],
          interestSites: [],
          oppositionProfiles: [],
          oppositionSites: [],
          glossaryTerms: [],
          trainingReferenceLinks: [],
          youtubeVideoUrl: "",
          avatarType: "",
          avatarVideoTopic: "",
          notificationEmail: email,
          avatarEmotions: [],
          voicePace: "",
          editingStyles: [],
          factCheckingSources: [],
          hardDataSources: [],
          distributionChannels: [],
          distributionWindows: [],
          autoPublish: false,
        },
        dashboard.profile,
        { allowDraftDefaults: true },
      );
      const profile = await repository.saveProfile(profileInputSchema.parse(merged));

      const stored = await completeUserRegistration({
        data,
        profileId: profile.id,
      });

      return NextResponse.json(
        {
          registration: stored,
          reservation: toEarlyAccessReservationShape(stored),
          profileId: stored.profileId,
          profile,
          authEmail: authEmail || null,
        },
        { status: 201 },
      );
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    return await apiRoute(async () => {
      const body = teamSchema.parse(await request.json());
      const stored = await updateUserRegistrationTeamContact(body);
      return NextResponse.json({
        registration: stored,
        reservation: toEarlyAccessReservationShape(stored),
        profileId: stored.profileId,
      });
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
