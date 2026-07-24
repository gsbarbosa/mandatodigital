import type { RssNewsItem } from "@/lib/sentinel-rss";

/**
 * Garante que o artigo primary (maior score) fica em articles[0],
 * alinhando headline da UI com topic/briefing.
 */
export function orderClusterArticlesForDisplay(
  primary: RssNewsItem,
  articles: RssNewsItem[],
  maxArticles: number,
): RssNewsItem[] {
  const primaryKey = primary.link.trim() || primary.title.trim();
  const rest = articles
    .filter((article) => {
      const key = article.link.trim() || article.title.trim();
      return key !== primaryKey;
    })
    .sort((left, right) => {
      const leftTime = left.publishedAt?.getTime() ?? 0;
      const rightTime = right.publishedAt?.getTime() ?? 0;
      return rightTime - leftTime;
    });

  return [primary, ...rest].slice(0, maxArticles);
}
