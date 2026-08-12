/**
 * Leitura/escrita da base de candidaturas TSE 2026 (doc id = CPF, 11 dígitos).
 *
 * Dado público (divulgação de candidaturas do TSE), mas o endpoint que consome
 * isto transforma "CPF" em "nome + partido + cargo" — daí o rate limit em
 * rate-limit-firestore.ts. Regras do Firestore negam acesso do client; só
 * Admin SDK lê esta collection.
 */

import { digitsOnly } from "@/lib/br-input";
import { COLLECTIONS, col } from "@/lib/firebase/collections";
import { hasAnyPrefillValue, type TseCandidatePrefill } from "@/lib/tse-candidates";

function candidateDocId(cpf: string): string | null {
  const digits = digitsOnly(cpf);
  return digits.length === 11 ? digits : null;
}

/** `null` quando o CPF não está na base — o cadastro segue normalmente. */
export async function findTseCandidateByCpf(
  cpf: string,
): Promise<TseCandidatePrefill | null> {
  const docId = candidateDocId(cpf);
  if (!docId) {
    return null;
  }

  const snapshot = await col(COLLECTIONS.tseCandidates2026).doc(docId).get();
  if (!snapshot.exists) {
    return null;
  }

  const data = snapshot.data() ?? {};
  const prefill: TseCandidatePrefill = {
    fullName: String(data.fullName ?? "").trim(),
    party: String(data.party ?? "").trim(),
    uf: String(data.uf ?? "").trim(),
    role: String(data.role ?? "").trim(),
  };

  return hasAnyPrefillValue(prefill) ? prefill : null;
}

/** Usado só pelo seed. Grava em lotes de 500 (limite do batch do Firestore). */
export async function writeTseCandidates(
  entries: { cpf: string; prefill: TseCandidatePrefill }[],
): Promise<number> {
  const collection = col(COLLECTIONS.tseCandidates2026);
  const seededAt = new Date().toISOString();
  let written = 0;

  for (let start = 0; start < entries.length; start += 500) {
    const chunk = entries.slice(start, start + 500);
    const batch = collection.firestore.batch();

    for (const entry of chunk) {
      const docId = candidateDocId(entry.cpf);
      if (!docId) {
        continue;
      }
      batch.set(collection.doc(docId), { ...entry.prefill, seededAt });
      written += 1;
    }

    await batch.commit();
  }

  return written;
}
