import { describe, expect, it } from "vitest";

import { parseRssFeed } from "./sentinel-rss";

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
