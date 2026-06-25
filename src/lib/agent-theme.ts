export type AgentThemeId =
  | "sentinela"
  | "curador"
  | "criativo"
  | "auditor"
  | "distribuidor";

export function resolveAgentThemeFromPathname(pathname: string): AgentThemeId {
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
