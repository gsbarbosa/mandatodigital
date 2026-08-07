import type { EarlyAccessPlanId } from "@/lib/early-access-types";
import type { BillingMethod } from "@/lib/billing/billing-method";
import type { BillingStatus } from "@/lib/billing/plan-pricing";

export type UserRegistrationStatus = "incomplete" | "complete" | "reserve";

/** Cadastro real do usuário (fonte da verdade no Firestore). */
export type UserRegistration = {
  ownerUserId: string;
  profileId: string | null;
  status: UserRegistrationStatus;
  fullName: string;
  party: string;
  cpf: string;
  uf: string;
  role: string;
  address: string;
  phone: string;
  email: string;
  teamEmail: string;
  teamPhone: string;
  planId: EarlyAccessPlanId | "";
  /** Cobrança Asaas (pacote único em PIX/boleto 3x). Default trial = convidado. */
  billingStatus: BillingStatus;
  billingMethod: BillingMethod | null;
  asaasCustomerId: string | null;
  asaasSubscriptionId: string | null;
  /** Parcelamento Asaas (pacote único em 3x). Preferir isto à assinatura. */
  asaasInstallmentId: string | null;
  /** Cobrança atual/primeira (smoke 1x ou 1ª parcela do pacote). */
  asaasPrimaryPaymentId: string | null;
  /** Vencimento da 1ª parcela; 2ª e 3ª = +1 e +2 meses civis. */
  billingFirstDueDate: string | null;
  pendingBoletoUrl: string | null;
  pendingBoletoLinhaDigitavel: string | null;
  pendingBoletoDueDate: string | null;
  pendingBoletoValue: number | null;
  pendingPixPayload: string | null;
  pendingPixQrImage: string | null;
  pendingPixExpiration: string | null;
  paidInstallments: number;
  /** Última cobrança Asaas já contabilizada (evita CONFIRMED+RECEIVED somarem 2x). */
  lastPaidPaymentId: string | null;
  /** Quando a última parcela paga foi reconciliada (webhook ou status). */
  lastPaidAt: string | null;
  /** Última NFS-e autorizada (Asaas). */
  lastNfsPdfUrl: string | null;
  lastNfsXmlUrl: string | null;
  lastNfsNumber: string | null;
  lastNfsStatus: string | null;
  /** Número/id da NFS já enviada por e-mail (idempotência). */
  lastNfsEmailSentFor: string | null;
  /** Parcelas já agendadas para NFS-e (idempotência no parcelamento). */
  scheduledNfsPaymentIds: string[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

/** Payload de dados pessoais do cadastro. */
export type UserRegistrationPersonalInput = {
  fullName: string;
  party: string;
  cpf: string;
  uf: string;
  role: string;
  address: string;
  phone: string;
  email: string;
  teamEmail: string;
  teamPhone: string;
};

/** Campos editáveis após o cadastro (CPF e nome ficam imutáveis). */
export type UserRegistrationEditableInput = Omit<
  UserRegistrationPersonalInput,
  "fullName" | "cpf"
>;

/** Payload de conclusão do cadastro (dados + plano). */
export type UserRegistrationCompleteInput = UserRegistrationPersonalInput & {
  planId: EarlyAccessPlanId;
};

export type SeatAssignment = {
  status: "complete" | "reserve";
  activeSeats: number;
  maxSeats: number;
  message: string;
};
