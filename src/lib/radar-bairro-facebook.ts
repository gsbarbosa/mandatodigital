/**
 * Coleta de posts de grupos públicos do Facebook via Apify.
 *
 * Por que um ator pago e não o scraper genérico: testamos o caminho genérico
 * (navegador sem login) contra 3 grupos reais em 2 cidades e o Facebook
 * redirecionou 100% deles pra tela de login, marcando a requisição como
 * "crawler mode" — é bloqueio ativo, não instabilidade. O ator dedicado usa
 * proxy residencial e funciona sem nenhuma credencial de conta pessoal (o
 * `cookieString` dele é opcional e NÃO usamos: pendurar o produto numa conta
 * real do Facebook seria risco de banimento e de termos de uso).
 *
 * Ver docs/radar-de-bairro.md.
 */

import { isRadarBairroEnabled } from "@/lib/feature-flags";
import type { RadarBairroPost } from "@/lib/radar-bairro-types";

/** Default trocável por env — o ator oficial da Apify é o mais barato dos testados. */
const DEFAULT_ACTOR = "apify/facebook-groups-scraper";

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function readTimestamp(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const millis = value > 1_000_000_000_000 ? value : value * 1000;
    return new Date(millis).toISOString();
  }
  return null;
}

/**
 * Post que o Facebook devolve como indisponível (apagado, ou visibilidade
 * restrita depois da coleta). Vem com título fixo em inglês e sem texto — não é
 * conteúdo, é lápide; foi ~1/3 da amostra num dos grupos testados.
 */
function isUnavailablePost(row: Record<string, unknown>): boolean {
  return readString(row.title).toLowerCase().startsWith("this content isn't available");
}

/**
 * Normaliza o dataset cru do ator. Tolerante a campo faltando: o mesmo ator
 * devolve linha de erro (`error`/`errorDescription`) junto com as de post.
 */
export function normalizeFacebookGroupItems(
  items: unknown[],
  localityName: string,
): RadarBairroPost[] {
  const posts: RadarBairroPost[] = [];
  const seen = new Set<string>();

  for (const raw of items) {
    if (!raw || typeof raw !== "object") {
      continue;
    }
    const row = raw as Record<string, unknown>;

    // Linha de erro do ator (grupo privado/vazio) — não é post.
    if (readString(row.error)) {
      continue;
    }
    if (isUnavailablePost(row)) {
      continue;
    }

    const url = readString(row.url) || readString(row.facebookUrl);
    const text = readString(row.text);
    if (!url || !text) {
      // Post só de imagem/link, sem legenda: não há o que classificar.
      continue;
    }

    const id = readString(row.legacyId) || readString(row.id) || url;
    // Dedup: o mesmo autor repostando o mesmo texto apareceu de verdade na amostra.
    const dedupKey = `${readString((row.user as Record<string, unknown> | undefined)?.name)}::${text.slice(0, 120)}`;
    if (seen.has(dedupKey)) {
      continue;
    }
    seen.add(dedupKey);

    posts.push({
      id,
      url,
      text,
      publishedAt: readTimestamp(row.time) ?? readTimestamp(row.timestamp),
      authorName: readString((row.user as Record<string, unknown> | undefined)?.name),
      likes: readNumber(row.likesCount),
      comments: readNumber(row.commentsCount),
      groupTitle: readString(row.groupTitle),
      localityName,
    });
  }

  return posts.sort((left, right) => {
    const leftTime = left.publishedAt ? new Date(left.publishedAt).getTime() : 0;
    const rightTime = right.publishedAt ? new Date(right.publishedAt).getTime() : 0;
    return rightTime - leftTime;
  });
}

/**
 * Busca posts recentes de um grupo público. Devolve [] em qualquer falha —
 * nunca lança: um grupo que saiu do ar não pode derrubar a coleta dos outros.
 */
export async function fetchFacebookGroupPosts(input: {
  groupUrl: string;
  localityName: string;
  limit?: number;
}): Promise<RadarBairroPost[]> {
  if (!isRadarBairroEnabled()) {
    return [];
  }

  const groupUrl = input.groupUrl.trim();
  if (!groupUrl) {
    return [];
  }

  const limit = Math.max(1, Math.min(input.limit ?? 30, 60));
  const actor = (process.env.RADAR_BAIRRO_FACEBOOK_ACTOR_ID?.trim() || DEFAULT_ACTOR).replace(
    "/",
    "~",
  );

  const runOnce = async (token: string): Promise<RadarBairroPost[]> => {
    if (!token) {
      return [];
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000);

    try {
      const response = await fetch(
        `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startUrls: [{ url: groupUrl }],
            resultsLimit: limit,
          }),
          signal: controller.signal,
          next: { revalidate: 0 },
        },
      );

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        console.warn(
          `[radar-bairro] Apify ${response.status} para ${groupUrl}: ${errorBody.slice(0, 200)}`,
        );
        const { ProviderHttpError } = await import("@/lib/admin/provider-key-pool");
        throw new ProviderHttpError({
          providerId: "apify",
          status: response.status,
          message: `Apify HTTP ${response.status}`,
          body: errorBody.slice(0, 400),
        });
      }

      const items = (await response.json()) as unknown;
      return Array.isArray(items) ? normalizeFacebookGroupItems(items, input.localityName) : [];
    } finally {
      clearTimeout(timeout);
    }
  };

  try {
    const { runWithProviderKeyPool } = await import("@/lib/admin/provider-key-pool");
    return await runWithProviderKeyPool("apify", async (token) => runOnce(token));
  } catch (error) {
    // Mesmo tratamento do sentinel-instagram-posts: sem key configurada, tenta o
    // token direto; qualquer outra falha vira lista vazia.
    if (error instanceof Error && error.message.includes("Nenhuma API key")) {
      const { resolveApifyToken } = await import("@/lib/sentinel-instagram-posts");
      const token = await resolveApifyToken();
      if (!token) {
        return [];
      }
      try {
        return await runOnce(token);
      } catch {
        return [];
      }
    }
    console.warn("[radar-bairro] pool Apify esgotado:", error);
    return [];
  }
}
