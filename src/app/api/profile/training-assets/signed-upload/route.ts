import crypto from "node:crypto";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { handleRouteError } from "@/lib/api";
import { parseTrainingAssetRole } from "@/lib/training-asset-role";
import { buildResumableUploadEndpoint } from "@/lib/training-asset-upload-client";

function getEnv(name: string) {
  return (process.env[name] ?? "").trim();
}

function sanitizeFilename(filename: string) {
  return filename
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function buildStoragePath(referenceId: string, filename: string) {
  const safe = sanitizeFilename(filename) || "arquivo.bin";
  return `${referenceId}/${crypto.randomUUID()}-${safe}`;
}

export async function POST(request: Request) {
  try {
    const url = getEnv("SUPABASE_URL");
    const key = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    const bucketName = getEnv("SUPABASE_TRAINING_ASSETS_BUCKET") || "persona-training-videos";

    if (!url || !key) {
      return NextResponse.json(
        {
          message:
            "Supabase nao configurado. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY para habilitar upload direto.",
        },
        { status: 501 },
      );
    }

    const body = (await request.json()) as {
      profileId?: string;
      draftProfileId?: string;
      trainingRole?: string;
      filename?: string;
    };

    const profileId = String(body.profileId ?? "").trim() || null;
    const draftProfileId = String(body.draftProfileId ?? "").trim() || null;
    const referenceId = profileId ?? draftProfileId;
    const trainingRole = parseTrainingAssetRole(body.trainingRole);
    const filename = String(body.filename ?? "").trim();

    if (!referenceId) {
      return NextResponse.json(
        { message: "Informe profileId ou draftProfileId para vincular o asset." },
        { status: 400 },
      );
    }

    if (!filename) {
      return NextResponse.json({ message: "Informe o nome do arquivo." }, { status: 400 });
    }

    const storagePath = buildStoragePath(referenceId, filename);
    const client = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await client.storage
      .from(bucketName)
      .createSignedUploadUrl(storagePath, { upsert: false });

    if (error || !data?.signedUrl || !data?.token || !data?.path) {
      throw new Error(`Nao foi possivel criar URL assinada: ${error?.message ?? "URL vazia"}`);
    }

    return NextResponse.json(
      {
        trainingRole,
        storageProvider: "supabase",
        storageBucket: bucketName,
        storagePath: data.path,
        signedUrl: data.signedUrl,
        token: data.token,
        resumableEndpoint: buildResumableUploadEndpoint(url),
      },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

