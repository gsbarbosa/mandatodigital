/**
 * Importa o lote Pasta1.csv (Instagram + WhatsApp + gênero) para marketingContacts.
 *
 * Mesmas travas do Instagram enriquecido: @ vs nome, telefone exclusivo, DDD↔UF,
 * bio de terceiro. Doc id = ig_<e164>, então reimportar atualiza sem duplicar.
 *
 *   npx vite-node --config vitest.config.ts scripts/import-instagram-pasta1.ts -- --dry-run
 *   npx vite-node --config vitest.config.ts scripts/import-instagram-pasta1.ts -- --file=/caminho.csv
 */
import fs from "node:fs";
import path from "node:path";

import { listMarketingContacts, upsertMarketingContacts } from "../src/lib/outbound/contacts-storage";
import {
  handleMatchesName,
  REJECTION_LABELS,
  validateEnrichedRow,
  type RejectionReason,
} from "../src/lib/outbound/instagram-enrichment";
import { classifyPhone } from "../src/lib/outbound/phone";
import type { ContactGender, MarketingContact } from "../src/lib/outbound/types";

const DEFAULT_FILE = "/Users/gstvbba/Downloads/Pasta1.csv";

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
    if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
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

function readRows(filePath: string): Record<string, string>[] {
  const content = new TextDecoder("latin1").decode(fs.readFileSync(filePath));
  const [header, ...lines] = parseCsv(content, ";");
  if (!header) throw new Error(`CSV vazio: ${filePath}`);
  const names = header.map((name) => name.trim());
  return lines
    .filter((line) => line.some((cell) => cell.trim()))
    .map((line) => {
      const row: Record<string, string> = {};
      names.forEach((name, index) => {
        row[name] = (line[index] ?? "").trim();
      });
      return row;
    });
}

function genderFrom(value: string): ContactGender {
  const n = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  if (n.startsWith("FEMIN")) return "F";
  if (n.startsWith("MASCUL")) return "M";
  return "";
}

function phonesOf(row: Record<string, string>): string[] {
  const unicos = new Set<string>();
  for (const bruto of [row.whatsapp_e164, row.whatsapp]) {
    const classificado = classifyPhone(bruto ?? "");
    if (classificado?.isMobile) unicos.add(classificado.e164);
  }
  return [...unicos];
}

function bioLinksOf(row: Record<string, string>): string[] {
  const raw = [row.linktree, row.external_url, row.outros_links, row.whatsapp_links]
    .join(" | ")
    .split("|")
    .map((item) => item.trim())
    .filter((item) => /^https?:/i.test(item));
  return [...new Set(raw)];
}

function pickName(row: Record<string, string>): { display: string; forHandle: string } {
  const handle = (row.username ?? "").trim();
  const urna = (row["Nome de Urna"] ?? "").trim();
  const full = (row["Nome Completo"] ?? "").trim();
  const forHandle = handleMatchesName(handle, urna)
    ? urna
    : handleMatchesName(handle, full)
      ? full
      : urna || full;
  return { display: urna || full, forHandle };
}

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((item) => item.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  loadEnvLocal();
  const dryRun = process.argv.includes("--dry-run");
  const filePath = path.resolve(arg("file") || DEFAULT_FILE);
  if (!fs.existsSync(filePath)) {
    console.error(`Arquivo não encontrado: ${filePath}`);
    process.exit(1);
  }

  const rows = readRows(filePath);
  const existing = await listMarketingContacts();
  const phoneToExisting = new Map<string, MarketingContact>();
  for (const contact of existing) {
    if (contact.phoneE164) phoneToExisting.set(contact.phoneE164, contact);
  }

  const phoneOwners = new Map<string, Set<string>>();
  for (const row of rows) {
    const nome = pickName(row).display;
    if (!nome) continue;
    for (const phone of phonesOf(row)) {
      const donos = phoneOwners.get(phone) ?? new Set<string>();
      donos.add(nome);
      phoneOwners.set(phone, donos);
    }
  }

  const rejected = new Map<RejectionReason, number>();
  const approved: Array<{
    id: string;
    name: string;
    email: string;
    phoneE164: string;
    source: "instagram_enriquecido";
    uf: string;
    parties: string[];
    roles: string[];
    municipality: string;
    isCandidate2026: true;
    candidateRole: string;
    gender: ContactGender;
    suspended: false;
    origin: string;
  }> = [];
  const skippedNoHandle: string[] = [];
  let women = 0;
  let men = 0;
  let withPhone = 0;
  const overlapDir: string[] = [];
  const overlapIg: string[] = [];

  const origin = `instagram_pasta1_${new Date().toISOString().slice(0, 10)}`;

  for (const row of rows) {
    const handle = (row.username ?? "").trim();
    const { display, forHandle } = pickName(row);
    const uf = (row.UF ?? "").trim().toUpperCase();
    const cargo = (row.Cargo ?? "").trim();
    const party = (row["Sigla Partido"] ?? "").trim();
    const gender = genderFrom(row["Gênero"] ?? "");
    if (gender === "F") women += 1;
    if (gender === "M") men += 1;
    const phones = phonesOf(row);
    if (phones.length) withPhone += 1;
    if (!handle || !display) {
      skippedNoHandle.push(display || handle || "(vazio)");
      continue;
    }

    const resultado = validateEnrichedRow(
      {
        handle,
        candidateName: forHandle,
        uf,
        role: cargo,
        party,
        phones,
        bioLinks: bioLinksOf(row),
      },
      phoneOwners,
    );

    if (!resultado.ok) {
      for (const motivo of resultado.reasons) {
        rejected.set(motivo, (rejected.get(motivo) ?? 0) + 1);
      }
      continue;
    }

    if (approved.some((item) => item.phoneE164 === resultado.phone)) continue;

    const jaTem = phoneToExisting.get(resultado.phone);
    if (jaTem?.source === "diretorio_partidario") {
      overlapDir.push(`${display} ↔ ${jaTem.name} (${resultado.phone})`);
      continue;
    }
    if (jaTem?.source === "instagram_enriquecido") {
      overlapIg.push(`${display} (${resultado.phone})`);
    }

    approved.push({
      id: `ig_${resultado.phone}`,
      name: display,
      email: (row.email ?? "").trim().toLowerCase(),
      phoneE164: resultado.phone,
      source: "instagram_enriquecido",
      uf,
      parties: party ? [party] : [],
      roles: cargo ? [cargo] : [],
      municipality: "",
      isCandidate2026: true,
      candidateRole: cargo,
      gender,
      suspended: false,
      origin,
    });
  }

  const novos = approved.filter((item) => !phoneToExisting.has(item.phoneE164));
  const atualizar = approved.filter((item) => phoneToExisting.has(item.phoneE164));
  const mulheresNovas = novos.filter((item) => item.gender === "F");
  const porCargo = new Map<string, number>();
  for (const item of novos) {
    const cargo = item.candidateRole || "(sem cargo)";
    porCargo.set(cargo, (porCargo.get(cargo) ?? 0) + 1);
  }

  console.log(`Arquivo: ${filePath}`);
  console.log(`Linhas ............... ${rows.length}`);
  console.log(`Com WhatsApp (bruto) . ${withPhone}`);
  console.log(`Mulheres / homens .... ${women} / ${men}`);
  console.log(`Aprovados (travas) ... ${approved.length}`);
  console.log(`  já no Instagram .... ${atualizar.length}`);
  console.log(`  novos .............. ${novos.length}`);
  console.log(`  mulheres novas ..... ${mulheresNovas.length}`);
  console.log(`Pulados (mesmo tel. de diretório): ${overlapDir.length}`);
  console.log("Reprovados:");
  for (const [motivo, n] of [...rejected].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${REJECTION_LABELS[motivo]}`);
  }
  console.log("Novos por cargo:");
  for (const [cargo, n] of [...porCargo.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${cargo}`);
  }

  if (dryRun) {
    console.log("\n[--dry-run] nada gravado.");
    console.log("Mulheres novas (até 20):");
    for (const item of mulheresNovas.slice(0, 20)) {
      console.log(`  ${item.name}  ${item.uf}  ${item.candidateRole}  ${item.phoneE164}`);
    }
    return;
  }

  const result = await upsertMarketingContacts(approved);
  console.log(`\nGravado: ${result.created} novos, ${result.updated} atualizados.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
