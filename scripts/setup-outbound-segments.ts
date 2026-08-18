/**
 * Cria (ou reusa) os segmentos canônicos de disparo WhatsApp.
 *
 * VIP fica isolado para contato pessoal. Os demais excluem VIP e embaralham
 * UF no disparo. Idempotente pelo nome do segmento.
 *
 *   npx vite-node --config vitest.config.ts scripts/setup-outbound-segments.ts
 */
import fs from "node:fs";
import path from "node:path";

import { applySegment } from "../src/lib/outbound/segment-filter";
import { listMarketingContacts } from "../src/lib/outbound/contacts-storage";
import {
  createMarketingSegment,
  listMarketingSegments,
  updateMarketingSegment,
} from "../src/lib/outbound/segments-storage";
import {
  EMPTY_SEGMENT_FILTER,
  type OfficeKey,
  type SegmentFilter,
} from "../src/lib/outbound/types";

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

const ESTADUAL: OfficeKey[] = ["estadual", "distrital"];
const FEDERAL: OfficeKey[] = ["federal"];

function wa(filter: Partial<SegmentFilter>): SegmentFilter {
  return {
    ...EMPTY_SEGMENT_FILTER,
    channel: "whatsapp",
    excludeVip: true,
    excludeSuspended: true,
    ...filter,
  };
}

const SEGMENTS: Array<{ name: string; description: string; filter: SegmentFilter }> = [
  {
    name: "VIP — contato pessoal",
    description: "Não dispara WhatsApp. Ligar / e-mail / indicação. Federal em reeleição, presidente de partido grande, celebridade digital.",
    filter: {
      ...EMPTY_SEGMENT_FILTER,
      excludeVip: false,
      relevanceTiers: ["vip"],
      excludeSuspended: true,
    },
  },
  {
    name: "Alta relevância — humano se responder",
    description: "Disparo curto. Se o lead responder, pausar a IA e assumir no braço.",
    filter: wa({ relevanceTiers: ["alta"] }),
  },
  {
    name: "WA · Reeleição · F · Estadual/Distrital",
    description: "Incumbente mulher, ALE/CLDF. Template materialidade + vozdelas.",
    filter: wa({
      onlyWomen: true,
      onlyReelection: true,
      offices: ESTADUAL,
    }),
  },
  {
    name: "WA · Reeleição · F · Federal",
    description: "Incumbente mulher, Câmara. Quase sempre VIP; este recorte pega quem não passou no corte.",
    filter: wa({
      onlyWomen: true,
      onlyReelection: true,
      offices: FEDERAL,
    }),
  },
  {
    name: "WA · Reeleição · M · Estadual/Distrital",
    description: "Incumbente homem, ALE/CLDF. Template materialidade / volume.",
    filter: wa({
      onlyMen: true,
      onlyReelection: true,
      offices: ESTADUAL,
    }),
  },
  {
    name: "WA · Reeleição · M · Federal",
    description: "Incumbente homem, Câmara. Recorte residual — a maior parte é VIP.",
    filter: wa({
      onlyMen: true,
      onlyReelection: true,
      offices: FEDERAL,
    }),
  },
  {
    name: "WA · Candidatas · Estadual/Distrital",
    description: "Mulheres desafiantes (não incumbentes). Voz Delas / chapas femininas / degustação.",
    filter: wa({
      onlyWomen: true,
      excludeReelection: true,
      onlyCandidates2026: true,
      offices: ESTADUAL,
    }),
  },
  {
    name: "WA · Candidatas · Federal",
    description: "Mulheres desafiantes federais. Voz Delas + provas de recursos.",
    filter: wa({
      onlyWomen: true,
      excludeReelection: true,
      onlyCandidates2026: true,
      offices: FEDERAL,
    }),
  },
  {
    name: "WA · Candidatos · Estadual/Distrital",
    description: "Homens desafiantes, ALE/CLDF. Prova de IA + volume de vídeo.",
    filter: wa({
      onlyMen: true,
      excludeReelection: true,
      onlyCandidates2026: true,
      offices: ESTADUAL,
    }),
  },
  {
    name: "WA · Candidatos · Federal",
    description: "Homens desafiantes federais. Prova + vaga por sigla.",
    filter: wa({
      onlyMen: true,
      excludeReelection: true,
      onlyCandidates2026: true,
      offices: FEDERAL,
    }),
  },
  {
    name: "WA · Presidentes de partido",
    description: "Dirigente com poder de alocar candidatos. Escassez: 3 campanhas por partido/estado. Presidentes de partido grande tendem a ser VIP.",
    filter: wa({
      onlyPartyPresidents: true,
      sources: ["diretorio_partidario"],
    }),
  },
];

async function main() {
  loadEnvLocal();
  const contacts = await listMarketingContacts();
  const existing = await listMarketingSegments();
  const byName = new Map(existing.map((segment) => [segment.name, segment]));

  console.log(`Base: ${contacts.length} contatos. Segmentos atuais: ${existing.length}.\n`);

  for (const spec of SEGMENTS) {
    const matched = applySegment(contacts, spec.filter).length;
    const found = byName.get(spec.name);
    if (found) {
      await updateMarketingSegment(found.id, {
        description: spec.description,
        filter: spec.filter,
      });
      console.log(`  atualizado  ${spec.name}  (${matched})`);
    } else {
      const created = await createMarketingSegment(spec);
      console.log(`  criado      ${spec.name}  (${matched})  ${created.id}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
