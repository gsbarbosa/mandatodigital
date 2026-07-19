export type EarlyAccessPlanId = "essencial" | "avancado" | "elite";

export type EarlyAccessReservation = {
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
  planId: EarlyAccessPlanId;
  reservedAt: string;
};

export type EarlyAccessState = {
  reservation: EarlyAccessReservation | null;
  cnpj: string;
  cnpjSignedAt: string;
  reservationPopupSeen: boolean;
};
