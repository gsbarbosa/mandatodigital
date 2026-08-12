/**
 * Popula a collection `tseCandidates2026` a partir do CSV de candidaturas do
 * TSE (consulta_cand_2026), usada para o prefill silencioso do cadastro.
 *
 * Uso:
 *   npm run tse:seed -- --dry-run
 *   npm run tse:seed
 *   npm run tse:seed -- --file=/caminho/consulta_cand_2026_BRASIL.csv
 *
 * O CSV é PII e fica fora do git: default `.local/consulta_cand_2026_BRASIL.csv`.
 * Formato do TSE: latin-1, separador ";", todos os campos entre aspas.
 * Requer FIREBASE_SERVICE_ACCOUNT_JSON (.env.local) ou ADC.
 *
 * Doc: docs/prefill-cadastro-tse.md
 */
import fs from "node:fs";
import path from "node:path";

import {
  hasAnyPrefillValue,
  mergeCandidatePrefills,
  toCandidatePrefill,
  type TseCandidatePrefill,
  type TseCandidateRow,
} from "../src/lib/tse-candidates";
import { writeTseCandidates } from "../src/lib/tse-candidates-storage";

const DEFAULT_CSV = ".local/consulta_cand_2026_BRASIL.csv";

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    return;
  }
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    if (!line || line.startsWith("#") || !line.includes("=")) {
      continue;
    }
    const separator = line.indexOf("=");
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1).replace(/\\n/g, "\n").replace(/\\"/g, '"');
    }
    if (!String(process.env[key] ?? "").trim()) {
      process.env[key] = value;
    }
  }
}

/** Parser CSV mínimo com aspas e ";" — o dataset não justifica uma dependência. */
function parseCsv(content: string, delimiter = ";"): string[][] {
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

function readTseRows(filePath: string): TseCandidateRow[] {
  const content = new TextDecoder("latin1").decode(fs.readFileSync(filePath));
  const [header, ...lines] = parseCsv(content);
  if (!header) {
    throw new Error(`CSV vazio: ${filePath}`);
  }

  const columns: (keyof TseCandidateRow)[] = [
    "NR_CPF_CANDIDATO",
    "NM_CANDIDATO",
    "SG_UF",
    "SG_PARTIDO",
    "DS_CARGO",
  ];
  const index = new Map(header.map((name, position) => [name.trim(), position]));

  for (const column of columns) {
    if (!index.has(column)) {
      throw new Error(
        `Coluna ${column} ausente em ${path.basename(filePath)} — o layout do TSE mudou?`,
      );
    }
  }

  return lines
    .filter((line) => line.length >= header.length)
    .map((line) => {
      const row = {} as TseCandidateRow;
      for (const column of columns) {
        row[column] = (line[index.get(column)!] ?? "").trim();
      }
      return row;
    });
}

function buildEntries(rows: TseCandidateRow[]) {
  const byCpf = new Map<string, TseCandidatePrefill[]>();

  for (const row of rows) {
    const cpf = row.NR_CPF_CANDIDATO.replace(/\D/g, "");
    if (cpf.length !== 11) {
      continue;
    }
    const list = byCpf.get(cpf);
    if (list) {
      list.push(toCandidatePrefill(row));
    } else {
      byCpf.set(cpf, [toCandidatePrefill(row)]);
    }
  }

  const entries: { cpf: string; prefill: TseCandidatePrefill }[] = [];
  let duplicated = 0;

  for (const [cpf, prefills] of byCpf) {
    if (prefills.length > 1) {
      duplicated += 1;
    }
    const prefill =
      prefills.length === 1 ? prefills[0] : mergeCandidatePrefills(prefills);
    if (hasAnyPrefillValue(prefill)) {
      entries.push({ cpf, prefill });
    }
  }

  return { entries, duplicated };
}

async function main() {
  loadEnvLocal();

  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const fileArg = args.find((arg) => arg.startsWith("--file="))?.slice(7);
  const filePath = path.resolve(process.cwd(), fileArg || DEFAULT_CSV);

  if (!fs.existsSync(filePath)) {
    console.error(`CSV nao encontrado: ${filePath}`);
    console.error(`Coloque o arquivo do TSE em ${DEFAULT_CSV} ou passe --file=...`);
    process.exit(1);
  }

  const rows = readTseRows(filePath);
  const { entries, duplicated } = buildEntries(rows);

  const filled = (field: keyof TseCandidatePrefill) =>
    entries.filter((entry) => entry.prefill[field]).length;

  console.log("");
  console.log(`Arquivo ................ ${filePath}`);
  console.log(`Linhas do CSV .......... ${rows.length}`);
  console.log(`CPFs unicos gravaveis .. ${entries.length}`);
  console.log(`CPFs em >1 candidatura . ${duplicated} (campos divergentes ficam vazios)`);
  console.log(`  com nome ............. ${filled("fullName")}`);
  console.log(`  com partido .......... ${filled("party")}`);
  console.log(`  com UF ............... ${filled("uf")}`);
  console.log(`  com cargo ............ ${filled("role")}`);

  if (dryRun) {
    console.log("");
    console.log("Dry-run: nada gravado no Firestore.");
    console.log("Amostra:", JSON.stringify(entries.slice(0, 3), null, 2));
    return;
  }

  console.log("");
  console.log("Gravando em tseCandidates2026...");
  const written = await writeTseCandidates(entries);
  console.log(`Pronto: ${written} documentos gravados.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
