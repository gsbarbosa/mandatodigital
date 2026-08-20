import { addressFromCnpjLookup } from "@/lib/billing/asaas-customer-address";

export type CnpjLookupResult = {
  cnpj: string;
  razaoSocial: string;
  naturezaJuridica: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
};

/** Linha legível pro contrato; null = sem dado suficiente pra travar o campo. */
export function formatAddressFromLookup(lookup: CnpjLookupResult): string | null {
  const asaas = addressFromCnpjLookup(lookup);
  if (!asaas) {
    return null;
  }
  const cepDigits = asaas.postalCode;
  const cepLabel =
    cepDigits.length === 8
      ? `${cepDigits.slice(0, 5)}-${cepDigits.slice(5)}`
      : cepDigits;
  const cityUf = [lookup.municipio?.trim(), lookup.uf?.trim()]
    .filter(Boolean)
    .join(" - ");
  const parts = [
    asaas.address,
    asaas.addressNumber,
    asaas.province,
    cityUf || null,
    cepLabel ? `CEP ${cepLabel}` : null,
  ].filter((part): part is string => Boolean(part && part.trim()));
  return parts.length >= 2 ? parts.join(", ") : null;
}

const ALLOWED_NATUREZA_PATTERNS = [
  /comit[eé]\s+financeiro/i,
  /candidato\s+a\s+cargo\s+pol[ií]tico\s+eletivo/i,
];

export function isAllowedElectoralNatureza(natureza: string) {
  const normalized = natureza.normalize("NFD").replace(/\p{M}/gu, "");
  return ALLOWED_NATUREZA_PATTERNS.some((pattern) => pattern.test(normalized));
}

export async function lookupCnpjBrasilApi(cnpjDigits: string): Promise<CnpjLookupResult> {
  const digits = cnpjDigits.replace(/\D/g, "");
  if (digits.length !== 14) {
    throw new Error("CNPJ deve conter 14 digitos.");
  }

  const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (response.status === 404) {
    throw new Error("CNPJ nao encontrado na base da Receita Federal.");
  }

  if (!response.ok) {
    throw new Error(`Falha ao consultar CNPJ (HTTP ${response.status}).`);
  }

  const data = (await response.json()) as {
    cnpj?: string;
    razao_social?: string;
    nome_fantasia?: string;
    natureza_juridica?: string;
    descricao_natureza_juridica?: string;
    logradouro?: string;
    numero?: string;
    bairro?: string;
    municipio?: string;
    uf?: string;
    cep?: string;
  };

  const natureza =
    data.descricao_natureza_juridica?.trim() ||
    data.natureza_juridica?.trim() ||
    "";

  return {
    cnpj: data.cnpj ?? digits,
    razaoSocial: data.razao_social?.trim() || data.nome_fantasia?.trim() || "",
    naturezaJuridica: natureza,
    logradouro: data.logradouro,
    numero: data.numero,
    bairro: data.bairro,
    municipio: data.municipio,
    uf: data.uf,
    cep: data.cep,
  };
}

export function assertElectoralCnpj(lookup: CnpjLookupResult) {
  if (!isAllowedElectoralNatureza(lookup.naturezaJuridica)) {
    throw new Error(
      `CNPJ com natureza juridica "${lookup.naturezaJuridica || "desconhecida"}" nao e elegivel. Aceitos: Comite Financeiro ou Candidato a Cargo Politico Eletivo.`,
    );
  }
}
