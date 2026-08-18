/**
 * Cruza a base outbound com as planilhas-fonte (reeleição + Pasta1) e grava
 * `isReelection`, `instagramFollowers`, `relevanceScore` e `relevanceTier`.
 *
 * Não cria contato novo — só enriquece o que já está em marketingContacts.
 * CPF da planilha é usado só em memória para o cruzamento e não é gravado.
 *
 *   npx vite-node --config vitest.config.ts scripts/enrich-marketing-relevance.ts -- --dry-run
 *   npx vite-node --config vitest.config.ts scripts/enrich-marketing-relevance.ts
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { listMarketingContacts, upsertMarketingContacts } from "../src/lib/outbound/contacts-storage";
import { classifyPhone } from "../src/lib/outbound/phone";
import { scoreContact } from "../src/lib/outbound/relevance";
import type { MarketingContact } from "../src/lib/outbound/types";

const DEFAULT_REELEICAO = [
  ".local/Candidatos_em_Reeleicao.xlsx",
  "/tmp/mandatodigital-base/Candidatos_em_Reeleicao.xlsx",
  "/Users/gstvbba/Downloads/Candidatos_em_Reeleicao.xlsx",
];
const DEFAULT_PASTA1 = [
  ".local/instagram-pasta1.csv",
  "/Users/gstvbba/Downloads/Pasta1.csv",
];

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const separator = line.indexOf("=");
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!String(process.env[key] ?? "").trim()) process.env[key] = value;
  }
}

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeName(value: string): string {
  return stripAccents(value)
    .toUpperCase()
    .replace(/[^A-Z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstExisting(candidates: string[]): string | null {
  for (const candidate of candidates) {
    const resolved = path.resolve(process.cwd(), candidate);
    if (fs.existsSync(resolved)) return resolved;
  }
  return null;
}

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((item) => item.startsWith(prefix))?.slice(prefix.length);
}

type ReelectionRow = { nome: string; urna: string; uf: string; cargo: string };

function loadReelection(filePath: string): ReelectionRow[] {
  const script = `
import json, openpyxl, sys
wb = openpyxl.load_workbook(sys.argv[1], read_only=True, data_only=True)
out = []
fed = list(wb["Deputados Federais"].iter_rows(values_only=True))
h = [str(c or "") for c in fed[0]]
for r in fed[1:]:
    row = dict(zip(h, r))
    out.append({"nome": str(row.get("Nome completo") or ""), "urna": str(row.get("Nome de urna") or ""), "uf": str(row.get("UF") or "").strip().upper(), "cargo": "DEPUTADO FEDERAL"})
est = list(wb["Deputados Estaduais"].iter_rows(values_only=True))
h = [str(c or "") for c in est[0]]
for r in est[1:]:
    row = dict(zip(h, r))
    out.append({"nome": str(row.get("Nome completo") or ""), "urna": str(row.get("Nome de urna") or ""), "uf": str(row.get("UF") or "").strip().upper(), "cargo": "DEPUTADO ESTADUAL"})
wb.close()
print(json.dumps(out, ensure_ascii=False))
`;
  const raw = execFileSync("python3", ["-c", script, filePath], { encoding: "utf8", maxBuffer: 20_000_000 });
  return JSON.parse(raw) as ReelectionRow[];
}

function parseCsv(content: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    if (quoted) {
      if (char === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function loadPasta1(filePath: string): Map<string, { followers: number; names: string[]; uf: string }> {
  const content = new TextDecoder("latin1").decode(fs.readFileSync(filePath));
  const [header, ...lines] = parseCsv(content, ";");
  if (!header) return new Map();
  const names = header.map((item) => item.trim());
  const byPhone = new Map<string, { followers: number; names: string[]; uf: string }>();

  for (const line of lines) {
    const row: Record<string, string> = {};
    names.forEach((name, index) => {
      row[name] = (line[index] ?? "").trim();
    });
    const uf = (row.UF ?? "").trim().toUpperCase();
    const displayNames = [row["Nome Completo"], row["Nome de Urna"]].filter(Boolean);
    const followers = Number.parseInt((row.followers_count ?? "").replace(/\D/g, ""), 10) || 0;
    for (const bruto of [row.whatsapp_e164, row.whatsapp]) {
      const classificado = classifyPhone(bruto ?? "");
      if (!classificado?.isMobile) continue;
      const existing = byPhone.get(classificado.e164);
      if (!existing || followers > existing.followers) {
        byPhone.set(classificado.e164, { followers, names: displayNames, uf });
      }
    }
  }
  return byPhone;
}

function buildReelectionIndex(rows: ReelectionRow[]) {
  const keys = new Set<string>();
  for (const row of rows) {
    if (!row.uf) continue;
    for (const raw of [row.nome, row.urna]) {
      const name = normalizeName(raw);
      if (name) keys.add(`${name}|${row.uf}`);
    }
  }
  return keys;
}

function isReelectionContact(contact: MarketingContact, index: Set<string>): boolean {
  const name = normalizeName(contact.name);
  if (!name || !contact.uf) return false;
  return index.has(`${name}|${contact.uf}`);
}

async function main() {
  loadEnvLocal();
  const dryRun = process.argv.includes("--dry-run");
  const reeleicaoPath = arg("reeleicao") || firstExisting(DEFAULT_REELEICAO);
  const pasta1Path = arg("pasta1") || firstExisting(DEFAULT_PASTA1);

  if (!reeleicaoPath) {
    console.error("Planilha de reeleição não encontrada. Passe --reeleicao=/caminho.xlsx");
    process.exit(1);
  }

  const reelectionRows = loadReelection(reeleicaoPath);
  const reelectionIndex = buildReelectionIndex(reelectionRows);
  const pasta1 = pasta1Path ? loadPasta1(pasta1Path) : new Map();

  const contacts = await listMarketingContacts();
  const updated: MarketingContact[] = [];
  const counts = {
    reelection: 0,
    followers: 0,
    vip: 0,
    alta: 0,
    media: 0,
    padrao: 0,
  };

  for (const contact of contacts) {
    const fromPasta = contact.phoneE164 ? pasta1.get(contact.phoneE164) : undefined;
    const next: MarketingContact = {
      ...contact,
      isReelection: isReelectionContact(contact, reelectionIndex),
      instagramFollowers: fromPasta?.followers || contact.instagramFollowers || 0,
    };
    const scored = scoreContact(next);
    next.relevanceScore = scored.score;
    next.relevanceTier = scored.tier;

    if (next.isReelection) counts.reelection += 1;
    if (next.instagramFollowers > 0) counts.followers += 1;
    counts[next.relevanceTier] += 1;
    updated.push(next);
  }

  console.log(`Reeleição: ${path.basename(reeleicaoPath)} (${reelectionRows.length} incumbentes)`);
  console.log(`Pasta1: ${pasta1Path ? path.basename(pasta1Path) : "não encontrada"} (${pasta1.size} telefones)`);
  console.log(`Contatos: ${contacts.length}`);
  console.log(`  marcados reeleição .... ${counts.reelection}`);
  console.log(`  com followers ......... ${counts.followers}`);
  console.log(`  VIP ................... ${counts.vip}`);
  console.log(`  alta .................. ${counts.alta}`);
  console.log(`  média ................. ${counts.media}`);
  console.log(`  padrão ................ ${counts.padrao}`);

  const vipSample = updated
    .filter((contact) => contact.relevanceTier === "vip")
    .slice(0, 15);
  if (vipSample.length) {
    console.log("\nAmostra VIP (contato pessoal, fora do disparo):");
    for (const contact of vipSample) {
      console.log(
        `  ${contact.name}  ${contact.uf}  ${contact.parties[0] ?? ""}  ${contact.candidateRole || contact.roles[0] || ""}  score=${contact.relevanceScore}`,
      );
    }
  }

  if (dryRun) {
    console.log("\n[--dry-run] nada gravado.");
    return;
  }

  const { created, updated: changed } = await upsertMarketingContacts(
    updated.map(({ createdAt: _createdAt, updatedAt: _updatedAt, ...rest }) => rest),
  );
  console.log(`\nGravado: ${created} novos, ${changed} atualizados.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
