/**
 * Cliente HTTP mínimo da API Asaas v3 (boleto / assinaturas).
 * Auth: header `access_token` = ASAAS_API_KEY.
 */

export class AsaasApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "AsaasApiError";
    this.status = status;
    this.payload = payload;
  }
}

function getAsaasBaseUrl() {
  const raw = process.env.ASAAS_API_URL?.trim();
  if (raw) {
    return raw.replace(/\/$/, "");
  }
  return "https://api.asaas.com/v3";
}

function getAsaasApiKey() {
  const key = process.env.ASAAS_API_KEY?.trim();
  if (!key) {
    throw new Error("ASAAS_API_KEY nao configurada.");
  }
  return key;
}

export type AsaasCustomer = {
  id: string;
  name?: string;
  email?: string;
  cpfCnpj?: string;
  externalReference?: string | null;
};

export type AsaasSubscription = {
  id: string;
  customer: string;
  billingType: string;
  value: number;
  cycle: string;
  status?: string;
  nextDueDate?: string;
  endDate?: string | null;
  description?: string | null;
  externalReference?: string | null;
};

export type AsaasPayment = {
  id: string;
  customer: string;
  subscription?: string | null;
  status: string;
  value: number;
  dueDate: string;
  billingType?: string;
  invoiceUrl?: string | null;
  bankSlipUrl?: string | null;
  identificationField?: string | null;
  externalReference?: string | null;
};

type AsaasListResponse<T> = {
  data?: T[];
  totalCount?: number;
};

async function asaasFetch<T>(
  path: string,
  init?: RequestInit & { query?: Record<string, string | number | undefined> },
): Promise<T> {
  const url = new URL(`${getAsaasBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`);
  if (init?.query) {
    for (const [key, value] of Object.entries(init.query)) {
      if (value === undefined || value === "") {
        continue;
      }
      url.searchParams.set(key, String(value));
    }
  }

  const { query: _q, ...rest } = init ?? {};
  const response = await fetch(url.toString(), {
    ...rest,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      access_token: getAsaasApiKey(),
      ...(rest.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "errors" in payload
        ? JSON.stringify((payload as { errors: unknown }).errors)
        : `Asaas HTTP ${response.status}`;
    throw new AsaasApiError(message, response.status, payload);
  }

  return payload as T;
}

export async function asaasCreateCustomer(input: {
  name: string;
  email: string;
  cpfCnpj: string;
  phone?: string;
  mobilePhone?: string;
  postalCode?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  province?: string;
  externalReference: string;
}): Promise<AsaasCustomer> {
  return asaasFetch<AsaasCustomer>("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      email: input.email,
      cpfCnpj: input.cpfCnpj.replace(/\D/g, ""),
      phone: input.phone?.replace(/\D/g, "") || undefined,
      mobilePhone: input.mobilePhone?.replace(/\D/g, "") || undefined,
      postalCode: input.postalCode?.replace(/\D/g, "") || undefined,
      address: input.address?.trim() || undefined,
      addressNumber: input.addressNumber?.trim() || undefined,
      complement: input.complement?.trim() || undefined,
      province: input.province?.trim() || undefined,
      externalReference: input.externalReference,
      notificationDisabled: false,
    }),
  });
}

export async function asaasUpdateCustomer(
  customerId: string,
  input: {
    name?: string;
    email?: string;
    cpfCnpj?: string;
    phone?: string;
    mobilePhone?: string;
    postalCode?: string;
    address?: string;
    addressNumber?: string;
    complement?: string;
    province?: string;
    externalReference?: string;
  },
): Promise<AsaasCustomer> {
  return asaasFetch<AsaasCustomer>(`/customers/${encodeURIComponent(customerId)}`, {
    method: "PUT",
    body: JSON.stringify({
      ...(input.name ? { name: input.name } : {}),
      ...(input.email ? { email: input.email } : {}),
      ...(input.cpfCnpj ? { cpfCnpj: input.cpfCnpj.replace(/\D/g, "") } : {}),
      ...(input.phone ? { phone: input.phone.replace(/\D/g, "") } : {}),
      ...(input.mobilePhone ? { mobilePhone: input.mobilePhone.replace(/\D/g, "") } : {}),
      ...(input.postalCode
        ? { postalCode: input.postalCode.replace(/\D/g, "") }
        : {}),
      ...(input.address?.trim() ? { address: input.address.trim() } : {}),
      ...(input.addressNumber?.trim()
        ? { addressNumber: input.addressNumber.trim() }
        : {}),
      ...(input.complement?.trim() ? { complement: input.complement.trim() } : {}),
      ...(input.province?.trim() ? { province: input.province.trim() } : {}),
      ...(input.externalReference
        ? { externalReference: input.externalReference }
        : {}),
    }),
  });
}

export async function asaasFindCustomerByExternalReference(
  externalReference: string,
): Promise<AsaasCustomer | null> {
  const list = await asaasFetch<AsaasListResponse<AsaasCustomer>>("/customers", {
    method: "GET",
    query: { externalReference, limit: 1 },
  });
  return list.data?.[0] ?? null;
}

export async function asaasFindCustomerById(
  customerId: string,
): Promise<AsaasCustomer | null> {
  try {
    return await asaasFetch<AsaasCustomer>(
      `/customers/${encodeURIComponent(customerId)}`,
      { method: "GET" },
    );
  } catch (error) {
    if (error instanceof AsaasApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Garante customer no Asaas com endereço/documento atualizados (necessário p/ NFS-e).
 * Se já existir (por id ou externalReference), faz PUT; senão cria.
 */
export async function asaasEnsureCustomer(input: {
  name: string;
  email: string;
  cpfCnpj: string;
  phone?: string;
  mobilePhone?: string;
  postalCode?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  province?: string;
  externalReference: string;
  existingCustomerId?: string | null;
}): Promise<AsaasCustomer> {
  const existingById = input.existingCustomerId
    ? await asaasFindCustomerById(input.existingCustomerId)
    : null;
  const existing =
    existingById ?? (await asaasFindCustomerByExternalReference(input.externalReference));

  if (existing?.id) {
    return asaasUpdateCustomer(existing.id, {
      name: input.name,
      email: input.email,
      cpfCnpj: input.cpfCnpj,
      phone: input.phone,
      mobilePhone: input.mobilePhone,
      postalCode: input.postalCode,
      address: input.address,
      addressNumber: input.addressNumber,
      complement: input.complement,
      province: input.province,
      externalReference: input.externalReference,
    });
  }

  return asaasCreateCustomer(input);
}

export async function asaasCreateSubscription(input: {
  customerId: string;
  billingType: "BOLETO" | "PIX";
  value: number;
  nextDueDate: string;
  endDate: string;
  description: string;
  externalReference: string;
}): Promise<AsaasSubscription> {
  return asaasFetch<AsaasSubscription>("/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      customer: input.customerId,
      billingType: input.billingType,
      value: input.value,
      cycle: "MONTHLY",
      nextDueDate: input.nextDueDate,
      endDate: input.endDate,
      description: input.description,
      externalReference: input.externalReference,
    }),
  });
}

export async function asaasCreateBoletoSubscription(input: {
  customerId: string;
  value: number;
  nextDueDate: string;
  endDate: string;
  description: string;
  externalReference: string;
}): Promise<AsaasSubscription> {
  return asaasCreateSubscription({ ...input, billingType: "BOLETO" });
}

export type AsaasPixQrCode = {
  encodedImage?: string | null;
  payload?: string | null;
  expirationDate?: string | null;
};

export async function asaasGetPixQrCode(paymentId: string): Promise<AsaasPixQrCode> {
  return asaasFetch<AsaasPixQrCode>(`/payments/${encodeURIComponent(paymentId)}/pixQrCode`, {
    method: "GET",
  });
}

export async function asaasListSubscriptionPayments(
  subscriptionId: string,
): Promise<AsaasPayment[]> {
  const list = await asaasFetch<AsaasListResponse<AsaasPayment>>(
    `/subscriptions/${encodeURIComponent(subscriptionId)}/payments`,
    { method: "GET", query: { limit: 20 } },
  );
  return list.data ?? [];
}

export async function asaasGetPayment(paymentId: string): Promise<AsaasPayment> {
  return asaasFetch<AsaasPayment>(`/payments/${encodeURIComponent(paymentId)}`, {
    method: "GET",
  });
}

export type AsaasInvoice = {
  id: string;
  status?: string;
  customer?: string;
  payment?: string | null;
  number?: string | null;
  pdfUrl?: string | null;
  xmlUrl?: string | null;
  statusDescription?: string | null;
};

export type AsaasSubscriptionInvoiceSettingsInput = {
  municipalServiceId?: string;
  municipalServiceCode?: string;
  municipalServiceName?: string;
  serviceDescription: string;
  observations?: string;
  effectiveDatePeriod: "ON_PAYMENT_CONFIRMATION";
  receivedOnly: true;
  updatePayment: false;
  taxes: {
    retainIss: boolean;
    iss: number;
    cofins: number;
    csll: number;
    inss: number;
    ir: number;
    pis: number;
  };
};

/** Emite NFS-e automaticamente nas cobranças da assinatura após pagamento. */
export async function asaasCreateSubscriptionInvoiceSettings(
  subscriptionId: string,
  settings: AsaasSubscriptionInvoiceSettingsInput,
): Promise<unknown> {
  return asaasFetch(`/subscriptions/${encodeURIComponent(subscriptionId)}/invoiceSettings`, {
    method: "POST",
    body: JSON.stringify(settings),
  });
}

export async function asaasGetInvoice(invoiceId: string): Promise<AsaasInvoice> {
  return asaasFetch<AsaasInvoice>(`/invoices/${encodeURIComponent(invoiceId)}`, {
    method: "GET",
  });
}

/** Preferência: boleto pendente mais próximo; senão o primeiro da lista. */
export function pickPrimaryBoletoPayment(payments: AsaasPayment[]): AsaasPayment | null {
  if (!payments.length) {
    return null;
  }
  const pending = payments
    .filter((p) => {
      const status = p.status?.toUpperCase() ?? "";
      return status === "PENDING" || status === "OVERDUE";
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  if (pending[0]) {
    return pending[0];
  }
  return [...payments].sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0] ?? null;
}
