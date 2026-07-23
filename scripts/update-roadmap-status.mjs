/**
 * Atualiza status/observação de tasks do roadmap no Firestore por título.
 * Uso: node --env-file=.env.local scripts/update-roadmap-status.mjs
 */
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const UPDATES = [
  {
    title: "Painel de gestão com suporte",
    status: "done",
    observation:
      "MVP /admin no ar (dashboard, usuários, provedores, roadmap, suporte humano). Validação Thiago pendente.",
  },
  {
    title: "Suporte via IA (N1 Sonnet / N2 Opus / N3 humano)",
    status: "done",
    observation:
      "N1 (widget + KB + escalate) + fila humana em /admin/suporte. N2 Opus ainda não; chat cliente redesenhado (FAB esquerdo).",
  },
  {
    title: "Materialidade — dados salvos e estruturados (agora)",
    status: "done",
    observation:
      "auditLog + /auditoria; eventos em auth, vídeos, jobs, contrato, treino e suporte. Self-service de relatórios fica pós-25 (≥10/Set).",
  },
  {
    title: "Sentinela — melhorias (foco entrega 25/)",
    status: "inprogress",
    observation:
      "Pipelines v2 + LLM + trend em prod. Social/IG: código + flag/local Apify presentes; confirmar smoke em staging/prod. Refresh auto server-side (cron) ainda não.",
  },
  {
    title: "Testar ambiente guest vs premium (limites)",
    status: "inprogress",
    observation:
      "Limites implementados (créditos guest / caricatura). Falta QA formal humano (checklist guest vs premium) — Thiago/Guga.",
  },
  {
    title: "Filtro CNPJ eleitoral + teto vagas partido/UF + lista de reserva",
    status: "done",
    observation:
      "CNPJ via BrasilAPI; teto 03/partido+UF (avançado/elite) com status reserve + UI. E-mail automático de fila ainda não.",
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
