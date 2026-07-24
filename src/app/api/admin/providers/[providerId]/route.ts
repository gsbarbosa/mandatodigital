import { z } from "zod";

import { adminApiRoute } from "@/lib/admin/api-route";
import {
  addProviderSecretKey,
  clearProviderSecretOverride,
  isEditableProviderId,
  listProviderKeyPublic,
  removeProviderSecretKey,
  reorderProviderSecretKeys,
  setProviderSecretKeyEnabled,
} from "@/lib/admin/provider-secrets";
import { isPoolProviderId } from "@/lib/admin/provider-catalog";
import { fetchProviderAccountStatus } from "@/lib/admin/provider-status";
import { getAdminSession } from "@/lib/admin/session";

type RouteContext = {
  params: Promise<{ providerId: string }>;
};

async function statusPayload(providerId: Parameters<typeof fetchProviderAccountStatus>[0]) {
  const status = await fetchProviderAccountStatus(providerId);
  const keys = await listProviderKeyPublic(providerId);
  return {
    providerId,
    status: {
      ...status,
      keys,
      supportsPool: isPoolProviderId(providerId),
    },
  };
}

export async function GET(_request: Request, context: RouteContext) {
  return adminApiRoute(async () => {
    const { providerId } = await context.params;
    if (!isEditableProviderId(providerId)) {
      throw new Error("Provedor sem key editável no admin.");
    }
    return statusPayload(providerId);
  });
}

const putSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save"),
    apiKey: z.string().trim().min(16).max(400),
    label: z.string().trim().max(60).optional(),
  }),
  z.object({
    action: z.literal("clear"),
  }),
  z.object({
    action: z.literal("remove_key"),
    keyId: z.string().trim().min(1),
  }),
  z.object({
    action: z.literal("set_enabled"),
    keyId: z.string().trim().min(1),
    enabled: z.boolean(),
  }),
  z.object({
    action: z.literal("reorder"),
    keyIds: z.array(z.string().trim().min(1)).min(1).max(10),
  }),
]);

export async function PUT(request: Request, context: RouteContext) {
  return adminApiRoute(async () => {
    const { providerId } = await context.params;
    if (!isEditableProviderId(providerId)) {
      throw new Error("Provedor sem key editável no admin.");
    }

    const body = putSchema.parse(await request.json());
    const session = await getAdminSession();
    const updatedBy = session?.email || "admin";

    if (body.action === "clear") {
      await clearProviderSecretOverride(providerId);
      return { ok: true, cleared: true, ...(await statusPayload(providerId)) };
    }

    if (body.action === "remove_key") {
      await removeProviderSecretKey({ providerId, keyId: body.keyId, updatedBy });
      return { ok: true, ...(await statusPayload(providerId)) };
    }

    if (body.action === "set_enabled") {
      await setProviderSecretKeyEnabled({
        providerId,
        keyId: body.keyId,
        enabled: body.enabled,
        updatedBy,
      });
      return { ok: true, ...(await statusPayload(providerId)) };
    }

    if (body.action === "reorder") {
      await reorderProviderSecretKeys({
        providerId,
        keyIds: body.keyIds,
        updatedBy,
      });
      return { ok: true, ...(await statusPayload(providerId)) };
    }

    const saved = await addProviderSecretKey({
      providerId,
      token: body.apiKey,
      updatedBy,
      label: body.label,
    });
    return {
      ok: true,
      hint: saved.key.hint,
      updatedAt: saved.key.updatedAt,
      ...(await statusPayload(providerId)),
    };
  });
}
