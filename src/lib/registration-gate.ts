export const REGISTRATION_REQUIRED_PATH = "/acesso-antecipado/dados";
export const PLAN_SELECTION_PATH = "/acesso-antecipado/planos";

/** Rotas permitidas enquanto o cadastro estiver incompleto. */
export function isRegistrationAllowedPath(pathname: string) {
  return (
    pathname === REGISTRATION_REQUIRED_PATH ||
    pathname.startsWith(`${REGISTRATION_REQUIRED_PATH}/`) ||
    pathname === PLAN_SELECTION_PATH ||
    pathname.startsWith(`${PLAN_SELECTION_PATH}/`)
  );
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
  /** Dados pessoais ok, falta escolher o plano (fluxo "Entrar"). */
  needsPlanSelection?: boolean;
  nextPath?: string | null;
}) {
  if (!input.registrationComplete) {
    if (input.needsPlanSelection) {
      return PLAN_SELECTION_PATH;
    }
    return `${REGISTRATION_REQUIRED_PATH}${extractPlanQuery(input.nextPath)}`;
  }

  const next = input.nextPath?.trim() || "/app";
  if (!next.startsWith("/") || next.startsWith("//")) {
    return "/app";
  }
  return next;
}
