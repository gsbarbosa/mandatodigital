#!/usr/bin/env node
/**
 * Extrai números de WhatsApp públicos a partir de URLs Linktree.
 *
 * Uso:
 *   node scripts/extract-linktree-whatsapp.mjs links.txt
 *   node scripts/extract-linktree-whatsapp.mjs links.txt -o whatsapp.csv
 *
 * O arquivo de entrada aceita um item por linha:
 *   https://linktr.ee/deputadofelipemota
 *   linktr.ee/outroperfil
 *   outroperfil
 */

const DELAY_MS = 600;

const WA_PATTERNS = [
  /https?:\/\/wa\.me\/(\+?\d[\d\s-]{9,20}\d)/gi,
  /https?:\/\/(?:www\.)?api\.whatsapp\.com\/send\/?\?[^"'<\s]*?[?&]phone=(\+?\d[\d\s-]{9,20}\d)/gi,
  /https?:\/\/(?:www\.)?whatsapp\.com\/send\/?\?[^"'<\s]*?[?&]phone=(\+?\d[\d\s-]{9,20}\d)/gi,
];

function extractNumbers(html) {
  const found = new Set();
  for (const re of WA_PATTERNS) {
    for (const match of html.matchAll(re)) {
      const digits = match[1].replace(/\D/g, "");
      if (digits.length >= 10 && digits.length <= 15) found.add(digits);
    }
  }
  return [...found];
}

function formatBr(digits) {
  if (digits.startsWith("55") && digits.length === 13) {
    return `+55 ${digits.slice(2, 4)} ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.startsWith("55") && digits.length === 12) {
    return `+55 ${digits.slice(2, 4)} ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  return `+${digits}`;
}

function normalizeUrl(line) {
  const text = line.trim();
  if (!text || text.startsWith("#")) return null;
  if (text.startsWith("http://") || text.startsWith("https://")) return text;
  if (text.startsWith("linktr.ee/")) return `https://${text}`;
  return `https://linktr.ee/${text.replace(/^@/, "")}`;
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(argv) {
  const args = { input: null, output: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "-o" || argv[i] === "--output") {
      args.output = argv[i + 1];
      i += 1;
      continue;
    }
    if (!args.input) args.input = argv[i];
  }
  return args;
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.text();
}

async function main() {
  const { input, output } = parseArgs(process.argv.slice(2));
  if (!input) {
    console.error(
      "Uso: node scripts/extract-linktree-whatsapp.mjs links.txt [-o whatsapp.csv]",
    );
    process.exit(1);
  }

  const { readFile, writeFile } = await import("node:fs/promises");
  const raw = await readFile(input, "utf8");
  const urls = raw
    .split(/\r?\n/)
    .map(normalizeUrl)
    .filter(Boolean);

  if (urls.length === 0) {
    console.error("Nenhuma URL encontrada no arquivo.");
    process.exit(1);
  }

  const rows = [["linktree", "whatsapp_e164", "whatsapp_formatado", "status"]];

  for (let i = 0; i < urls.length; i += 1) {
    const url = urls[i];
    process.stderr.write(`[${i + 1}/${urls.length}] ${url} ... `);
    try {
      const html = await fetchHtml(url);
      const numbers = extractNumbers(html);
      if (numbers.length === 0) {
        rows.push([url, "", "", "sem_whatsapp"]);
        process.stderr.write("sem WhatsApp\n");
      } else {
        for (const digits of numbers) {
          rows.push([url, `+${digits}`, formatBr(digits), "ok"]);
        }
        process.stderr.write(`${numbers.map((n) => formatBr(n)).join(" | ")}\n`);
      }
    } catch (error) {
      rows.push([url, "", "", `erro:${error.message}`]);
      process.stderr.write(`erro ${error.message}\n`);
    }
    if (i < urls.length - 1) await sleep(DELAY_MS);
  }

  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n") + "\n";
  if (output) {
    await writeFile(output, csv, "utf8");
    process.stderr.write(`CSV gravado em ${output}\n`);
  } else {
    process.stdout.write(csv);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
