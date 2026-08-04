import {
  addressFromCnpjLookup,
  mergeAddressSources,
  parseFreeformCampaignAddress,
  type AsaasCustomerAddress,
} from "@/lib/billing/asaas-customer-address";
import { lookupCnpjBrasilApi } from "@/lib/legal/cnpj-natureza";
import { getLatestContractAcceptanceForOwner } from "@/lib/legal/contract-storage";
import type { UserRegistration } from "@/lib/user-registration-types";

export type AsaasBillingCustomerInput = {
  name: string;
  email: string;
  cpfCnpj: string;
  phone?: string;
  mobilePhone?: string;
  postalCode: string;
  address: string;
  addressNumber: string;
  province: string;
  complement?: string;
  externalReference: string;
  /** Documento usado no Asaas (cpf | cnpj). */
  documentKind: "cpf" | "cnpj";
  addressSource: "cnpj_receita" | "cadastro" | "merged";
};

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

/**
 * Monta o payload do customer Asaas para checkout/NFS-e.
 * Prefere CNPJ de campanha (contrato) + endereço da Receita; fallback CPF + endereço do cadastro.
 */
export async function resolveAsaasBillingCustomer(input: {
  registration: UserRegistration;
  sessionEmail?: string | null;
}): Promise<
  | { ok: true; customer: AsaasBillingCustomerInput }
  | { ok: false; message: string }
> {
  const registration = input.registration;
  const ownerUserId = registration.ownerUserId;
  const email = (registration.email || input.sessionEmail || "").trim();
  if (!email) {
    return { ok: false, message: "E-mail do cadastro ausente." };
  }

  const contract = await getLatestContractAcceptanceForOwner(ownerUserId);
  const campaignCnpjDigits = digitsOnly(contract?.campaignCnpj ?? "");
  const useCnpj = campaignCnpjDigits.length === 14;

  let cnpjAddress: AsaasCustomerAddress | null = null;
  let razaoSocial = "";
  if (useCnpj) {
    try {
      const lookup = await lookupCnpjBrasilApi(campaignCnpjDigits);
      razaoSocial = lookup.razaoSocial.trim();
      cnpjAddress = addressFromCnpjLookup(lookup);
    } catch {
      // Segue com endereço do cadastro/contrato.
    }
  }

  const freeformRaw =
    contract?.campaignAddress?.trim() || registration.address?.trim() || "";
  const freeformAddress = parseFreeformCampaignAddress(freeformRaw);
  const address = mergeAddressSources({
    cnpjLookup: cnpjAddress,
    freeform: freeformAddress,
  });

  if (!address?.postalCode) {
    return {
      ok: false,
      message:
        "Endereço incompleto para emitir NFS-e. Inclua o CEP no endereço da campanha (Dados) ou assine o contrato com CNPJ válido.",
    };
  }

  const cpfDigits = digitsOnly(registration.cpf);
  if (!useCnpj && cpfDigits.length !== 11) {
    return { ok: false, message: "CPF do cadastro invalido." };
  }

  const addressSource: AsaasBillingCustomerInput["addressSource"] =
    cnpjAddress && freeformAddress
      ? "merged"
      : cnpjAddress
        ? "cnpj_receita"
        : "cadastro";

  return {
    ok: true,
    customer: {
      name: (useCnpj && razaoSocial ? razaoSocial : registration.fullName).trim(),
      email,
      cpfCnpj: useCnpj ? campaignCnpjDigits : cpfDigits,
      phone: registration.phone || undefined,
      mobilePhone: registration.phone || undefined,
      postalCode: address.postalCode,
      address: address.address,
      addressNumber: address.addressNumber,
      province: address.province,
      ...(address.complement ? { complement: address.complement } : {}),
      externalReference: ownerUserId,
      documentKind: useCnpj ? "cnpj" : "cpf",
      addressSource,
    },
  };
}
