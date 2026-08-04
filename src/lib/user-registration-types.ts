import type { EarlyAccessPlanId } from "@/lib/early-access-types";
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
  /** Cobrança Asaas (boleto 3x). Default trial = free trial / convidado. */
  billingStatus: BillingStatus;
  asaasCustomerId: string | null;
  asaasSubscriptionId: string | null;
  pendingBoletoUrl: string | null;
  pendingBoletoLinhaDigitavel: string | null;
  pendingBoletoDueDate: string | null;
  pendingBoletoValue: number | null;
  paidInstallments: number;
  /** Última NFS-e autorizada (Asaas). */
  lastNfsPdfUrl: string | null;
  lastNfsXmlUrl: string | null;
  lastNfsNumber: string | null;
  lastNfsStatus: string | null;
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
