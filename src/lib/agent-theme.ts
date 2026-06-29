export type AgentThemeId =
  | "sentinela"
  | "curador"
  | "criativo"
  | "auditor"
  | "distribuidor"
  | "inicio";

export function resolveAgentThemeFromPathname(pathname: string): AgentThemeId {
  if (pathname === "/inicio" || pathname.startsWith("/inicio/")) {
    return "inicio";
  }
  if (pathname === "/onboarding" || pathname.startsWith("/onboarding/")) {
    return "inicio";
  }
  if (pathname === "/configuracoes" || pathname.startsWith("/configuracoes/")) {
    return "curador";
  }
  if (pathname === "/sentinela" || pathname.startsWith("/sentinela/")) {
    return "sentinela";
  }
  if (pathname === "/criativo" || pathname.startsWith("/criativo/")) {
    return "criativo";
  }
  if (pathname === "/auditor" || pathname.startsWith("/auditor/")) {
    return "auditor";
  }
  if (pathname === "/distribuidor" || pathname.startsWith("/distribuidor/")) {
    return "distribuidor";
  }
  return "curador";
}

export function agentThemeClassName(theme: AgentThemeId) {
  return `agent-theme-${theme}`;
}
