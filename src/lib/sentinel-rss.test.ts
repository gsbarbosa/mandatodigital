import { describe, expect, it } from "vitest";

import { looksLikeRssFeed, parseRssFeed } from "./sentinel-rss";

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

describe("buildBingNewsRssUrl", () => {
  it("monta URL Bing News com format=rss", async () => {
    const { buildBingNewsRssUrl } = await import("./sentinel-rss");
    const url = buildBingNewsRssUrl("Seguranca Publica Brasil");
    expect(url).toContain("bing.com/news/search");
    expect(url).toContain("format=rss");
    expect(url).toContain("Seguranca");
  });
});
