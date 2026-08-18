#!/usr/bin/env node
/**
 * Marca quais URLs Linktree existem de fato (HTTP 200 vs 404).
 *
 * Uso:
 *   node scripts/check-linktree-exists.mjs \
 *     --input ~/Downloads/candidatos_instagram_linktree.csv \
 *     --output ~/Downloads/candidatos_instagram_linktree.csv \
 *     --progress ~/Downloads/linktree-check-progress.jsonl
 */

import { createReadStream } from "node:fs";
import { appendFile, readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const IG_HANDLE_RE = /^[A-Za-z0-9._]{1,30}$/;
const LIXO_IG = new Set([
  "p",
  "reel",
  "reels",
  "stories",
  "share",
  "explore",
  "accounts",
  "direct",
  "tv",
  "about",
  "legal",
  "https:",
  "http:",
  "www",
  "instagram.com",
]);

function parseArgs(argv) {
  const args = {
    input: null,
    output: null,
    progress: null,
    concurrency: 1,
    delayMs: 800,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === "--input") args.input = value;
    else if (key === "--output") args.output = value;
    else if (key === "--progress") args.progress = value;
    else if (key === "--concurrency") args.concurrency = Number(value);
    else if (key === "--delay-ms") args.delayMs = Number(value);
    else continue;
    i += 1;
  }
  return args;
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function classifyHandle(usuario) {
  const handle = String(usuario || "").trim().replace(/^@/, "");
  if (!handle) return { ok: false, reason: "vazio" };
  if (LIXO_IG.has(handle.toLowerCase())) return { ok: false, reason: "dado_sujo" };
  if (!IG_HANDLE_RE.test(handle)) return { ok: false, reason: "invalido" };
  return { ok: true, handle };
}

function parseCsvLine(line) {
  const out = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out;
}

async function readInputRows(path) {
  const rl = createInterface({
    input: createReadStream(path, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  const rows = [];
  let headers = null;
  for await (const line of rl) {
    if (!line) continue;
    const cols = parseCsvLine(line);
    if (!headers) {
      headers = cols;
      continue;
    }
    const row = {};
    headers.forEach((name, i) => {
      row[name] = cols[i] ?? "";
    });
    rows.push(row);
  }
  return { headers, rows };
}

async function loadProgress(path) {
  const map = new Map();
  try {
    const raw = await readFile(path, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const item = JSON.parse(line);
      if (!item?.key) continue;
      if (item.flag === "erro" || item.status === 429) continue;
      map.set(item.key, item);
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  return map;
}

async function checkUrl(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
    });
    return response.status;
  } finally {
    clearTimeout(timer);
  }
}

const rate = { delayMs: 800 };

async function checkWithRetry(url) {
  for (let attempt = 1; attempt <= 40; attempt += 1) {
    try {
      const status = await checkUrl(url);
      if (status === 429 || status === 503) {
        rate.delayMs = Math.min(Math.max(rate.delayMs, 800) * 1.6, 8000);
        const wait = Math.min(8000 * attempt, 90000);
        process.stderr.write(
          `rate limit HTTP ${status}, pausa ${Math.round(wait / 1000)}s delay=${rate.delayMs}\n`,
        );
        await sleep(wait);
        continue;
      }
      if (status === 200 || status === 404) {
        rate.delayMs = Math.max(800, Math.floor(rate.delayMs * 0.97));
        return { status, error: "" };
      }
      return { status, error: `http_${status}` };
    } catch (error) {
      if (attempt === 40) return { status: 0, error: error.message || "rede" };
      await sleep(Math.min(2000 * attempt, 20000));
    }
  }
  return { status: 429, error: "rate_limit" };
}

function flagFromResult(item) {
  if (item.flag) return item.flag;
  if (item.status === 200) return "sim";
  if (item.status === 404) return "nao";
  return "erro";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input || !args.output || !args.progress) {
    console.error(
      "Uso: node scripts/check-linktree-exists.mjs --input in.csv --output out.csv --progress progress.jsonl",
    );
    process.exit(1);
  }

  const { rows } = await readInputRows(args.input);
  const progress = await loadProgress(args.progress);
  rate.delayMs = args.delayMs;

  const unique = new Map();
  let skippedInvalid = 0;
  for (const row of rows) {
    const usuario = row["Perfil Instagram (usuario)"] || "";
    const parsed = classifyHandle(usuario);
    const key = parsed.ok ? parsed.handle.toLowerCase() : `__invalid__:${usuario}`;
    if (!unique.has(key)) {
      unique.set(key, {
        key,
        usuario,
        url: parsed.ok ? `https://linktr.ee/${parsed.handle}` : row.linktree || "",
        valid: parsed.ok,
        reason: parsed.reason || "",
      });
    }
    if (!parsed.ok) skippedInvalid += 1;
  }

  const pending = [...unique.values()].filter((item) => !progress.has(item.key));
  console.error(
    `linhas=${rows.length} unicos=${unique.size} ja_checados=${progress.size} pendentes=${pending.length} invalidos_na_base=${skippedInvalid}`,
  );

  let done = 0;
  let sim = 0;
  let nao = 0;
  let erro = 0;
  for (const item of progress.values()) {
    const flag = flagFromResult(item);
    if (flag === "sim") sim += 1;
    else if (flag === "nao") nao += 1;
    else if (flag === "erro") erro += 1;
  }

  let cursor = 0;
  async function worker() {
    while (cursor < pending.length) {
      const index = cursor;
      cursor += 1;
      const item = pending[index];
      if (!item.valid) {
        const record = {
          key: item.key,
          usuario: item.usuario,
          url: item.url,
          status: "",
          flag: "invalido",
          error: item.reason,
        };
        progress.set(item.key, record);
        await appendFile(args.progress, `${JSON.stringify(record)}\n`, "utf8");
        done += 1;
        continue;
      }

      await sleep(rate.delayMs || args.delayMs);
      const result = await checkWithRetry(item.url);
      const flag =
        result.status === 200 ? "sim" : result.status === 404 ? "nao" : "erro";
      if (flag === "erro" && result.status === 429) {
        process.stderr.write(
          `ainda 429 em ${item.usuario}, deixa para retomar depois\n`,
        );
        continue;
      }
      const record = {
        key: item.key,
        usuario: item.usuario,
        url: item.url,
        status: result.status,
        flag,
        error: result.error,
      };
      progress.set(item.key, record);
      await appendFile(args.progress, `${JSON.stringify(record)}\n`, "utf8");
      done += 1;
      if (flag === "sim") sim += 1;
      else if (flag === "nao") nao += 1;
      else erro += 1;
      if (done % 25 === 0 || done === pending.length) {
        console.error(
          `progresso ${done}/${pending.length} sim=${sim} nao=${nao} erro=${erro} ultimo=${item.usuario} ${flag} ${result.status}`,
        );
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.max(1, args.concurrency) }, () => worker()),
  );

  const outRows = [
    [
      "Perfil Instagram (usuario)",
      "linktree",
      "tem_linktree",
      "http_status",
    ],
  ];
  let simLinhas = 0;
  for (const row of rows) {
    const usuario = row["Perfil Instagram (usuario)"] || "";
    const parsed = classifyHandle(usuario);
    const key = parsed.ok ? parsed.handle.toLowerCase() : `__invalid__:${usuario}`;
    const item = progress.get(key);
    const flag = item ? flagFromResult(item) : "pendente";
    if (flag === "sim") simLinhas += 1;
    outRows.push([
      usuario,
      row.linktree || (parsed.ok ? `https://linktr.ee/${parsed.handle}` : ""),
      flag,
      item?.status ?? "",
    ]);
  }

  const csv = outRows.map((cols) => cols.map(csvEscape).join(",")).join("\n") + "\n";
  await writeFile(args.output, csv, "utf8");
  console.error(`CSV gravado em ${args.output}`);
  console.error(`handles com linktree (unicos sim=${sim}) linhas_sim=${simLinhas}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
