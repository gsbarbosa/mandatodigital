#!/usr/bin/env node
/**
 * Pós-evento: desliga DEMO_MODE / NEXT_PUBLIC_DEMO_MODE em apphosting.yaml.
 *
 * Uso (só DEPOIS da apresentação):
 *   node scripts/disable-demo-mode-post-event.mjs
 *   git add apphosting.yaml && git commit && git push   # pipe App Hosting
 *
 * Nunca rode no meio do evento. Deploy App Hosting é só via push (não firebase deploy).
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const target = resolve(process.cwd(), "apphosting.yaml");
const raw = readFileSync(target, "utf8");

let next = raw;
const replacements = [
  {
    re: /(variable:\s*DEMO_MODE\s*\n\s*value:\s*)"true"/,
    to: '$1"false"',
    label: "DEMO_MODE",
  },
  {
    re: /(variable:\s*NEXT_PUBLIC_DEMO_MODE\s*\n\s*value:\s*)"true"/,
    to: '$1"false"',
    label: "NEXT_PUBLIC_DEMO_MODE",
  },
];

const changed = [];
for (const item of replacements) {
  if (!item.re.test(next)) {
    console.error(`Não achei ${item.label}=true em apphosting.yaml (já off ou formato mudou).`);
    process.exit(1);
  }
  next = next.replace(item.re, item.to);
  changed.push(item.label);
}

if (next === raw) {
  console.error("Nenhuma alteração aplicada.");
  process.exit(1);
}

writeFileSync(target, next);
console.log(`OK — desligado: ${changed.join(", ")}`);
console.log("Próximo: commit + push na branch da pipe (staging/main). NÃO use firebase deploy --only apphosting.");
console.log("Depois: revisar gasto HeyGen / ElevenLabs / OpenAI.");
