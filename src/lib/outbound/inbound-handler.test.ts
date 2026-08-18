import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleInboundMessage } from "@/lib/outbound/inbound-handler";
import type { MarketingConversation } from "@/lib/outbound/types";

const appendInboundMessage = vi.fn();
const setPendingSuggestion = vi.fn();
const setConversationError = vi.fn();
const generateAgentReply = vi.fn();
const sendText = vi.fn();

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
  setPendingSuggestion: (...args: unknown[]) => setPendingSuggestion(...args),
  setConversationError: (...args: unknown[]) => setConversationError(...args),
}));

vi.mock("@/lib/outbound/conversation-agent", () => ({
  generateAgentReply: (...args: unknown[]) => generateAgentReply(...args),
}));

vi.mock("@/lib/outbound/whatsapp", () => ({
  sendText: (...args: unknown[]) => sendText(...args),
  resolveWhatsappConfig: vi.fn(),
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
});
