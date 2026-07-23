const EMBEDDING_MODEL =
  process.env.OPENAI_EMBEDDING_MODEL?.trim() || "text-embedding-3-small";

export async function embedText(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  const input = text.trim().slice(0, 8000);
  if (!input) {
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
    console.error("[support/embeddings] OpenAI embeddings failed", response.status);
    return null;
  }

  const json = (await response.json()) as {
    data?: Array<{ embedding?: number[] }>;
  };

  return json.data?.[0]?.embedding ?? null;
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
