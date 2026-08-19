import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleInboundMessage } from "@/lib/outbound/inbound-handler";
import type { MarketingConversation } from "@/lib/outbound/types";

const appendInboundMessage = vi.fn();
const appendAgentMessage = vi.fn();
const setPendingSuggestion = vi.fn();
const setConversationError = vi.fn();
const setAgentPaused = vi.fn();
const getContactByPhone = vi.fn();
const setContactOptOut = vi.fn();
const generateAgentReply = vi.fn();
const sendText = vi.fn();
const resolveWhatsappConfig = vi.fn();

vi.mock("@/lib/firebase/collections", () => ({
  COLLECTIONS: { marketingContacts: "marketingContacts" },
  col: () => ({
    where: () => ({
      limit: () => ({
        get: async () => ({ docs: [] }),
      }),
    }),
  }),
}));

vi.mock("@/lib/observability/log", () => ({
  appLog: vi.fn(),
  appLogError: vi.fn(),
}));

vi.mock("@/lib/outbound/conversations-storage", () => ({
  appendInboundMessage: (...args: unknown[]) => appendInboundMessage(...args),
  appendAgentMessage: (...args: unknown[]) => appendAgentMessage(...args),
  setPendingSuggestion: (...args: unknown[]) => setPendingSuggestion(...args),
  setConversationError: (...args: unknown[]) => setConversationError(...args),
  setAgentPaused: (...args: unknown[]) => setAgentPaused(...args),
}));

vi.mock("@/lib/outbound/contacts-storage", () => ({
  getContactByPhone: (...args: unknown[]) => getContactByPhone(...args),
  setContactOptOut: (...args: unknown[]) => setContactOptOut(...args),
}));

vi.mock("@/lib/outbound/conversation-agent", () => ({
  generateAgentReply: (...args: unknown[]) => generateAgentReply(...args),
}));

vi.mock("@/lib/outbound/whatsapp", () => ({
  sendText: (...args: unknown[]) => sendText(...args),
  resolveWhatsappConfig: (...args: unknown[]) => resolveWhatsappConfig(...args),
}));

function conversation(overrides: Partial<MarketingConversation> = {}): MarketingConversation {
  const now = new Date().toISOString();
  return {
    id: "5531999999999",
    contactId: "c1",
    contactName: "Lead",
    phoneE164: "5531999999999",
    campaignId: "",
    messages: [{ role: "lead", text: "tenho interesse", providerMessageId: "wamid.1", at: now }],
    lastInboundAt: now,
    agentPaused: false,
    suggestedReply: "",
    suggestedAt: "",
    autoSendAt: "",
    lastError: "",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("handleInboundMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appendInboundMessage.mockResolvedValue(conversation());
    getContactByPhone.mockResolvedValue(null);
    generateAgentReply.mockResolvedValue({ text: "Vamos nessa?", provider: "openai", model: "x" });
    setPendingSuggestion.mockResolvedValue({
      suggestedAt: "2026-08-18T12:00:00.000Z",
      autoSendAt: "2026-08-18T12:03:00.000Z",
    });
  });

  it("grava a sugestão e não envia pelo WhatsApp", async () => {
    const result = await handleInboundMessage({
      from: "5531999999999",
      text: "tenho interesse",
      providerMessageId: "wamid.1",
      profileName: "Lead",
      kind: "text",
    });

    expect(result).toEqual({
      status: "sugerida",
      reply: "Vamos nessa?",
      autoSendAt: "2026-08-18T12:03:00.000Z",
    });
    expect(setPendingSuggestion).toHaveBeenCalledWith("5531999999999", {
      text: "Vamos nessa?",
      paused: false,
    });
    expect(sendText).not.toHaveBeenCalled();
  });

  it("com a IA assumida ainda sugere, mas sem auto-envio", async () => {
    appendInboundMessage.mockResolvedValue(conversation({ agentPaused: true }));
    setPendingSuggestion.mockResolvedValue({
      suggestedAt: "2026-08-18T12:00:00.000Z",
      autoSendAt: "",
    });

    const result = await handleInboundMessage({
      from: "5531999999999",
      text: "tenho interesse",
      providerMessageId: "wamid.1",
      profileName: "Lead",
      kind: "text",
    });

    expect(result).toEqual({
      status: "sugerida",
      reply: "Vamos nessa?",
      autoSendAt: "",
    });
    expect(setPendingSuggestion).toHaveBeenCalledWith("5531999999999", {
      text: "Vamos nessa?",
      paused: true,
    });
    expect(sendText).not.toHaveBeenCalled();
  });

  it("grava opt-out e não sugere", async () => {
    const result = await handleInboundMessage({
      from: "5531999999999",
      text: "parar",
      providerMessageId: "wamid.2",
      profileName: "Lead",
      kind: "text",
    });

    expect(result).toEqual({ status: "opt_out" });
    expect(setContactOptOut).toHaveBeenCalled();
    expect(setPendingSuggestion).not.toHaveBeenCalled();
  });

  it("no clique Pode mandar do v3 envia a resposta pré-moldada na hora", async () => {
    resolveWhatsappConfig.mockResolvedValue({ accessToken: "t", phoneNumberId: "1", graphVersion: "v21.0" });
    sendText.mockResolvedValue({ messageId: "wamid.out" });
    getContactByPhone.mockResolvedValue({
      id: "c1",
      name: "MARIA SILVA",
      optOut: false,
      lastTemplate: "md_intro_feito_candidatas_v3",
      uf: "MG",
      parties: [],
      roles: [],
      candidateRole: "",
      gender: "F",
      isReelection: false,
    });
    appendInboundMessage.mockResolvedValue(
      conversation({
        contactName: "MARIA SILVA",
        messages: [
          { role: "lead", text: "Pode mandar", providerMessageId: "wamid.btn", at: new Date().toISOString() },
        ],
      }),
    );

    const result = await handleInboundMessage({
      from: "5531999999999",
      text: "Pode mandar",
      providerMessageId: "wamid.btn",
      profileName: "Maria",
      kind: "button",
    });

    expect(result.status).toBe("enviada");
    if (result.status === "enviada") {
      expect(result.reply).toContain("Maria, segue o link de degustação");
      expect(result.reply).toContain("https://mandatodigital.ia.br/vozdelas");
    }
    expect(generateAgentReply).not.toHaveBeenCalled();
    expect(setPendingSuggestion).not.toHaveBeenCalled();
    expect(sendText).toHaveBeenCalled();
    expect(appendAgentMessage).toHaveBeenCalled();
  });
});
