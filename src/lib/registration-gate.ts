export const REGISTRATION_REQUIRED_PATH = "/acesso-antecipado/dados";
export const PLAN_SELECTION_PATH = "/acesso-antecipado/planos";
export const BILLING_PAYMENT_PATH = "/acesso-antecipado/pagamento";

/** Plano default do free trial (convidado) ao concluir dados pessoais. */
export const FREE_TRIAL_DEFAULT_PLAN_ID = "essencial" as const;

/** Rotas permitidas enquanto o cadastro estiver incompleto. */
export function isRegistrationAllowedPath(pathname: string) {
  return (
    pathname === REGISTRATION_REQUIRED_PATH ||
    pathname.startsWith(`${REGISTRATION_REQUIRED_PATH}/`) ||
    pathname === PLAN_SELECTION_PATH ||
    pathname.startsWith(`${PLAN_SELECTION_PATH}/`) ||
    pathname === BILLING_PAYMENT_PATH ||
    pathname.startsWith(`${BILLING_PAYMENT_PATH}/`)
  );
}

/**
 * Próximo passo do cadastro incompleto.
 * Com free trial, após dados pessoais o fluxo conclui no servidor —
 * este helper só cobre o caso legado em que ainda falta plano.
 */
export function resolveIncompleteRegistrationPath(input: {
  needsPlanSelection: boolean;
}) {
  if (input.needsPlanSelection) {
    return PLAN_SELECTION_PATH;
  }
  return REGISTRATION_REQUIRED_PATH;
}

function extractPlanQuery(nextPath: string | null | undefined): string {
  if (!nextPath) {
    return "";
  }
  try {
    const url = new URL(nextPath, "http://local.invalid");
    const plan = url.searchParams.get("plan");
    if (plan === "essencial" || plan === "avancado" || plan === "elite") {
      return `?plan=${plan}`;
    }
  } catch {
    // ignore
  }
  return "";
}

export function resolvePostLoginPath(input: {
  registrationComplete: boolean;
  /** Dados pessoais ok, falta escolher o plano (legado — free trial costuma concluir no POST). */
  needsPlanSelection?: boolean;
  nextPath?: string | null;
}) {
  if (!input.registrationComplete) {
    if (input.needsPlanSelection) {
      return resolveIncompleteRegistrationPath({
        needsPlanSelection: true,
      });
    }
    return `${REGISTRATION_REQUIRED_PATH}${extractPlanQuery(input.nextPath)}`;
  }

  const next = input.nextPath?.trim() || "/app";
  if (!next.startsWith("/") || next.startsWith("//")) {
    return "/app";
  }
  return next;
}
