/**
 * Atualiza status/observação de tasks do roadmap no Firestore por título.
 *
 * Uso:
 *   node --env-file=.env.local scripts/update-roadmap-status.mjs
 */
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const UPDATES = [
  {
    title: "URL canônica → mandatodigital.ia.br",
    status: "done",
    observation:
      "DNS www no App Hosting; site institucional no ar. Revisar APP_BASE_URL/Auth se ainda usarem hosted.app",
  },
  {
    title: "Painel de gestão com suporte",
    status: "done",
    observation: "MVP /admin no ar (dashboard, usuários, provedores, roadmap)",
  },
];

function initAdmin() {
  if (getApps().length) {
    return;
  }
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON nao configurado (.env.local).");
  }
  const sa = JSON.parse(raw);
  initializeApp({ credential: cert(sa) });
}

async function main() {
  initAdmin();
  const db = getFirestore();
  const snap = await db.collection("adminRoadmapTasks").get();
  if (snap.empty) {
    console.log("Collection vazia — seed roda na 1ª visita a /admin/roadmap.");
    return;
  }

  const byTitle = new Map();
  for (const doc of snap.docs) {
    byTitle.set(String(doc.data().title ?? "").trim(), doc);
  }

  let updated = 0;
  for (const patch of UPDATES) {
    const doc = byTitle.get(patch.title);
    if (!doc) {
      console.warn(`Nao encontrada: ${patch.title}`);
      continue;
    }
    await doc.ref.set(
      {
        status: patch.status,
        observation: patch.observation,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
    updated += 1;
    console.log(`OK: ${patch.title} → ${patch.status}`);
  }
  console.log(`Atualizadas: ${updated}/${UPDATES.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
