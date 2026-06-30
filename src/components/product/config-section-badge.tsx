import type { ConfigSectionStatus } from "@/lib/config-setup-status";

/** Badge só quando falta algo — evita ruído de “Concluído” na sidebar. */
export function ConfigSectionBadge({ status }: { status: ConfigSectionStatus }) {
  if (status === "pending") {
    return <span className="config-section-badge is-pending">Pendente</span>;
  }

  return null;
}
