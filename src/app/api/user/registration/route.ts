import { NextResponse } from "next/server";
import { z } from "zod";

import { apiRoute } from "@/lib/auth/api-route";
import { handleRouteError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth/session";
import { digitsOnly, isValidCpf, isValidPhoneBr } from "@/lib/br-input";
import { mergeProfileInputForSave } from "@/lib/profile-save";
import { profileInputSchema } from "@/lib/schemas";
import {
  assignUserRegistrationPlan,
  completeUserRegistration,
  ensureUserRegistration,
  findRegistrationByCpf,
  getUserRegistrationForOwner,
  needsPlanSelection,
  saveUserRegistrationPersonalData,
  toEarlyAccessReservationShape,
  updateUserRegistrationTeamContact,
} from "@/lib/user-registration-storage";

const personalFields = {
  fullName: z.string().trim().min(3),
  party: z.string().trim().min(2),
  cpf: z
    .string()
    .trim()
    .refine((value) => isValidCpf(value), {
      message: "CPF invalido.",
    }),
  uf: z
    .string()
    .trim()
    .length(2)
    .transform((value) => value.toUpperCase()),
  role: z.string().trim().min(2),
  address: z.string().trim().min(5),
  phone: z
    .string()
    .trim()
    .refine((value) => isValidPhoneBr(value), {
      message: "Telefone invalido — use DDD + numero.",
    }),
  email: z.string().trim().email().or(z.literal("")).optional(),
  teamEmail: z.string().trim().email().or(z.literal("")).default(""),
  teamPhone: z.string().trim().default(""),
};

const completeSchema = z.object({
  ...personalFields,
  planId: z.enum(["essencial", "avancado", "elite"]).optional(),
});

const teamSchema = z.object({
  teamEmail: z.string().trim().email().or(z.literal("")).default(""),
  teamPhone: z.string().trim().default(""),
});

const planSchema = z.object({
  planId: z.enum(["essencial", "avancado", "elite"]),
});

function buildDraftProfileInput(
  data: {
    fullName: string;
    role: string;
    uf: string;
  },
  email: string,
  dashboardProfile: Parameters<typeof mergeProfileInputForSave>[1],
) {
  return mergeProfileInputForSave(
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
    dashboardProfile,
    { allowDraftDefaults: true },
  );
}

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
      needsPlanSelection: needsPlanSelection(stored),
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

      const personal = {
        fullName: body.fullName,
        party: body.party,
        cpf: digitsOnly(body.cpf),
        uf: body.uf,
        role: body.role,
        address: body.address,
        phone: digitsOnly(body.phone),
        email,
        teamEmail: body.teamEmail,
        teamPhone: digitsOnly(body.teamPhone),
      };

      const duplicate = await findRegistrationByCpf({
        cpf: personal.cpf,
        excludeOwnerUserId: session?.id,
      });
      if (duplicate) {
        return NextResponse.json(
          { message: "Ja existe uma conta cadastrada com este CPF." },
          { status: 409 },
        );
      }

      const dashboard = await repository.getDashboard();
      const merged = buildDraftProfileInput(personal, email, dashboard.profile);
      const profile = await repository.saveProfile(profileInputSchema.parse(merged));

      if (!body.planId) {
        const stored = await saveUserRegistrationPersonalData({
          data: personal,
          profileId: profile.id,
        });

        return NextResponse.json(
          {
            registration: stored,
            reservation: null,
            profileId: stored.profileId,
            profile,
            authEmail: authEmail || null,
            needsPlanSelection: true,
            message: "Dados salvos. Escolha um plano para concluir a reserva.",
          },
          { status: 201 },
        );
      }

      const { registration: stored, seat } = await completeUserRegistration({
        data: { ...personal, planId: body.planId },
        profileId: profile.id,
      });

      return NextResponse.json(
        {
          registration: stored,
          reservation: toEarlyAccessReservationShape(stored),
          profileId: stored.profileId,
          profile,
          authEmail: authEmail || null,
          needsPlanSelection: false,
          seatStatus: seat.status === "reserve" ? "reserve" : "active",
          message: seat.message,
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
      const raw = await request.json();

      if (raw && typeof raw === "object" && "planId" in raw && !("teamEmail" in raw)) {
        const body = planSchema.parse(raw);
        const { registration: stored, seat } = await assignUserRegistrationPlan(body.planId);
        return NextResponse.json({
          registration: stored,
          reservation: toEarlyAccessReservationShape(stored),
          profileId: stored.profileId,
          needsPlanSelection: false,
          seatStatus: seat.status === "reserve" ? "reserve" : "active",
          message: seat.message,
        });
      }

      const body = teamSchema.parse(raw);
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
