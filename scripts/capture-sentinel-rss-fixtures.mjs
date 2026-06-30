#!/usr/bin/env node
/**
 * Captura feeds RSS reais do Google News para tests/fixtures/sentinel/.
 * Uso: node scripts/capture-sentinel-rss-fixtures.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const fixtureRoot = path.join(root, "tests", "fixtures", "sentinel");
const rssDir = path.join(fixtureRoot, "rss");

const manifest = {
  capturedAt: new Date().toISOString(),
  source: "Google News RSS (pt-BR, gl=BR)",
  profile: {
    city: "Campinas",
    state: "SP",
    sentinelThemes: ["Vacinação", "Segurança Pública"],
    oppositionThemes: ["Combate à Corrupção"],
    customRadarThemes: [],
  },
  feeds: [
    { query: "Campinas SP", file: "campinas-sp.xml" },
    { query: "Vacinação Campinas SP", file: "vacinacao-campinas-sp.xml" },
    { query: "Segurança Pública Campinas SP", file: "seguranca-publica-campinas-sp.xml" },
    { query: "Combate à Corrupção Campinas SP", file: "combate-corrupcao-campinas-sp.xml" },
  ],
};

function buildGoogleNewsRssUrl(query) {
  const params = new URLSearchParams({
    q: query,
    hl: "pt-BR",
    gl: "BR",
    ceid: "BR:pt-419",
  });
  return `https://news.google.com/rss/search?${params.toString()}`;
}

mkdirSync(rssDir, { recursive: true });

const summary = [];

for (const feed of manifest.feeds) {
  const url = buildGoogleNewsRssUrl(feed.query);
  console.log(`Fetching ${feed.query}...`);

  const response = await fetch(url, {
    headers: {
      Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
      "User-Agent": "MandatoDigital-Sentinela/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed ${feed.query}: HTTP ${response.status}`);
  }

  const xml = await response.text();
  const itemCount = (xml.match(/<item>/g) ?? []).length;
  const target = path.join(rssDir, feed.file);

  writeFileSync(target, xml, "utf8");
  summary.push({ file: feed.file, bytes: xml.length, items: itemCount });
  console.log(`  -> ${feed.file} (${itemCount} items, ${xml.length} bytes)`);
}

writeFileSync(path.join(fixtureRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log("\nFixtures atualizados:");
for (const row of summary) {
  console.log(`- ${row.file}: ${row.items} matérias, ${row.bytes} bytes`);
}

console.log("\nManifest: tests/fixtures/sentinel/manifest.json");
console.log("Rode: npm run test:sentinel-fixtures");
