import { formatEmailInput, isValidEmail } from "@/lib/br-input";

/** Firebase Auth exige no mínimo 6; no cadastro pedimos um pouco mais. */
export const LOGIN_PASSWORD_MIN_LENGTH = 6;
export const SIGNUP_PASSWORD_MIN_LENGTH = 8;

export type AuthFieldErrors = {
  email?: string;
  password?: string;
};

export function normalizeAuthEmail(value: string) {
  return formatEmailInput(value);
}

export function validateAuthEmail(value: string): string | null {
  const email = normalizeAuthEmail(value);
  if (!email) {
    return "Informe o e-mail.";
  }
  if (!isValidEmail(email)) {
    return "E-mail inválido — use o formato nome@dominio.com";
  }
  return null;
}

export function validateAuthPassword(
  value: string,
  mode: "login" | "signup",
): string | null {
  const password = value;
  if (!password) {
    return "Informe a senha.";
  }

  if (mode === "login") {
    if (password.length < LOGIN_PASSWORD_MIN_LENGTH) {
      return `A senha deve ter pelo menos ${LOGIN_PASSWORD_MIN_LENGTH} caracteres.`;
    }
    return null;
  }

  if (password.length < SIGNUP_PASSWORD_MIN_LENGTH) {
    return `A senha deve ter pelo menos ${SIGNUP_PASSWORD_MIN_LENGTH} caracteres.`;
  }
  if (!/[A-Za-zÀ-ÿ]/.test(password)) {
    return "A senha deve incluir pelo menos uma letra.";
  }
  if (!/[0-9]/.test(password)) {
    return "A senha deve incluir pelo menos um número.";
  }
  return null;
}

export function validateAuthCredentials(input: {
  email: string;
  password: string;
  mode: "login" | "signup";
}): AuthFieldErrors {
  const errors: AuthFieldErrors = {};
  const emailError = validateAuthEmail(input.email);
  if (emailError) {
    errors.email = emailError;
  }
  const passwordError = validateAuthPassword(input.password, input.mode);
  if (passwordError) {
    errors.password = passwordError;
  }
  return errors;
}

export function signupPasswordHint() {
  return `Mínimo ${SIGNUP_PASSWORD_MIN_LENGTH} caracteres, com letra e número.`;
}
