/**
 * Popula `marketingContacts` (base de prospects do outbound) a partir de duas
 * fontes públicas:
 *
 *   1. Diretórios partidários do TSE (SGIP3) — CSV exportado, contato
 *      institucional de presidente/tesoureiro etc. por UF.
 *   2. Câmara dos Deputados (API de dados abertos) — deputados em exercício,
 *      com e-mail institucional. Cruzado com a base de candidaturas 2026 para
 *      marcar quem está concorrendo.
 *
 * Uso:
 *   npm run marketing:seed -- --dry-run
 *   npm run marketing:seed
 *   npm run marketing:seed -- --only=camara
 *   npm run marketing:seed -- --diretorio=/caminho/diretorios.csv
 *
 * CSVs ficam fora do git em `.local/`. Requer FIREBASE_SERVICE_ACCOUNT_JSON
 * (.env.local) ou ADC para gravar.
 *
 * Doc: docs/marketing-outbound.md
 */
import fs from "node:fs";
import path from "node:path";

import {
  upsertMarketingContacts,
  type MarketingContactSeed,
} from "../src/lib/outbound/contacts-storage";
import {
  REJECTION_LABELS,
  validateEnrichedRow,
  type RejectionReason,
} from "../src/lib/outbound/instagram-enrichment";
import { classifyPhone, firstMobileE164, splitPhoneField } from "../src/lib/outbound/phone";
import type { ContactSource } from "../src/lib/outbound/types";

const DEFAULT_DIRETORIO_CSV = ".local/diretorios-partidarios.csv";
const DEFAULT_CANDIDATOS_CSV = ".local/consulta_cand_2026_BRASIL.csv";
const DEFAULT_INSTAGRAM_CSV = ".local/instagram-enriquecido.csv";
const CAMARA_API = "https://dadosabertos.camara.leg.br/api/v2/deputados";

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

/** Parser CSV mínimo com aspas — mesmo motivo de seed-tse-candidates.ts. */
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

function readCsvAsObjects(
  filePath: string,
  options: { delimiter: string; encoding: "utf-8" | "latin1" },
): Record<string, string>[] {
  const buffer = fs.readFileSync(filePath);
  const content = new TextDecoder(options.encoding).decode(buffer);
  const [header, ...lines] = parseCsv(content, options.delimiter);
  if (!header) {
    throw new Error(`CSV vazio: ${filePath}`);
  }

  const names = header.map((name) => name.trim());
  return lines
    .filter((line) => line.length >= names.length)
    .map((line) => {
      const row: Record<string, string> = {};
      names.forEach((name, index) => {
        row[name] = (line[index] ?? "").trim();
      });
      return row;
    });
}

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeName(value: string): string {
  return stripAccents(value).toUpperCase().replace(/[^A-Z ]/g, "").replace(/\s+/g, " ").trim();
}

/** Doc id previsível e legível, com a origem no prefixo. */
const ID_PREFIX: Record<ContactSource, string> = {
  diretorio_partidario: "dir",
  camara_deputados: "cam",
  instagram_enriquecido: "ig",
};

function docId(source: ContactSource, key: string): string {
  const prefix = ID_PREFIX[source];
  const safe = key.toLowerCase().replace(/[^a-z0-9@._-]/g, "_");
  return `${prefix}_${safe}`;
}

/**
 * "Situação" é histórico separado por ";" — o status vigente é o último token.
 * Ex.: "Suspenso...; Restabelecido por decisão judicial;" não está suspenso.
 */
function isSuspended(situacao: string): boolean {
  const tokens = situacao
    .split(";")
    .map((token) => token.trim())
    .filter(Boolean);
  const last = tokens[tokens.length - 1];
  return last ? stripAccents(last).toLowerCase().startsWith("suspenso") : false;
}

type Candidate2026 = { role: string; uf: string };

/** Índice nome-normalizado + UF → cargo disputado, para marcar quem concorre. */
function readCandidateIndex(filePath: string): Map<string, Candidate2026> {
  const rows = readCsvAsObjects(filePath, { delimiter: ";", encoding: "latin1" });
  const index = new Map<string, Candidate2026>();

  for (const row of rows) {
    const uf = (row.SG_UF ?? "").trim().toUpperCase();
    const role = (row.DS_CARGO ?? "").trim();
    for (const nameField of [row.NM_CANDIDATO, row.NM_URNA_CANDIDATO]) {
      const name = normalizeName(nameField ?? "");
      if (name && uf) {
        const key = `${name}|${uf}`;
        if (!index.has(key)) {
          index.set(key, { role, uf });
        }
      }
    }
  }

  return index;
}

function buildDirectoryContacts(
  filePath: string,
  origin: string,
): { contacts: MarketingContactSeed[]; sourceRows: number; sharedContacts: number } {
  const rows = readCsvAsObjects(filePath, { delimiter: ",", encoding: "utf-8" });
  const byKey = new Map<string, MarketingContactSeed & { names: string[] }>();

  for (const row of rows) {
    const name = (row["Nome do representante"] ?? "").trim();
    const email = (row["E-mail"] ?? "").trim().toLowerCase();
    const uf = (row.Estado ?? "").trim().toUpperCase();
    if (!name || !uf || !email) {
      continue;
    }

    const role = (row.Cargo ?? "").trim();
    const party = (row["Partido/Federação"] ?? "").trim();
    const phoneE164 = firstMobileE164(row.Telefone ?? "");
    const suspended = isSuspended(row["Situação"] ?? "");

    // Dedup pelo canal real: mesmo celular (ou e-mail) = uma mensagem só.
    const key = phoneE164 || email;
    const existing = byKey.get(key);

    if (existing) {
      if (!existing.names.includes(name)) {
        existing.names.push(name);
      }
      // Telefone/e-mail institucional é compartilhado (presidente + tesoureiro
      // do mesmo diretório): personaliza no nome de quem preside.
      if (role.toUpperCase().startsWith("PRESIDENTE")) {
        existing.name = name;
      }
      if (role && !existing.roles.includes(role)) {
        existing.roles.push(role);
      }
      if (party && !existing.parties.includes(party)) {
        existing.parties.push(party);
      }
      existing.suspended = existing.suspended || suspended;
      continue;
    }

    byKey.set(key, {
      id: docId("diretorio_partidario", key),
      name,
      names: [name],
      email,
      phoneE164,
      source: "diretorio_partidario",
      uf,
      parties: party ? [party] : [],
      roles: role ? [role] : [],
      municipality: (row["Município/UF"] ?? "").trim(),
      isCandidate2026: false,
      candidateRole: "",
      suspended,
      origin,
    });
  }

  const contacts = [...byKey.values()];
  const sharedContacts = contacts.filter((contact) => contact.names.length > 1).length;

  return {
    contacts: contacts.map(({ names: _names, ...contact }) => contact),
    sourceRows: rows.length,
    sharedContacts,
  };
}

/** Telefones de uma linha do CSV enriquecido, já normalizados e só móveis. */
function instagramPhones(row: Record<string, string>): string[] {
  const brutos: string[] = [];

  const comercial = (row.TELEFONE_COMERCIAL ?? "").trim();
  // O campo às vezes traz uma URL (wa.link/…) em vez de número.
  if (comercial && !/^https?:/i.test(comercial)) {
    brutos.push(...splitPhoneField(comercial));
  }
  try {
    for (const item of JSON.parse(row.TODOS_TELEFONES || "[]") as unknown[]) {
      brutos.push(String(item));
    }
  } catch {
    // campo malformado — ignora
  }

  const unicos = new Set<string>();
  for (const bruto of brutos) {
    const classificado = classifyPhone(bruto);
    if (classificado?.isMobile) {
      unicos.add(classificado.e164);
    }
  }
  return [...unicos];
}

function parseJsonArray(value: string): string[] {
  try {
    return (JSON.parse(value || "[]") as unknown[]).map((item) => String(item));
  } catch {
    return [];
  }
}

/**
 * Importa a base enriquecida via Instagram aplicando as travas de qualidade.
 * Linha reprovada não vira contato — ver instagram-enrichment.ts para o porquê.
 */
function buildInstagramContacts(
  filePath: string,
  origin: string,
): {
  contacts: MarketingContactSeed[];
  sourceRows: number;
  rejected: Map<RejectionReason, number>;
} {
  const rows = readCsvAsObjects(filePath, { delimiter: ",", encoding: "utf-8" });

  // Um telefone reivindicado por candidatos diferentes indica associação errada
  // em pelo menos um deles — e não há como saber qual. Índice montado sobre a
  // base inteira, antes de validar linha a linha.
  const phoneOwners = new Map<string, Set<string>>();
  for (const row of rows) {
    const nome = (row.NM_URNA_CANDIDATO ?? "").trim();
    if (!nome) continue;
    for (const phone of instagramPhones(row)) {
      const donos = phoneOwners.get(phone) ?? new Set<string>();
      donos.add(nome);
      phoneOwners.set(phone, donos);
    }
  }

  const byPhone = new Map<string, MarketingContactSeed>();
  const rejected = new Map<RejectionReason, number>();

  for (const row of rows) {
    const handle = (row.INSTAGRAM_USERNAME ?? "").trim();
    const nome = (row.NM_URNA_CANDIDATO ?? "").trim();
    const uf = (row.SG_UF ?? "").trim().toUpperCase();
    if (!handle || !nome) continue;

    const resultado = validateEnrichedRow(
      {
        handle,
        candidateName: nome,
        uf,
        role: (row.DS_CARGO ?? "").trim(),
        party: (row.SG_PARTIDO ?? "").trim(),
        phones: instagramPhones(row),
        bioLinks: parseJsonArray(row.LINKS_BIO ?? ""),
      },
      phoneOwners,
    );

    if (!resultado.ok) {
      for (const motivo of resultado.reasons) {
        rejected.set(motivo, (rejected.get(motivo) ?? 0) + 1);
      }
      continue;
    }

    if (byPhone.has(resultado.phone)) continue;

    const party = (row.SG_PARTIDO ?? "").trim();
    const cargo = (row.DS_CARGO ?? "").trim();

    byPhone.set(resultado.phone, {
      id: docId("instagram_enriquecido", resultado.phone),
      name: nome,
      email: (row.EMAIL_COMERCIAL ?? "").trim().toLowerCase(),
      phoneE164: resultado.phone,
      source: "instagram_enriquecido",
      uf,
      parties: party ? [party] : [],
      roles: cargo ? [cargo] : [],
      municipality: "",
      // A fonte é a própria lista de candidaturas 2026.
      isCandidate2026: true,
      candidateRole: cargo,
      suspended: false,
      origin,
    });
  }

  return { contacts: [...byPhone.values()], sourceRows: rows.length, rejected };
}

type CamaraDeputy = {
  id: number;
  nome: string;
  siglaPartido: string;
  siglaUf: string;
  email: string | null;
};

async function fetchCamaraDeputies(): Promise<CamaraDeputy[]> {
  const deputies: CamaraDeputy[] = [];
  let url: string | null = `${CAMARA_API}?itens=100&pagina=1`;

  while (url) {
    const response: Response = await fetch(url, { headers: { accept: "application/json" } });
    if (!response.ok) {
      throw new Error(`Câmara respondeu ${response.status} em ${url}`);
    }
    const payload = (await response.json()) as {
      dados: CamaraDeputy[];
      links: Array<{ rel: string; href: string }>;
    };
    deputies.push(...payload.dados);
    url = payload.links.find((link) => link.rel === "next")?.href ?? null;
  }

  return deputies;
}

function buildCamaraContacts(
  deputies: CamaraDeputy[],
  candidateIndex: Map<string, Candidate2026>,
  origin: string,
): MarketingContactSeed[] {
  return deputies
    .filter((deputy) => Boolean(deputy.email))
    .map((deputy) => {
      const candidate = candidateIndex.get(`${normalizeName(deputy.nome)}|${deputy.siglaUf}`);

      return {
        id: docId("camara_deputados", String(deputy.id)),
        name: deputy.nome,
        email: (deputy.email ?? "").trim().toLowerCase(),
        // O telefone do gabinete é fixo (Brasília) — não serve para WhatsApp,
        // então o contato entra como canal de e-mail apenas.
        phoneE164: "",
        source: "camara_deputados" as const,
        uf: deputy.siglaUf,
        parties: deputy.siglaPartido ? [deputy.siglaPartido] : [],
        roles: ["DEPUTADO FEDERAL"],
        municipality: "",
        isCandidate2026: Boolean(candidate),
        candidateRole: candidate?.role ?? "",
        suspended: false,
        origin,
      };
    });
}

async function main() {
  loadEnvLocal();

  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const only = args.find((arg) => arg.startsWith("--only="))?.slice(7) ?? "todos";
  const diretorioPath = path.resolve(
    process.cwd(),
    args.find((arg) => arg.startsWith("--diretorio="))?.slice(12) || DEFAULT_DIRETORIO_CSV,
  );
  const candidatosPath = path.resolve(
    process.cwd(),
    args.find((arg) => arg.startsWith("--candidatos="))?.slice(13) || DEFAULT_CANDIDATOS_CSV,
  );

  const wantsDirectory = only === "todos" || only === "diretorio";
  const wantsCamara = only === "todos" || only === "camara";
  const wantsInstagram = only === "todos" || only === "instagram";
  const instagramPath = path.resolve(
    process.cwd(),
    args.find((arg) => arg.startsWith("--instagram="))?.slice(12) || DEFAULT_INSTAGRAM_CSV,
  );
  const contacts: MarketingContactSeed[] = [];
  const stamp = new Date().toISOString().slice(0, 10);

  console.log("");

  if (wantsDirectory) {
    if (!fs.existsSync(diretorioPath)) {
      console.error(`CSV de diretórios não encontrado: ${diretorioPath}`);
      console.error(`Coloque o export do SGIP3 em ${DEFAULT_DIRETORIO_CSV} ou passe --diretorio=…`);
      process.exit(1);
    }

    const result = buildDirectoryContacts(diretorioPath, `sgip3_diretorios_${stamp}`);
    contacts.push(...result.contacts);

    console.log(`Diretórios partidários (${path.basename(diretorioPath)})`);
    console.log(`  linhas na fonte ...... ${result.sourceRows}`);
    console.log(`  contatos únicos ...... ${result.contacts.length}`);
    console.log(`  com WhatsApp ......... ${result.contacts.filter((c) => c.phoneE164).length}`);
    console.log(`  suspensos ............ ${result.contacts.filter((c) => c.suspended).length}`);
    console.log(`  contato compartilhado  ${result.sharedContacts} (>1 pessoa no mesmo canal)`);
    console.log("");
  }

  if (wantsCamara) {
    let candidateIndex = new Map<string, Candidate2026>();
    if (fs.existsSync(candidatosPath)) {
      candidateIndex = readCandidateIndex(candidatosPath);
    } else {
      console.warn(
        `Aviso: ${path.basename(candidatosPath)} não encontrado — ninguém será marcado como candidato 2026.`,
      );
    }

    const deputies = await fetchCamaraDeputies();
    const camaraContacts = buildCamaraContacts(
      deputies,
      candidateIndex,
      `camara_dados_abertos_${stamp}`,
    );
    contacts.push(...camaraContacts);

    console.log("Câmara dos Deputados (API de dados abertos)");
    console.log(`  deputados em exercício ${deputies.length}`);
    console.log(`  com e-mail ........... ${camaraContacts.length}`);
    console.log(
      `  candidatos em 2026 ... ${camaraContacts.filter((c) => c.isCandidate2026).length}`,
    );
    console.log("");
  }

  if (wantsInstagram) {
    if (!fs.existsSync(instagramPath)) {
      if (only === "instagram") {
        console.error(`CSV enriquecido não encontrado: ${instagramPath}`);
        process.exit(1);
      }
      console.warn(`Aviso: ${DEFAULT_INSTAGRAM_CSV} não encontrado — fonte Instagram pulada.`);
    } else {
      const result = buildInstagramContacts(instagramPath, `instagram_enriquecido_${stamp}`);
      contacts.push(...result.contacts);

      console.log(`Instagram enriquecido (${path.basename(instagramPath)})`);
      console.log(`  linhas na fonte ...... ${result.sourceRows}`);
      console.log(`  APROVADOS ............ ${result.contacts.length}`);
      console.log(`  reprovados por:`);
      for (const [motivo, quantidade] of [...result.rejected].sort((a, b) => b[1] - a[1])) {
        console.log(`    ${String(quantidade).padStart(4)}  ${REJECTION_LABELS[motivo]}`);
      }
      console.log("");
    }
  }

  console.log(`Total a gravar ......... ${contacts.length}`);

  if (dryRun) {
    console.log("");
    console.log("Dry-run: nada foi gravado no Firestore.");
    return;
  }

  const { created, updated } = await upsertMarketingContacts(contacts);
  console.log(`Gravado: ${created} novos, ${updated} atualizados.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
