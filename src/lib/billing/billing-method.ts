export type BillingMethod = "boleto" | "pix";

export function parseBillingMethod(value: unknown): BillingMethod | null {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  if (raw === "boleto" || raw === "pix") {
    return raw;
  }
  if (raw === "bank_slip" || raw === "bankslip") {
    return "boleto";
  }
  return null;
}

export function billingMethodFromAsaas(billingType: string | null | undefined): BillingMethod | null {
  const raw = String(billingType ?? "").trim().toUpperCase();
  if (raw === "PIX") {
    return "pix";
  }
  if (raw === "BOLETO") {
    return "boleto";
  }
  return null;
}

export const BILLING_METHOD_LABELS: Record<BillingMethod, string> = {
  pix: "PIX",
  boleto: "Boleto",
};
