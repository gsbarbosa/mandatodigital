export type TwinLookDisplayMeta = {
  id: string;
  name?: string | null;
  group_id?: string | null;
  groupCreatedAt?: number | null;
  groupStatus?: string | null;
  consentStatus?: string | null;
};

export function formatHeyGenUnixTimestamp(seconds?: number | null) {
  if (!seconds || !Number.isFinite(seconds)) {
    return "Data não informada";
  }

  return new Date(seconds * 1000).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

/** Gêmeo existente na conta (gravado), excluindo falha ou consentimento ainda pendente. */
export function isUsableRecordedDigitalTwin(look: TwinLookDisplayMeta) {
  const status = String(look.groupStatus ?? "").trim().toLowerCase();
  const consent = String(look.consentStatus ?? "").trim().toLowerCase();

  if (status.includes("fail")) {
    return false;
  }

  if (status === "pending_consent") {
    return false;
  }

  if (
    consent === "pending" ||
    consent === "waiting" ||
    consent === "incomplete"
  ) {
    return false;
  }

  return true;
}

export function formatTwinLookCaption(look: TwinLookDisplayMeta) {
  const created = formatHeyGenUnixTimestamp(look.groupCreatedAt ?? null);
  const shortId = look.id ? look.id.slice(0, 8) : "—";
  const status = String(look.groupStatus ?? "").trim();
  const consent = String(look.consentStatus ?? "").trim();

  const parts = [`Criado em ${created}`, `ID ${shortId}…`];
  if (status) {
    parts.push(`status: ${status}`);
  }
  if (consent) {
    parts.push(`consent.: ${consent}`);
  }

  return parts.join(" · ");
}

export type HeyGenTrainingPhase =
  | "awaiting_consent"
  | "processing"
  | "ready"
  | "failed";

export function resolveHeyGenTrainingPhase(input: {
  mode: "digital_twin" | "photo" | "caricature";
  consentStatus?: string | null;
  groupStatus?: string | null;
  consentUrl?: string | null;
}) {
  if (input.mode !== "digital_twin") {
    return "ready" as const;
  }

  const consent = String(input.consentStatus ?? "").toLowerCase();
  const status = String(input.groupStatus ?? "").toLowerCase();

  if (status.includes("fail")) {
    return "failed" as const;
  }

  if (consent && consent !== "completed" && consent !== "approved") {
    return "awaiting_consent" as const;
  }

  if (input.consentUrl) {
    return "awaiting_consent" as const;
  }

  if (status === "completed" || status === "ready") {
    return "ready" as const;
  }

  if (
    status === "processing" ||
    status === "pending" ||
    status === "pending_consent"
  ) {
    return input.consentUrl ? ("awaiting_consent" as const) : ("processing" as const);
  }

  return "processing" as const;
}

export function trainingPhaseMessage(phase: HeyGenTrainingPhase) {
  switch (phase) {
    case "awaiting_consent":
      return "Treino iniciado. Finalize o consentimento no link abaixo; depois clique em “Atualizar status do treino”.";
    case "processing":
      return "Consentimento recebido. O gêmeo está em processamento na plataforma — aguarde e atualize o status.";
    case "ready":
      return "Gêmeo pronto. Você já pode gerar conteúdo com o avatar selecionado.";
    case "failed":
      return "O treinamento falhou na plataforma. Remova o gêmeo e tente novamente com outro vídeo.";
    default:
      return "";
  }
}
