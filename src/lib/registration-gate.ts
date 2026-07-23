export const REGISTRATION_REQUIRED_PATH = "/acesso-antecipado/dados";

/** Rotas permitidas enquanto o cadastro pessoal estiver incompleto. */
export function isRegistrationAllowedPath(pathname: string) {
  return (
    pathname === REGISTRATION_REQUIRED_PATH ||
    pathname === "/acesso-antecipado/planos" ||
    pathname.startsWith("/acesso-antecipado/dados")
  );
}

export function resolvePostLoginPath(input: {
  registrationComplete: boolean;
  nextPath?: string | null;
}) {
  if (!input.registrationComplete) {
    return REGISTRATION_REQUIRED_PATH;
  }

  const next = input.nextPath?.trim() || "/app";
  if (!next.startsWith("/") || next.startsWith("//")) {
    return "/app";
  }
  return next;
}
