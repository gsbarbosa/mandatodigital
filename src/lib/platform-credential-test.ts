import type { PlatformCredentialId } from "@/lib/platform-credential-registry";
import { resolvePlatformCredential } from "@/lib/platform-credentials";

export type PlatformCredentialTestResult = {
  ok: boolean;
  message: string;
};

async function readCredentialForTest(serviceId: PlatformCredentialId, override?: string) {
  const trimmed = override?.trim();
  if (trimmed) {
    return trimmed;
  }
  return resolvePlatformCredential(serviceId);
}

export async function testPlatformCredential(
  serviceId: PlatformCredentialId,
  override?: string,
): Promise<PlatformCredentialTestResult> {
  const apiKey = await readCredentialForTest(serviceId, override);
  if (!apiKey) {
    return { ok: false, message: "Chave nao configurada." };
  }

  try {
    switch (serviceId) {
      case "openai": {
        const response = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(12_000),
        });
        if (!response.ok) {
          const body = await response.text();
          return { ok: false, message: `OpenAI ${response.status}: ${body.slice(0, 180)}` };
        }
        return { ok: true, message: "OpenAI respondeu com sucesso." };
      }
      case "anthropic": {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: process.env.ANTHROPIC_MODEL?.trim() || "claude-3-5-sonnet-latest",
            max_tokens: 8,
            messages: [{ role: "user", content: "ping" }],
          }),
          signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) {
          const body = await response.text();
          return { ok: false, message: `Anthropic ${response.status}: ${body.slice(0, 180)}` };
        }
        return { ok: true, message: "Anthropic aceitou a chave." };
      }
      case "perplexity": {
        const response = await fetch("https://api.perplexity.ai/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: "sonar",
            max_tokens: 16,
            messages: [{ role: "user", content: "Responda apenas: ok" }],
          }),
          signal: AbortSignal.timeout(20_000),
        });
        if (!response.ok) {
          const body = await response.text();
          return { ok: false, message: `Perplexity ${response.status}: ${body.slice(0, 180)}` };
        }
        return { ok: true, message: "Perplexity respondeu com sucesso." };
      }
      case "apify": {
        const response = await fetch("https://api.apify.com/v2/user", {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(12_000),
        });
        if (!response.ok) {
          const body = await response.text();
          return { ok: false, message: `Apify ${response.status}: ${body.slice(0, 180)}` };
        }
        const payload = (await response.json()) as { data?: { username?: string } };
        const username = payload.data?.username?.trim();
        return {
          ok: true,
          message: username ? `Apify conectado como ${username}.` : "Apify conectado.",
        };
      }
      case "heygen": {
        const baseUrl =
          process.env.HEYGEN_BASE_URL?.trim().replace(/\/$/, "") || "https://api.heygen.com";
        const response = await fetch(`${baseUrl}/v1/user/me`, {
          headers: { "x-api-key": apiKey },
          signal: AbortSignal.timeout(12_000),
        });
        const payload = (await response.json().catch(() => ({}))) as {
          message?: string;
          data?: { email?: string; username?: string };
        };
        if (!response.ok) {
          return {
            ok: false,
            message: payload.message || `HeyGen ${response.status}`,
          };
        }
        const label = payload.data?.email || payload.data?.username || "conta HeyGen";
        return { ok: true, message: `HeyGen conectado: ${label}.` };
      }
      case "serpapi": {
        const url = new URL("https://serpapi.com/account");
        url.searchParams.set("api_key", apiKey);
        const response = await fetch(url, { signal: AbortSignal.timeout(12_000) });
        if (!response.ok) {
          const body = await response.text();
          return { ok: false, message: `SerpAPI ${response.status}: ${body.slice(0, 180)}` };
        }
        return { ok: true, message: "SerpAPI aceitou a chave." };
      }
      case "elevenlabs": {
        const response = await fetch("https://api.elevenlabs.io/v1/user", {
          headers: { "xi-api-key": apiKey },
          signal: AbortSignal.timeout(12_000),
        });
        if (!response.ok) {
          const body = await response.text();
          return { ok: false, message: `ElevenLabs ${response.status}: ${body.slice(0, 180)}` };
        }
        return { ok: true, message: "ElevenLabs conectado." };
      }
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Falha ao testar conexao.",
    };
  }
}
