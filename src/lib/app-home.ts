import type { Route } from "next";

/**
 * Entrada canônica do produto (logado).
 * `/` permanece sempre o site institucional — logado ou não.
 */
export const APP_HOME_PATH = "/app" as Route;

/** Destino padrão após entrar em `/app` (Monitoramento Nacional). */
export const APP_DEFAULT_LANDING = "/monitoramento" as Route;
