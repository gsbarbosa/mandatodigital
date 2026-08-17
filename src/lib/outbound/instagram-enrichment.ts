/**
 * Validação da base enriquecida via Instagram antes de virar contato de disparo.
 *
 * O enriquecimento (perfil → telefone da bio/linktree) erra a associação com
 * frequência: a coluna do @ nem sempre corresponde ao candidato da mesma linha,
 * o mesmo telefone aparece em pessoas diferentes e o link da bio às vezes é de
 * um terceiro. Mandar template com o nome errado para um desconhecido é o
 * caminho curto para "denunciar spam" e queimar o número.
 *
 * Aqui ficam só funções puras — o CSV é lido pelo seed.
 * Ver "Base enriquecida via Instagram" em docs/marketing-outbound.md.
 */

/** DDD → UF, para flagrar telefone de estado incompatível com a candidatura. */
const DDD_UF: Record<string, string> = {
  "11": "SP", "12": "SP", "13": "SP", "14": "SP", "15": "SP", "16": "SP", "17": "SP", "18": "SP",
  "19": "SP", "21": "RJ", "22": "RJ", "24": "RJ", "27": "ES", "28": "ES", "31": "MG", "32": "MG",
  "33": "MG", "34": "MG", "35": "MG", "37": "MG", "38": "MG", "41": "PR", "42": "PR", "43": "PR",
  "44": "PR", "45": "PR", "46": "PR", "47": "SC", "48": "SC", "49": "SC", "51": "RS", "53": "RS",
  "54": "RS", "55": "RS", "61": "DF", "62": "GO", "63": "TO", "64": "GO", "65": "MT", "66": "MT",
  "67": "MS", "68": "AC", "69": "RO", "71": "BA", "73": "BA", "74": "BA", "75": "BA", "77": "BA",
  "79": "SE", "81": "PE", "82": "AL", "83": "PB", "84": "RN", "85": "CE", "86": "PI", "87": "PE",
  "88": "CE", "89": "PI", "91": "PA", "92": "AM", "93": "PA", "94": "PA", "95": "RR", "96": "AP",
  "97": "AM", "98": "MA", "99": "MA",
};

/** Encurtadores de bio cujo slug costuma identificar o dono do perfil. */
const BIO_HOSTS = /(?:linktr\.ee|beacons\.ai|keepo\.bio|onne\.link|linklist\.bio)\/([A-Za-z0-9._-]+)/;

export type EnrichedRow = {
  handle: string;
  candidateName: string;
  uf: string;
  role: string;
  party: string;
  /** Telefones já normalizados para E.164 (móveis). */
  phones: string[];
  /** URLs declaradas na bio do perfil. */
  bioLinks: string[];
};

export const REJECTION_REASONS = [
  "sem_telefone",
  "handle_nao_bate_com_nome",
  "telefone_de_varias_pessoas",
  "ddd_incompativel_com_uf",
  "bio_de_terceiro",
] as const;
export type RejectionReason = (typeof REJECTION_REASONS)[number];

export const REJECTION_LABELS: Record<RejectionReason, string> = {
  sem_telefone: "sem telefone utilizável",
  handle_nao_bate_com_nome: "@ não corresponde ao nome do candidato",
  telefone_de_varias_pessoas: "mesmo telefone atribuído a candidatos diferentes",
  ddd_incompativel_com_uf: "DDD de outro estado",
  bio_de_terceiro: "link da bio pertence a outra pessoa",
};

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * O @ plausivelmente identifica esse candidato?
 *
 * Casa por parte significativa do nome (>= 4 letras) contida no handle, ou pelo
 * começo do handle contido no nome — cobre "depdalmoribeiro" ↔ "DALMO RIBEIRO"
 * e rejeita "bomfimdf" ↔ "MILENA CÂMARA".
 */
export function handleMatchesName(handle: string, candidateName: string): boolean {
  const h = slugify(handle);
  const n = slugify(candidateName);
  if (!h || !n) {
    return false;
  }

  const parts = candidateName
    .split(/\s+/)
    .map(slugify)
    .filter((part) => part.length >= 4);

  return parts.some((part) => h.includes(part)) || n.includes(h.slice(0, 6));
}

/** Slug do primeiro link de bio reconhecido, ou "" quando não há. */
export function bioSlug(bioLinks: string[]): string {
  for (const link of bioLinks) {
    const match = BIO_HOSTS.exec(link);
    if (match) {
      return slugify(match[1] ?? "");
    }
  }
  return "";
}

export function bioBelongsToSomeoneElse(handle: string, bioLinks: string[]): boolean {
  const slug = bioSlug(bioLinks);
  if (!slug) {
    return false;
  }
  const h = slugify(handle);
  return !h.includes(slug) && !slug.includes(h);
}

export type ValidationResult =
  | { ok: true; phone: string }
  | { ok: false; reasons: RejectionReason[] };

/**
 * `phoneOwners` mapeia telefone → nomes de candidatos que o reivindicam na base
 * inteira; mais de um nome significa que a atribuição está errada em pelo menos
 * um deles, e não dá para saber qual.
 */
export function validateEnrichedRow(
  row: EnrichedRow,
  phoneOwners: Map<string, Set<string>>,
): ValidationResult {
  if (row.phones.length === 0) {
    return { ok: false, reasons: ["sem_telefone"] };
  }

  const reasons: RejectionReason[] = [];
  if (!handleMatchesName(row.handle, row.candidateName)) {
    reasons.push("handle_nao_bate_com_nome");
  }
  if (bioBelongsToSomeoneElse(row.handle, row.bioLinks)) {
    reasons.push("bio_de_terceiro");
  }

  // Escolhe o primeiro telefone que não esteja disputado nem em UF estranha.
  let escolhido = "";
  const perPhone: RejectionReason[] = [];

  for (const phone of row.phones) {
    const disputado = (phoneOwners.get(phone)?.size ?? 0) > 1;
    const ufDoDdd = DDD_UF[phone.slice(2, 4)];
    const ufDiverge = Boolean(ufDoDdd && row.uf && ufDoDdd !== row.uf);

    if (disputado) {
      perPhone.push("telefone_de_varias_pessoas");
    }
    if (ufDiverge) {
      perPhone.push("ddd_incompativel_com_uf");
    }
    if (!disputado && !ufDiverge) {
      escolhido = phone;
      break;
    }
  }

  if (!escolhido) {
    reasons.push(...new Set(perPhone));
  }

  if (reasons.length > 0) {
    return { ok: false, reasons };
  }

  return { ok: true, phone: escolhido };
}
