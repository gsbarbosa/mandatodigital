/**
 * Primeira resposta após o clique no botão positivo do template:
 * texto nosso, sem passar pela LLM. Só vale na primeira mensagem do lead.
 */

import { resolveTemplateCatalogEntry } from "@/lib/outbound/whatsapp-templates";
import type { InboundKind } from "@/lib/outbound/whatsapp-webhook";

export function normalizeButtonLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function fillCannedFirstName(body: string, nome: string): string {
  const safe = nome.trim() || "Oi";
  return body.replace(/\[Maria\]/g, safe).replace(/\{\{\s*nome\s*\}\}/gi, safe);
}

export function isTemplateButtonKind(kind: InboundKind | undefined): boolean {
  return kind === "button" || kind === "interactive";
}

export function resolveCannedPositiveReply(input: {
  kind: InboundKind | undefined;
  buttonText: string;
  lastTemplate: string;
  leadMessageCount: number;
  firstName: string;
}): string | null {
  if (!isTemplateButtonKind(input.kind)) {
    return null;
  }
  if (input.leadMessageCount !== 1) {
    return null;
  }

  const entry = resolveTemplateCatalogEntry(input.lastTemplate);
  const reply = entry?.cannedPositiveReply?.trim() ?? "";
  const labels = entry?.positiveButtonLabels ?? [];
  if (!reply || labels.length === 0) {
    return null;
  }

  const clicked = normalizeButtonLabel(input.buttonText);
  const matched = labels.some((label) => normalizeButtonLabel(label) === clicked);
  if (!matched) {
    return null;
  }

  return fillCannedFirstName(reply, input.firstName);
}
