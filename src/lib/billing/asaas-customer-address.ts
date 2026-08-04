/**
 * Resolve endereço estruturado para o customer Asaas (necessário p/ NFS-e).
 * Preferência: BrasilAPI via CNPJ de campanha → parse do texto livre do cadastro.
 */

export type AsaasCustomerAddress = {
  postalCode: string;
  address: string;
  addressNumber: string;
  province: string;
  complement?: string;
};

/** Trecho com CEP mascarado (30.441-070, 30441-070, 30441070). */
const CEP_CHUNK_RE =
  /(?:CEP\s*)?(\d{2}\.?\d{3}[.\-]?\d{3}|\d{5}[.\-]?\d{3})\b/i;
const NUMERO_RE = /(?:^|,\s*|n[ºo°.]?\s*)(\d+[A-Za-z]?(?:\/\d+[A-Za-z]?)?)\b/i;

export function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

/** Extrai CEP (8 dígitos) de texto livre. */
export function extractCepDigits(raw: string): string | null {
  const labeled = raw.match(/CEP\s*([\d.\-]+)/i);
  if (labeled) {
    const digits = digitsOnly(labeled[1]);
    if (digits.length === 8) {
      return digits;
    }
  }
  const match = raw.match(CEP_CHUNK_RE);
  if (!match) {
    return null;
  }
  const digits = digitsOnly(match[1]);
  return digits.length === 8 ? digits : null;
}

/**
 * Parse aproximado do endereço de campanha (texto livre).
 * Formatos comuns: "Rua X, 123, Bairro, Cidade - UF, CEP 00000-000"
 */
export function parseFreeformCampaignAddress(raw: string): AsaasCustomerAddress | null {
  const text = raw.trim().replace(/\s+/g, " ");
  if (!text) {
    return null;
  }

  const postalCode = extractCepDigits(text);
  if (!postalCode) {
    return null;
  }

  const withoutCep = text
    .replace(/CEP\s*[\d.\-]+/i, "")
    .replace(CEP_CHUNK_RE, "")
    .replace(/,?\s*-\s*[A-Z]{2}\s*$/i, "")
    .replace(/,\s*$/, "")
    .trim();

  const parts = withoutCep
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  let address = parts[0] || withoutCep;
  let addressNumber = "S/N";
  let province = "Centro";
  let complement: string | undefined;

  const numeroInStreet = address.match(NUMERO_RE);
  if (numeroInStreet && /^\d/.test(numeroInStreet[1])) {
    addressNumber = numeroInStreet[1];
    address = address.replace(numeroInStreet[0], "").replace(/\s+,?\s*$/, "").trim() || address;
  } else if (parts[1] && /^\d+[A-Za-z]?/.test(parts[1].replace(/^n[ºo°.]\s*/i, ""))) {
    addressNumber = parts[1].replace(/^n[ºo°.]\s*/i, "").trim();
  }

  // Heurística: após rua/número, o próximo token sem "-" costuma ser bairro ou complemento.
  const remaining = parts.slice(addressNumber !== "S/N" && parts[1]?.includes(addressNumber) ? 2 : 1);
  if (remaining.length >= 2) {
    // "Sala 409", "Apto 12" → complemento; próximo → bairro
    const maybeComplement = remaining[0];
    if (/^(sala|apto|apartamento|conj|conjunto|bloco|loja|sl\.?)\b/i.test(maybeComplement)) {
      complement = maybeComplement;
      province = remaining[1] || province;
    } else {
      province = maybeComplement;
    }
  } else if (remaining[0]) {
    const cityLike = /[-–]\s*[A-Z]{2}\b/i.test(remaining[0]) || /\b(Belo Horizonte|São Paulo|Rio de Janeiro)\b/i.test(remaining[0]);
    if (!cityLike) {
      province = remaining[0].replace(/\s*[-–]\s*[A-Z]{2}\b.*/i, "").trim() || province;
    }
  }

  if (!address || address.length < 2) {
    return null;
  }

  return {
    postalCode,
    address: address.slice(0, 120),
    addressNumber: addressNumber.slice(0, 20),
    province: province.slice(0, 60),
    ...(complement ? { complement: complement.slice(0, 255) } : {}),
  };
}

export function addressFromCnpjLookup(lookup: {
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cep?: string;
}): AsaasCustomerAddress | null {
  const postalCode = digitsOnly(lookup.cep ?? "");
  const address = (lookup.logradouro ?? "").trim();
  if (postalCode.length !== 8 || address.length < 2) {
    return null;
  }
  return {
    postalCode,
    address: address.slice(0, 120),
    addressNumber: (lookup.numero?.trim() || "S/N").slice(0, 20),
    province: (lookup.bairro?.trim() || "Centro").slice(0, 60),
  };
}

export function mergeAddressSources(input: {
  cnpjLookup?: AsaasCustomerAddress | null;
  freeform?: AsaasCustomerAddress | null;
}): AsaasCustomerAddress | null {
  const primary = input.cnpjLookup;
  const fallback = input.freeform;
  if (!primary && !fallback) {
    return null;
  }
  if (primary && fallback) {
    return {
      postalCode: primary.postalCode || fallback.postalCode,
      address: primary.address || fallback.address,
      addressNumber:
        primary.addressNumber && primary.addressNumber !== "S/N"
          ? primary.addressNumber
          : fallback.addressNumber || primary.addressNumber,
      province: primary.province || fallback.province,
      ...(primary.complement || fallback.complement
        ? { complement: primary.complement || fallback.complement }
        : {}),
    };
  }
  return primary ?? fallback ?? null;
}
