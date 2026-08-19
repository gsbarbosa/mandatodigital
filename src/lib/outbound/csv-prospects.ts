/**
 * Pool de trabalho fora do Firestore: CSV do scraper + Pasta1 (TSE).
 * Só vira `marketingContacts` no momento do disparo.
 */

import { pickDispatchBatch } from "@/lib/outbound/dispatch-batch";
import { firstMobileE164 } from "@/lib/outbound/phone";
import {
  contactIdFromPhone,
  EMPTY_DISPATCH_META,
  type ContactGender,
  type MarketingContact,
} from "@/lib/outbound/types";

export type WorkedProspect = {
  instagram: string;
  name: string;
  gender: ContactGender;
  uf: string;
  parties: string[];
  candidateRole: string;
  phoneE164: string;
};

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function genderFrom(value: string): ContactGender {
  const normalized = stripAccents(value).toUpperCase();
  if (normalized.startsWith("FEMIN")) return "F";
  if (normalized.startsWith("MASCUL")) return "M";
  return "";
}

function normHandle(value: string): string {
  return stripAccents(value).trim().toLowerCase().replace(/^@/, "").replace(/,$/, "");
}

/** CSV com aspas e quebra de linha dentro do campo. */
export function parseDelimitedCsv(content: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    if (quoted) {
      if (char === '"') {
        if (content[index + 1] === '"') {
          field += '"';
          index += 1;
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

function rowsToObjects(content: string, delimiter: string): Record<string, string>[] {
  const lines = parseDelimitedCsv(content, delimiter).filter((line) =>
    line.some((cell) => cell.trim()),
  );
  const header = lines[0];
  if (!header) {
    return [];
  }
  return lines.slice(1).map((line) => {
    const row: Record<string, string> = {};
    header.forEach((name, index) => {
      row[name.trim()] = (line[index] ?? "").trim();
    });
    return row;
  });
}

export function parsePasta1Prospects(content: string): Array<{
  instagram: string;
  name: string;
  gender: ContactGender;
  uf: string;
  party: string;
  cargo: string;
}> {
  return rowsToObjects(content, ";")
    .map((row) => ({
      instagram: normHandle(row.username ?? ""),
      name: (row["Nome de Urna"] || row["Nome Completo"] || "").trim(),
      gender: genderFrom(row["Gênero"] ?? row.Genero ?? ""),
      uf: (row.UF ?? "").trim().toUpperCase(),
      party: (row["Sigla Partido"] ?? "").trim(),
      cargo: (row.Cargo ?? "").trim(),
    }))
    .filter((row) => row.instagram);
}

export function parseWhatsappScrape(content: string): Map<string, string> {
  const phones = new Map<string, string>();
  for (const row of rowsToObjects(content, ",")) {
    const handle = normHandle(row.username ?? "");
    if (!handle) continue;
    const mobile = firstMobileE164(`${row.whatsapp_e164 ?? ""} / ${row.whatsapp ?? ""}`);
    if (mobile) {
      phones.set(handle, mobile);
    }
  }
  return phones;
}

/** Mulheres TSE com móvel BR válido — ainda fora do banco. */
export function mergeWomenWithValidMobile(
  pasta1: ReturnType<typeof parsePasta1Prospects>,
  phones: Map<string, string>,
): WorkedProspect[] {
  const byHandle = new Map<string, WorkedProspect>();
  for (const row of pasta1) {
    if (row.gender !== "F") continue;
    const phoneE164 = phones.get(row.instagram) ?? "";
    if (!phoneE164) continue;
    if (!byHandle.has(row.instagram)) {
      byHandle.set(row.instagram, {
        instagram: row.instagram,
        name: row.name,
        gender: "F",
        uf: row.uf,
        parties: row.party ? [row.party] : [],
        candidateRole: row.cargo,
        phoneE164,
      });
    }
  }
  return [...byHandle.values()];
}

export function prospectToContact(prospect: WorkedProspect): MarketingContact {
  const now = new Date().toISOString();
  return {
    id: contactIdFromPhone(prospect.phoneE164),
    name: prospect.name,
    email: "",
    phoneE164: prospect.phoneE164,
    source: "whatsapp_disparo",
    uf: prospect.uf,
    parties: prospect.parties,
    roles: prospect.candidateRole ? [prospect.candidateRole] : [],
    municipality: "",
    isCandidate2026: true,
    candidateRole: prospect.candidateRole,
    gender: prospect.gender,
    isReelection: false,
    instagramFollowers: 0,
    relevanceScore: 0,
    relevanceTier: "padrao",
    suspended: false,
    origin: "csv:pasta1+scraper",
    ...EMPTY_DISPATCH_META,
    instagram: prospect.instagram,
    createdAt: now,
    updatedAt: now,
  };
}

export function pickProspectBatch(
  prospects: WorkedProspect[],
  size: number,
  seed = "candidatas-v3:0",
): WorkedProspect[] {
  return pickDispatchBatch(
    prospects.map((item) => ({ ...item, uf: item.uf || "_" })),
    size,
    seed,
  );
}
