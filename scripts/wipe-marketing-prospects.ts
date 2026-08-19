/**
 * Apaga a poça antiga de prospects (contatos, envios, segmentos, campanhas).
 * Não mexe em marketingConversations.
 *
 *   npm run marketing:wipe-prospects -- --confirm
 */
import fs from "node:fs";
import path from "node:path";

import { COLLECTIONS, col, type AppCollectionName } from "../src/lib/firebase/collections";

const TARGETS = [
  COLLECTIONS.marketingContacts,
  COLLECTIONS.marketingSends,
  COLLECTIONS.marketingSegments,
  COLLECTIONS.marketingCampaigns,
] as const;

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

async function deleteCollection(name: AppCollectionName): Promise<number> {
  const collection = col(name);
  let deleted = 0;

  for (;;) {
    const snapshot = await collection.limit(400).get();
    if (snapshot.empty) break;
    const batch = collection.firestore.batch();
    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
    deleted += snapshot.size;
  }

  return deleted;
}

async function main() {
  loadEnvLocal();
  const confirm = process.argv.includes("--confirm");
  if (!confirm) {
    console.error("Dry-run. Para apagar de verdade: npm run marketing:wipe-prospects -- --confirm");
  }

  for (const name of TARGETS) {
    if (!confirm) {
      const snap = await col(name).select().get();
      console.log(`${name}: ${snap.size} docs (nada apagado)`);
      continue;
    }
    const deleted = await deleteCollection(name);
    console.log(`${name}: apagados ${deleted}`);
  }

  console.log("Conversas (marketingConversations) preservadas.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
