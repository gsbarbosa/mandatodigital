/**
 * Configuração de NFS-e automática via Asaas (invoiceSettings).
 * Off por padrão até ASAAS_NFS_ENABLED=true + serviço municipal/ISS.
 */

export type AsaasNfsTaxes = {
  retainIss: boolean;
  iss: number;
  cofins: number;
  csll: number;
  inss: number;
  ir: number;
  pis: number;
};

export type AsaasNfsInvoiceSettings = {
  municipalServiceId?: string;
  municipalServiceCode?: string;
  municipalServiceName?: string;
  serviceDescription: string;
  observations?: string;
  effectiveDatePeriod: "ON_PAYMENT_CONFIRMATION";
  receivedOnly: true;
  updatePayment: false;
  taxes: AsaasNfsTaxes;
};

function envFlag(name: string): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

export function isAsaasNfsEnabled(): boolean {
  return envFlag("ASAAS_NFS_ENABLED");
}

/**
 * Monta o payload de invoiceSettings ou null se flag off / config incompleta.
 */
export function buildAsaasNfsInvoiceSettings(input: {
  planLabel: string;
}): AsaasNfsInvoiceSettings | null {
  if (!isAsaasNfsEnabled()) {
    return null;
  }

  const municipalServiceId = process.env.ASAAS_NFS_MUNICIPAL_SERVICE_ID?.trim() || "";
  const municipalServiceCode = process.env.ASAAS_NFS_MUNICIPAL_SERVICE_CODE?.trim() || "";
  const municipalServiceName = process.env.ASAAS_NFS_MUNICIPAL_SERVICE_NAME?.trim() || "";

  if (!municipalServiceId && !municipalServiceCode) {
    return null;
  }

  if (municipalServiceCode && !municipalServiceId && !municipalServiceName) {
    return null;
  }

  const issRaw = process.env.ASAAS_NFS_ISS?.trim();
  if (!issRaw) {
    return null;
  }
  const iss = Number(issRaw.replace(",", "."));
  if (!Number.isFinite(iss)) {
    return null;
  }

  const settings: AsaasNfsInvoiceSettings = {
    serviceDescription: `Mandato Digital — pacote campanha (${input.planLabel})`,
    observations: "Pacote campanha — faturamento em 3 parcelas via boleto.",
    effectiveDatePeriod: "ON_PAYMENT_CONFIRMATION",
    receivedOnly: true,
    updatePayment: false,
    taxes: {
      retainIss: envFlag("ASAAS_NFS_RETAIN_ISS"),
      iss,
      cofins: envNumber("ASAAS_NFS_COFINS", 0),
      csll: envNumber("ASAAS_NFS_CSLL", 0),
      inss: envNumber("ASAAS_NFS_INSS", 0),
      ir: envNumber("ASAAS_NFS_IR", 0),
      pis: envNumber("ASAAS_NFS_PIS", 0),
    },
  };

  if (municipalServiceId) {
    settings.municipalServiceId = municipalServiceId;
  } else {
    settings.municipalServiceCode = municipalServiceCode;
    settings.municipalServiceName = municipalServiceName;
  }

  return settings;
}
