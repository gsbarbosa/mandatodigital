const FETCH_TIMEOUT_MS = 8_000;
const MAX_EXTRACT_CHARS = 4_000;

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchArticleText(url: string): Promise<string | null> {
  const trimmed = url.trim();
  if (!trimmed.startsWith("http")) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(trimmed, {
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "User-Agent": "MandatoDigital-Validador/1.0",
      },
      signal: controller.signal,
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    const text = stripHtml(html).slice(0, MAX_EXTRACT_CHARS);
    return text.length >= 80 ? text : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchArticlesCorpus(
  articles: Array<{ title: string; url: string; sourceName?: string }>,
) {
  const snippets: string[] = [];

  for (const article of articles.slice(0, 4)) {
    const body = await fetchArticleText(article.url);
    const header = `[${article.sourceName ?? "Fonte"}] ${article.title} (${article.url})`;
    snippets.push(body ? `${header}\n${body}` : `${header}\n(conteúdo indisponível para fetch)`);
  }

  return snippets.join("\n\n---\n\n");
}
