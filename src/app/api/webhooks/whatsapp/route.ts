import { NextResponse } from "next/server";

import { appLog, appLogError } from "@/lib/observability/log";
import { handleInboundMessage } from "@/lib/outbound/inbound-handler";
import { isValidSignature, parseWebhookPayload } from "@/lib/outbound/whatsapp-webhook";

/**
 * Webhook da WhatsApp Cloud API.
 *
 * GET  — handshake de verificação do painel da Meta (`hub.challenge`).
 * POST — mensagens recebidas e status de entrega.
 *
 * Doc: docs/marketing-outbound.md
 */

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge") ?? "";

  const expected = process.env.WHATSAPP_VERIFY_TOKEN?.trim();
  if (!expected) {
    appLogError("marketing", "whatsapp_verify_token_missing", new Error("sem WHATSAPP_VERIFY_TOKEN"));
    return new NextResponse("verify token não configurado", { status: 500 });
  }

  if (mode === "subscribe" && token === expected) {
    appLog("marketing", "whatsapp_webhook_verified", {});
    // A Meta exige o challenge cru em text/plain.
    return new NextResponse(challenge, {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  }

  return new NextResponse("forbidden", { status: 403 });
}

export async function POST(request: Request) {
  // Corpo cru: a assinatura é sobre os bytes exatos, então nada de parse antes.
  const rawBody = await request.text();
  const appSecret = process.env.WHATSAPP_APP_SECRET?.trim() || "";

  if (!appSecret) {
    // Fail-closed: sem segredo não dá para provar que veio da Meta, e o webhook
    // é uma URL pública que dispara chamada de LLM e envio de mensagem.
    appLogError("marketing", "whatsapp_app_secret_missing", new Error("sem WHATSAPP_APP_SECRET"));
    return new NextResponse("app secret não configurado", { status: 500 });
  }

  if (
    !isValidSignature({
      rawBody,
      signatureHeader: request.headers.get("x-hub-signature-256"),
      appSecret,
    })
  ) {
    appLogError("marketing", "whatsapp_signature_invalid", new Error("assinatura inválida"), {
      bodyBytes: rawBody.length,
    });
    return new NextResponse("assinatura inválida", { status: 401 });
  }

  let payload: unknown = null;
  try {
    payload = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    return NextResponse.json({ ok: true, ignored: "payload não-JSON" });
  }

  const { messages, statuses } = parseWebhookPayload(payload);
  appLog("marketing", "whatsapp_webhook_received", {
    messages: messages.length,
    statuses: statuses.length,
  });

  // A Meta reentrega o evento se a resposta demorar (~20s) — por isso cada
  // mensagem é tratada em sequência e qualquer falha é engolida com log: 200
  // sempre, e a idempotência por wamid protege contra reentrega.
  for (const message of messages) {
    try {
      await handleInboundMessage(message);
    } catch (error) {
      appLogError("marketing", "whatsapp_inbound_failed", error, {
        from: message.from,
        providerMessageId: message.providerMessageId,
      });
    }
  }

  return NextResponse.json({ ok: true, received: messages.length });
}
