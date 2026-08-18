/**
 * Classifica sexo na base Instagram (fail-closed) e cria os segmentos/campanhas
 * de candidatas estaduais e distritais com WhatsApp, lote de 5.
 *
 * Idempotente: reexecutar atualiza o gênero e reusa segmento/campanha do mesmo nome.
 *
 *   npx vite-node --config vitest.config.ts scripts/setup-candidatas-whatsapp.ts
 */
import fs from "node:fs";
import path from "node:path";

import { COLLECTIONS, col } from "../src/lib/firebase/collections";
import { listMarketingContacts } from "../src/lib/outbound/contacts-storage";
import { listMarketingCampaigns, createMarketingCampaign } from "../src/lib/outbound/campaigns-storage";
import { createMarketingSegment, listMarketingSegments } from "../src/lib/outbound/segments-storage";
import { EMPTY_SEGMENT_FILTER, type SegmentFilter } from "../src/lib/outbound/types";

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

function norm(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Só marca F com nome inequívoco da base Instagram atual. O resto fica vazio. */
const WOMEN = new Set(
  [
    "ALANA PASSOS",
    "LEILA BEDANI",
    "SARAH PONCIO",
    "SILVINHA DUDU",
    "TALITA CADEIRANTE",
    "SUZELE VELOSO",
  ].map(norm),
);

const TEMPLATE = "md_intro_feito_candidatas_v1";

async function ensureSegment(name: string, description: string, filter: SegmentFilter) {
  const existing = (await listMarketingSegments()).find((segment) => segment.name === name);
  if (existing) {
    console.log(`  segmento já existe: ${name} (${existing.id})`);
    return existing;
  }
  const created = await createMarketingSegment({ name, description, filter });
  console.log(`  segmento criado: ${name} (${created.id})`);
  return created;
}

async function ensureCampaign(name: string, segmentId: string) {
  const existing = (await listMarketingCampaigns()).find((campaign) => campaign.name === name);
  if (existing) {
    console.log(`  campanha já existe: ${name} (${existing.id})`);
    return existing;
  }
  const created = await createMarketingCampaign({
    name,
    channel: "whatsapp",
    segmentId,
    templateName: TEMPLATE,
    templateLanguage: "pt_BR",
    templateParams: ["{{nome}}"],
    batchSize: 5,
  });
  console.log(`  campanha criada: ${name} (${created.id})`);
  return created;
}

async function main() {
  loadEnvLocal();

  const contacts = await listMarketingContacts();
  const instagram = contacts.filter((contact) => contact.source === "instagram_enriquecido");
  const now = new Date().toISOString();
  let marked = 0;

  for (const contact of instagram) {
    if (!WOMEN.has(norm(contact.name))) continue;
    if (contact.gender === "F") continue;
    await col(COLLECTIONS.marketingContacts)
      .doc(contact.id)
      .set({ gender: "F", updatedAt: now }, { merge: true });
    marked += 1;
    console.log(`  gender=F  ${contact.name} (${contact.uf})`);
  }

  console.log(`Instagram: ${instagram.length} contatos, ${marked} marcadas como F nesta rodada.`);
  console.log("");

  const womenFilter = (office: "estadual" | "distrital"): SegmentFilter => ({
    ...EMPTY_SEGMENT_FILTER,
    sources: ["instagram_enriquecido"],
    channel: "whatsapp",
    onlyCandidates2026: true,
    onlyWomen: true,
    offices: [office],
    excludeSuspended: true,
    search: "",
  });

  const estaduais = await ensureSegment(
    "Candidatas estaduais com WhatsApp",
    "Mulheres classificadas, cargo estadual, telefone móvel. Instagram validado.",
    womenFilter("estadual"),
  );
  const distritais = await ensureSegment(
    "Candidatas distritais com WhatsApp",
    "Mulheres classificadas, cargo distrital, telefone móvel. Instagram validado.",
    womenFilter("distrital"),
  );

  console.log("");
  await ensureCampaign("Intro candidatas — estaduais (Anna)", estaduais.id);
  await ensureCampaign("Intro candidatas — distritais (Anna)", distritais.id);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
