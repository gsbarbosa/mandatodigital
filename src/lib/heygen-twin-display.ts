export type TwinLookDisplayMeta = {
  id: string;
  name?: string | null;
  group_id?: string | null;
  groupCreatedAt?: number | null;
  groupStatus?: string | null;
  consentStatus?: string | null;
  preview_video_url?: string | null;
  preview_image_url?: string | null;
  supported_api_engines?: string[];
};

export function isConsentApproved(consentStatus?: string | null) {
  const consent = String(consentStatus ?? "").toLowerCase();
  return !consent || consent === "completed" || consent === "approved";
}

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
}): HeyGenTrainingPhase {
  if (input.mode !== "digital_twin") {
    return "ready" as const;
  }

  const consent = String(input.consentStatus ?? "").toLowerCase();
  const status = String(input.groupStatus ?? "").toLowerCase();
  const consentApproved =
    !consent || consent === "completed" || consent === "approved";

  if (status.includes("fail")) {
    return "failed" as const;
  }

  if (!consentApproved) {
    return "awaiting_consent" as const;
  }

  if (input.consentUrl) {
    return "awaiting_consent" as const;
  }

  if (!status || status === "completed" || status === "ready") {
    return "ready" as const;
  }

  if (
    status === "processing" ||
    status === "pending" ||
    status === "pending_consent"
  ) {
    return "processing" as const;
  }

  // Consentimento ok com status não mapeado: trata como pronto (evita trava na UI).
  if (consentApproved) {
    return "ready" as const;
  }

  return "processing" as const;
}

/** Preview na HeyGen indica que o look já está operacional para vídeo. */
export function twinLookHasOperationalPreview(look: TwinLookDisplayMeta | null | undefined) {
  if (!look || !isUsableRecordedDigitalTwin(look)) {
    return false;
  }

  return Boolean(
    String(look.preview_video_url ?? "").trim() ||
      String(look.preview_image_url ?? "").trim(),
  );
}

/** Gêmeo apto para gerar vídeo (consentimento ok + look utilizável na HeyGen). */
export function isTwinLookReadyForVideo(
  look: TwinLookDisplayMeta | null | undefined,
  options?: {
    consentStatus?: string | null;
    groupStatus?: string | null;
  },
) {
  if (!look?.id) {
    return false;
  }

  const consentStatus = options?.consentStatus ?? look.consentStatus;
  const groupStatus = options?.groupStatus ?? look.groupStatus;
  const status = String(groupStatus ?? "").toLowerCase();

  if (status.includes("fail")) {
    return false;
  }

  if (!isConsentApproved(consentStatus)) {
    return false;
  }

  if (status === "pending_consent") {
    return false;
  }

  if (twinLookHasOperationalPreview({ ...look, consentStatus, groupStatus })) {
    return true;
  }

  if ((look.supported_api_engines ?? []).length > 0) {
    return true;
  }

  const phase = resolveHeyGenTrainingPhase({
    mode: "digital_twin",
    consentStatus,
    groupStatus,
    consentUrl: null,
  });

  if (phase === "ready") {
    return true;
  }

  // HeyGen costuma manter o grupo em "processing" mesmo com look pronto para API.
  if (phase === "processing") {
    return true;
  }

  return false;
}

export function resolveDigitalTwinTrainingPhase(input: {
  consentStatus?: string | null;
  groupStatus?: string | null;
  consentUrl?: string | null;
  look?: TwinLookDisplayMeta | null;
}) {
  const basePhase = resolveHeyGenTrainingPhase({
    mode: "digital_twin",
    consentStatus: input.consentStatus,
    groupStatus: input.groupStatus,
    consentUrl: input.consentUrl,
  });

  if (basePhase !== "processing" || !input.look) {
    return basePhase;
  }

  return isTwinLookReadyForVideo(input.look, {
    consentStatus: input.consentStatus,
    groupStatus: input.groupStatus,
  })
    ? "ready"
    : basePhase;
}

export function trainingPhaseFromTwinLook(
  look: TwinLookDisplayMeta | null | undefined,
): HeyGenTrainingPhase | null {
  if (!look) {
    return null;
  }

  return resolveHeyGenTrainingPhase({
    mode: "digital_twin",
    consentStatus: look.consentStatus,
    groupStatus: look.groupStatus,
    consentUrl: null,
  });
}

export function trainingPhaseMessage(phase: HeyGenTrainingPhase) {
  switch (phase) {
    case "awaiting_consent":
      return "Treino iniciado. Finalize o consentimento no link abaixo; ao concluir, o processamento continua automaticamente.";
    case "processing":
      return "Consentimento recebido. A HeyGen ainda reporta processamento no grupo — você já pode tentar gerar o vídeo.";
    case "ready":
      return "Gêmeo pronto. Você já pode gerar conteúdo com o avatar selecionado.";
    case "failed":
      return "O treinamento falhou na plataforma. Remova o gêmeo e tente novamente com outro vídeo.";
    default:
      return "";
  }
}
