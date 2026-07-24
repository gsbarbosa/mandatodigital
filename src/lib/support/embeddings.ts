const EMBEDDING_MODEL =
  process.env.OPENAI_EMBEDDING_MODEL?.trim() || "text-embedding-3-small";

export async function embedText(text: string): Promise<number[] | null> {
  const input = text.trim().slice(0, 8000);
  if (!input) {
    return null;
  }

  const runOnce = async (apiKey: string) => {
    if (!apiKey) {
      return null;
    }

    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      const { ProviderHttpError } = await import("@/lib/admin/provider-key-pool");
      throw new ProviderHttpError({
        providerId: "openai",
        status: response.status,
        message: `OpenAI embeddings failed (${response.status})`,
        body: body.slice(0, 400),
      });
    }

    const json = (await response.json()) as {
      data?: Array<{ embedding?: number[] }>;
    };

    return json.data?.[0]?.embedding ?? null;
  };

  try {
    const { runWithProviderKeyPool } = await import("@/lib/admin/provider-key-pool");
    return await runWithProviderKeyPool("openai", async (token) => runOnce(token));
  } catch (error) {
    if (error instanceof Error && error.message.includes("Nenhuma API key")) {
      let apiKey = process.env.OPENAI_API_KEY?.trim() || "";
      try {
        const { resolveProviderApiKey } = await import("@/lib/admin/provider-secrets");
        const resolved = await resolveProviderApiKey("openai");
        if (resolved.token) {
          apiKey = resolved.token;
        }
      } catch {
        // ignore
      }
      try {
        return await runOnce(apiKey);
      } catch {
        return null;
      }
    }
    console.error("[support/embeddings] OpenAI embeddings failed", error);
    return null;
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
