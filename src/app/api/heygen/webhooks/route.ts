import { NextResponse } from "next/server";

// Webhook opcional (HeyGen): neste MVP o Curador-v2 faz polling.
export async function POST(request: Request) {
  const body = await request.text();
  return NextResponse.json({ ok: true, received: Boolean(body) });
}

