export const CONTRACT_TEMPLATE_VERSION = "contract-v1";
export const DOSSIER_TEMPLATE_VERSION = "dossier-v1";

export const EATEASY = {
  razaoSocial: "EATEASY SERVICOS DIGITAIS LTDA",
  cnpj: "48.142.514/0001-08",
  nire: "31213497978",
  sede: "Av. Raja Gabaglia, nº 1000, Sala 409, Gutierrez, Belo Horizonte - MG, CEP 30.441-070",
  representante: "Thiago Pereira Lemos Ribeiro",
  local: "Belo Horizonte",
} as const;

export const PLAN_PRICES_CENTS: Record<"essencial" | "avancado" | "elite", number> = {
  essencial: 49900,
  avancado: 199800,
  elite: 499800,
};

export const PLAN_LABELS: Record<"essencial" | "avancado" | "elite", string> = {
  essencial: "Essencial",
  avancado: "Avançado",
  elite: "Elite",
};

export function formatBrlFromCents(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
