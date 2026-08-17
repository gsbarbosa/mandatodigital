/**
 * Logger leve para Cloud Logging (App Hosting / Cloud Run).
 * Prefixo estável + JSON em uma linha — sem secrets, roteiro, URLs assinadas ou PII.
 */

export type LogLevel = "info" | "warn" | "error";

export type LogValue = string | number | boolean | null | undefined;

export type LogFields = Record<string, LogValue>;

const MAX_ERROR_CHARS = 360;

const SEVERITY_BY_LEVEL: Record<LogLevel, "INFO" | "WARNING" | "ERROR"> = {
  info: "INFO",
  warn: "WARNING",
  error: "ERROR",
};

function sanitizeFields(fields?: LogFields): Record<string, string | number | boolean | null> {
  if (!fields) {
    return {};
  }
  const out: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) {
      continue;
    }
    if (typeof value === "string") {
      out[key] = value.length > MAX_ERROR_CHARS ? `${value.slice(0, MAX_ERROR_CHARS)}…` : value;
      continue;
    }
    out[key] = value;
  }
  return out;
}

export function summarizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, MAX_ERROR_CHARS);
  }
  if (typeof error === "string") {
    return error.slice(0, MAX_ERROR_CHARS);
  }
  try {
    return JSON.stringify(error).slice(0, MAX_ERROR_CHARS);
  } catch {
    return "unknown_error";
  }
}

export function startTimer() {
  const started = Date.now();
  return () => Date.now() - started;
}

export function buildAppLogEntry(
  scope: string,
  event: string,
  fields?: LogFields,
  level: LogLevel = "info",
) {
  return {
    severity: SEVERITY_BY_LEVEL[level],
    message: `[${scope}] ${event}`,
    scope,
    event,
    ...sanitizeFields(fields),
    ts: new Date().toISOString(),
  };
}

/** Emite uma linha JSON com `severity` — Cloud Logging indexa `jsonPayload.event`. */
export function appLog(
  scope: string,
  event: string,
  fields?: LogFields,
  level: LogLevel = "info",
) {
  const line = JSON.stringify(buildAppLogEntry(scope, event, fields, level));
  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.info(line);
}

export function appLogError(
  scope: string,
  event: string,
  error: unknown,
  fields?: LogFields,
) {
  appLog(
    scope,
    event,
    {
      ...fields,
      error: summarizeError(error),
    },
    "error",
  );
}

/** Path lógico sem querystring (evita tokens em URLs). */
export function safeApiPath(path: string) {
  const raw = String(path ?? "").trim();
  const q = raw.indexOf("?");
  return q >= 0 ? raw.slice(0, q) : raw;
}
