/**
 * Disparo nomeado de WhatsApp: preview obrigatório, envio só com --confirm.
 *
 *   npm run marketing:dispatch -- --template=md_intro_feito_candidatas_v1 --names="Alana Passos, Sarah Poncio"
 *   npm run marketing:dispatch -- --template=feito --names="Alana Passos" --confirm
 *
 * Sem --confirm nada é enviado. Doc: docs/marketing-outbound.md
 */
import fs from "node:fs";
import path from "node:path";

import {
  formatNamedPreview,
  previewNamedWhatsappDispatch,
  sendNamedWhatsappDispatch,
} from "../src/lib/outbound/dispatch-named";
import {
  mergeWomenWithValidMobile,
  parsePasta1Prospects,
  parseWhatsappScrape,
  pickProspectBatch,
  prospectToContact,
} from "../src/lib/outbound/csv-prospects";
import { classifyPhone } from "../src/lib/outbound/phone";

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

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((item) => item.startsWith(prefix))?.slice(prefix.length);
}

function hasFlag(name: string): boolean {
  return process.argv.slice(2).includes(`--${name}`);
}

function loadPhoneContacts(raw: string, asName: string) {
  const queries = raw.split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean);
  if (queries.length === 0) {
    throw new Error("Informe pelo menos um telefone em --phones.");
  }
  const names = asName
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (names.length > 1 && names.length !== queries.length) {
    throw new Error(
      `--as-name tem ${names.length} nomes e --phones tem ${queries.length} números. Tem que bater 1:1.`,
    );
  }
  return queries.map((query, index) => {
    const classified = classifyPhone(query);
    if (!classified?.isMobile) {
      throw new Error(`Número inválido ou não-móvel: ${query}`);
    }
    const name = (names.length === 1 ? names[0] : names[index]) || "Gustavo";
    return prospectToContact({
      instagram: "",
      name,
      gender: "",
      uf: "",
      parties: [],
      candidateRole: "",
      phoneE164: classified.e164,
    });
  });
}

async function loadCsvContacts(limit: number) {
  const pastaPath = path.resolve(
    arg("pasta1") || "/Users/gstvbba/Downloads/Pasta1.csv",
  );
  const waPath = path.resolve(
    arg("whatsapp-csv") || "/Users/gstvbba/Downloads/instagram-candidatos-whatsapp.csv",
  );
  if (!fs.existsSync(pastaPath) || !fs.existsSync(waPath)) {
    throw new Error(
      `CSV não encontrado. Passe --pasta1= e --whatsapp-csv= (Pasta1 + scrape com WhatsApp).`,
    );
  }
  const pasta = parsePasta1Prospects(fs.readFileSync(pastaPath, "latin1"));
  const phones = parseWhatsappScrape(fs.readFileSync(waPath, "utf8"));
  const women = mergeWomenWithValidMobile(pasta, phones);
  const lote = pickProspectBatch(women, limit, arg("seed") || "candidatas-v3:0");
  return lote.map(prospectToContact);
}

async function main() {
  loadEnvLocal();

  const templateRaw = arg("template") || "";
  const fromCsv = hasFlag("from-csv");
  const namesRaw = arg("names") || "";
  const phonesRaw = arg("phones") || "";
  const limit = Number.parseInt(arg("limit") || "50", 10);

  if (!templateRaw || (!fromCsv && !namesRaw && !phonesRaw)) {
    console.error(
      'Uso: npm run marketing:dispatch -- --template=md_intro_feito_candidatas_v3 --names="Nome 1, Nome 2"',
    );
    console.error(
      "      ou: npm run marketing:dispatch -- --template=feito --from-csv --limit=50",
    );
    console.error(
      '      ou: npm run marketing:dispatch -- --template=feito --phones="31993717447,31992439177" --as-name=Gustavo',
    );
    console.error("      acrescente --confirm somente depois de revisar o preview.");
    process.exitCode = 1;
    return;
  }

  const csvContacts = fromCsv
    ? await loadCsvContacts(Number.isFinite(limit) ? limit : 50)
    : phonesRaw
      ? loadPhoneContacts(phonesRaw, arg("as-name") || "Gustavo")
      : undefined;
  const preview = await previewNamedWhatsappDispatch({
    templateRaw,
    namesRaw: csvContacts
      ? csvContacts.map((item) => item.phoneE164 || `${item.name} ${item.uf}`.trim()).join(", ")
      : namesRaw,
    contacts: csvContacts,
  });
  const text = formatNamedPreview(preview);

  if (hasFlag("json") && !hasFlag("confirm")) {
    console.log(JSON.stringify({ preview, text }, null, 2));
    return;
  }

  console.log(text);

  if (!hasFlag("confirm")) {
    return;
  }

  if (preview.ready.length === 0) {
    console.error("\nNada a enviar.");
    process.exitCode = 1;
    return;
  }

  console.log("\nEnviando…");
  const result = await sendNamedWhatsappDispatch(preview);
  console.log(`\nEnviados: ${result.sent}  Falhou: ${result.failed}  Fora do teto do dia: ${result.skipped}`);
  for (const row of result.rows) {
    const mark = row.status === "enviado" ? "✔" : "✘";
    console.log(`  ${mark} ${row.name} ${row.phoneE164} ${row.providerMessageId || row.error}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
