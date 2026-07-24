import { z } from "zod";

import { adminApiRoute } from "@/lib/admin/api-route";
import {
  addProviderSecretKey,
  clearProviderSecretOverride,
  listProviderKeyPublic,
} from "@/lib/admin/provider-secrets";
import { fetchProviderAccountStatus } from "@/lib/admin/provider-status";
import { getAdminSession } from "@/lib/admin/session";

/** Compat com clients antigos — preferir `/api/admin/providers/[providerId]`. */

export async function GET() {
  return adminApiRoute(async () => {
    const status = await fetchProviderAccountStatus("apify");
    const keys = await listProviderKeyPublic("apify");
    const full = { ...status, keys, supportsPool: true };
    return { providerId: "apify", status: full, apify: full };
  });
}

const putSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save"),
    apiKey: z.string().trim().min(16).max(400),
  }),
  z.object({
    action: z.literal("clear"),
  }),
]);

export async function PUT(request: Request) {
  return adminApiRoute(async () => {
    const body = putSchema.parse(await request.json());
    const session = await getAdminSession();
    const updatedBy = session?.email || "admin";

    if (body.action === "clear") {
      await clearProviderSecretOverride("apify");
      const status = await fetchProviderAccountStatus("apify");
      const keys = await listProviderKeyPublic("apify");
      const full = { ...status, keys, supportsPool: true };
      return { ok: true, cleared: true, providerId: "apify", status: full, apify: full };
    }

    const saved = await addProviderSecretKey({
      providerId: "apify",
      token: body.apiKey,
      updatedBy,
    });
    const status = await fetchProviderAccountStatus("apify");
    const keys = await listProviderKeyPublic("apify");
    const full = { ...status, keys, supportsPool: true };
    return {
      ok: true,
      hint: saved.key.hint,
      updatedAt: saved.key.updatedAt,
      providerId: "apify",
      status: full,
      apify: full,
    };
  });
}
