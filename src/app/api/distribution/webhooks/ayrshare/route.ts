import { createHmac, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api";
import { appendDistributionAuditFireAndForget } from "@/lib/distribution/audit";
import { ayrsharePlatformToChannelId } from "@/lib/distribution/channels";
import { distributionPostStorage } from "@/lib/distribution/post-storage";
import type { ChannelDeliveryState } from "@/lib/distribution/types";
import { COLLECTIONS, col } from "@/lib/firebase/collections";

export const maxDuration = 60;

function verifyWebhookSignature(rawBody: string, signatureHeader: string | null) {
  const secret = process.env.AYRSHARE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }
  if (!signatureHeader?.trim()) {
    return false;
  }
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided = signatureHeader.replace(/^sha256=/i, "").trim();
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(provided, "utf8");
    if (a.length !== b.length) {
      return false;
    }
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature =
      request.headers.get("x-ayrshare-signature") ||
      request.headers.get("x-signature") ||
      request.headers.get("authorization");

    if (!verifyWebhookSignature(rawBody, signature)) {
      return NextResponse.json({ message: "Assinatura invalida." }, { status: 401 });
    }

    const body = JSON.parse(rawBody || "{}") as Record<string, unknown>;
    const ayrsharePostId =
      typeof body.id === "string"
        ? body.id
        : typeof body.postId === "string"
          ? body.postId
          : null;

    if (!ayrsharePostId) {
      return NextResponse.json({ message: "post id ausente." }, { status: 400 });
    }

    const snap = await col(COLLECTIONS.distributionPosts)
      .where("ayrsharePostId", "==", ayrsharePostId)
      .limit(1)
      .get();

    if (snap.empty) {
      return NextResponse.json({ ok: true, matched: false });
    }

    const post = await distributionPostStorage.getById(snap.docs[0].id);
    if (!post) {
      return NextResponse.json({ ok: true, matched: false });
    }

    const platform =
      typeof body.platform === "string"
        ? body.platform
        : typeof body.socialNetwork === "string"
          ? body.socialNetwork
          : "";
    const channel = ayrsharePlatformToChannelId(platform);
    const statusRaw = String(body.status ?? body.action ?? "").toLowerCase();
    const now = new Date().toISOString();

    if (channel) {
      const nextStatus: ChannelDeliveryState["status"] =
        statusRaw.includes("error") || statusRaw.includes("fail")
          ? "failed"
          : statusRaw.includes("schedule")
            ? "scheduled"
            : "published";

      const perChannelStatus = {
        ...post.perChannelStatus,
        [channel]: {
          status: nextStatus,
          externalPostId:
            typeof body.socialPostId === "string"
              ? body.socialPostId
              : (post.perChannelStatus[channel]?.externalPostId ?? null),
          postUrl:
            typeof body.postUrl === "string"
              ? body.postUrl
              : (post.perChannelStatus[channel]?.postUrl ?? null),
          error:
            nextStatus === "failed"
              ? String(body.message ?? body.error ?? "Falha reportada pelo webhook")
              : null,
          updatedAt: now,
        },
      };

      await distributionPostStorage.update(post.id, { perChannelStatus });

      appendDistributionAuditFireAndForget({
        ownerUserId: post.ownerUserId,
        profileId: post.profileId,
        distributionPostId: post.id,
        action: "webhook_ayrshare",
        channels: [channel],
        payload: { statusRaw, ayrsharePostId },
      });
    }

    return NextResponse.json({ ok: true, matched: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
