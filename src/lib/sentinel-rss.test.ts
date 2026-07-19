import { describe, expect, it } from "vitest";

import {
  extractFeedLinkFromHtml,
  extractNewsSitemapUrlsFromRobots,
  looksLikeNewsSitemap,
  looksLikeRssFeed,
  parseNewsSitemap,
  parseRssFeed,
} from "./sentinel-rss";

describe("parseRssFeed", () => {
  it("extracts source name from tags with attributes (Google News shape)", () => {
    const xml = `
      <rss><channel>
        <item>
          <title>Prefeitura anuncia mutirão de saúde - Hora Campinas</title>
          <link>https://news.google.com/rss/articles/abc123</link>
          <pubDate>Mon, 06 Jul 2026 10:00:00 GMT</pubDate>
          <source url="https://www.horacampinas.com.br">Hora Campinas</source>
        </item>
        <item>
          <title>Reforma tributária avança</title>
          <link>https://news.google.com/rss/articles/def456</link>
          <source>G1</source>
        </item>
      </channel></rss>
    `;
    const items = parseRssFeed(xml);
    expect(items).toHaveLength(2);
    expect(items[0].sourceName).toBe("Hora Campinas");
    expect(items[1].sourceName).toBe("G1");
  });
});

describe("looksLikeRssFeed", () => {
  it("aceita RSS/Atom com items", () => {
    expect(looksLikeRssFeed(`<?xml version="1.0"?><rss><channel><item><title>a</title></item></channel></rss>`)).toBe(
      true,
    );
    expect(looksLikeRssFeed(`<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>a</title></entry></feed>`)).toBe(
      true,
    );
  });

  it("rejeita HTML de consent/captcha e corpo vazio", () => {
    expect(looksLikeRssFeed("")).toBe(false);
    expect(
      looksLikeRssFeed("<!DOCTYPE html><html><body>Before you continue to Google</body></html>"),
    ).toBe(false);
    expect(looksLikeRssFeed("<html><head></head><body>ok</body></html>")).toBe(false);
  });
});

describe("extractFeedLinkFromHtml", () => {
  it("acha o link RSS declarado no <head> (formato WordPress)", () => {
    const html = `
      <!DOCTYPE html>
      <html><head>
        <title>Portal Municipal</title>
        <link rel="alternate" type="application/rss+xml" title="Feed" href="/feed/" />
      </head><body>ok</body></html>
    `;
    expect(extractFeedLinkFromHtml(html, "https://portalmunicipal.com.br")).toBe(
      "https://portalmunicipal.com.br/feed/",
    );
  });

  it("aceita Atom e href absoluto, ignora ordem dos atributos", () => {
    const html = `<link href="https://outro.com.br/atom.xml" type="application/atom+xml" rel="alternate">`;
    expect(extractFeedLinkFromHtml(html, "https://portal.com.br")).toBe(
      "https://outro.com.br/atom.xml",
    );
  });

  it("ignora <link> sem rel=alternate ou de outro tipo (ex.: stylesheet, icon)", () => {
    const html = `
      <link rel="stylesheet" href="/style.css">
      <link rel="icon" href="/favicon.ico">
      <link rel="alternate" type="application/json+oembed" href="/oembed">
    `;
    expect(extractFeedLinkFromHtml(html, "https://portal.com.br")).toBeNull();
  });

  it("retorna null quando nao ha nenhum <link> no HTML", () => {
    expect(extractFeedLinkFromHtml("<html><head><title>x</title></head></html>", "https://portal.com.br")).toBeNull();
  });
});

describe("looksLikeNewsSitemap / parseNewsSitemap", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
      <url>
        <loc>https://www.otempo.com.br/economia/2026/7/15/tarifaco</loc>
        <news:news>
          <news:publication>
            <news:name>O TEMPO</news:name>
            <news:language>pt-BR</news:language>
          </news:publication>
          <news:publication_date>2026-07-16T02:14:35+00:00</news:publication_date>
          <news:title><![CDATA[Trump confirma tarifa de 25% sobre produtos do Brasil]]></news:title>
        </news:news>
      </url>
      <url>
        <loc>https://www.otempo.com.br/sports/mls</loc>
        <news:news>
          <news:publication><news:name>O TEMPO</news:name></news:publication>
          <news:publication_date>2026-07-16T02:30:00+00:00</news:publication_date>
          <news:title>Seattle Sounders x Portland Timbers</news:title>
        </news:news>
      </url>
    </urlset>`;

  it("looksLikeNewsSitemap reconhece o formato e rejeita RSS/HTML comuns", () => {
    expect(looksLikeNewsSitemap(xml)).toBe(true);
    expect(looksLikeNewsSitemap(`<rss><channel><item><title>a</title></item></channel></rss>`)).toBe(
      false,
    );
    expect(looksLikeNewsSitemap("<html><head></head><body>ok</body></html>")).toBe(false);
    expect(looksLikeNewsSitemap("")).toBe(false);
  });

  it("parseNewsSitemap extrai titulo (com e sem CDATA), link e data", () => {
    const items = parseNewsSitemap(xml);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      title: "Trump confirma tarifa de 25% sobre produtos do Brasil",
      link: "https://www.otempo.com.br/economia/2026/7/15/tarifaco",
      sourceName: "O TEMPO",
    });
    expect(items[0].publishedAt?.toISOString()).toBe("2026-07-16T02:14:35.000Z");
    expect(items[1].title).toBe("Seattle Sounders x Portland Timbers");
  });
});

describe("extractNewsSitemapUrlsFromRobots", () => {
  it("acha linhas Sitemap: cujo caminho contem 'news'", () => {
    const robots = [
      "User-agent: *",
      "Disallow: /busca",
      "Sitemap: https://www.otempo.com.br/sitemap-api/otempo/sitemap_news.xml",
      "Sitemap: https://www.otempo.com.br/sitemap.xml",
      "sitemap: https://www.otempo.com.br/static/sitemaps/sitemap_tempo.txt",
    ].join("\n");

    expect(extractNewsSitemapUrlsFromRobots(robots)).toEqual([
      "https://www.otempo.com.br/sitemap-api/otempo/sitemap_news.xml",
    ]);
  });

  it("retorna vazio sem linhas Sitemap: relevantes", () => {
    expect(extractNewsSitemapUrlsFromRobots("User-agent: *\nDisallow: /")).toEqual([]);
  });
});

describe("buildBingNewsRssUrl", () => {
  it("monta URL Bing News com format=rss", async () => {
    const { buildBingNewsRssUrl } = await import("./sentinel-rss");
    const url = buildBingNewsRssUrl("Seguranca Publica Brasil");
    expect(url).toContain("bing.com/news/search");
    expect(url).toContain("format=rss");
    expect(url).toContain("Seguranca");
  });
});
