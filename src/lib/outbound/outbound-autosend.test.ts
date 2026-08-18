import { beforeEach, describe, expect, it, vi } from "vitest";

import { flushDueSuggestedReplies } from "@/lib/outbound/outbound-autosend";
import type { MarketingConversation } from "@/lib/outbound/types";

const listConversations = vi.fn();
const claimDueSuggestion = vi.fn();
const restoreSuggestion = vi.fn();
const appendAgentMessage = vi.fn();
const setConversationError = vi.fn();
const resolveWhatsappConfig = vi.fn();
const sendText = vi.fn();

vi.mock("@/lib/observability/log", () => ({
  appLog: vi.fn(),
  appLogError: vi.fn(),
}));

vi.mock("@/lib/outbound/conversations-storage", () => ({
  listConversations: (...args: unknown[]) => listConversations(...args),
  claimDueSuggestion: (...args: unknown[]) => claimDueSuggestion(...args),
  restoreSuggestion: (...args: unknown[]) => restoreSuggestion(...args),
  appendAgentMessage: (...args: unknown[]) => appendAgentMessage(...args),
  setConversationError: (...args: unknown[]) => setConversationError(...args),
}));

vi.mock("@/lib/outbound/whatsapp", () => ({
  resolveWhatsappConfig: (...args: unknown[]) => resolveWhatsappConfig(...args),
  sendText: (...args: unknown[]) => sendText(...args),
}));

function conversation(overrides: Partial<MarketingConversation> = {}): MarketingConversation {
  const now = "2026-08-18T12:00:00.000Z";
  return {
    id: "5531999999999",
    contactId: "c1",
    contactName: "Lead",
    phoneE164: "5531999999999",
    campaignId: "",
    messages: [{ role: "lead", text: "oi", providerMessageId: "wamid.1", at: now }],
    lastInboundAt: now,
    agentPaused: false,
    suggestedReply: "Vamos nessa?",
    suggestedAt: now,
    autoSendAt: "2026-08-18T12:03:00.000Z",
    lastError: "",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const NOW = Date.parse("2026-08-18T12:03:01.000Z");

describe("flushDueSuggestedReplies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveWhatsappConfig.mockResolvedValue({ token: "x", phoneNumberId: "1" });
    claimDueSuggestion.mockResolvedValue({
      text: "Vamos nessa?",
      suggestedAt: "2026-08-18T12:00:00.000Z",
      autoSendAt: "2026-08-18T12:03:00.000Z",
    });
    sendText.mockResolvedValue({ messageId: "wamid.out" });
  });

  it("envia a sugestão vencida como Marina", async () => {
    listConversations.mockResolvedValue([conversation()]);

    const result = await flushDueSuggestedReplies(NOW);

    expect(result).toEqual({ examined: 1, sent: 1, skipped: 0, failed: 0 });
    expect(sendText).toHaveBeenCalledWith(
      expect.objectContaining({ to: "5531999999999", body: "Vamos nessa?" }),
    );
    expect(appendAgentMessage).toHaveBeenCalledWith({
      phoneE164: "5531999999999",
      text: "Vamos nessa?",
      providerMessageId: "wamid.out",
    });
  });

  it("não envia thread assumida mesmo com prazo vencido", async () => {
    listConversations.mockResolvedValue([conversation({ agentPaused: true })]);

    const result = await flushDueSuggestedReplies(NOW);

    expect(result.examined).toBe(0);
    expect(sendText).not.toHaveBeenCalled();
    expect(claimDueSuggestion).not.toHaveBeenCalled();
  });

  it("devolve a sugestão na fila se o envio falhar", async () => {
    listConversations.mockResolvedValue([conversation()]);
    sendText.mockRejectedValue(new Error("Meta 500"));

    const result = await flushDueSuggestedReplies(NOW);

    expect(result.failed).toBe(1);
    expect(restoreSuggestion).toHaveBeenCalledWith(
      "5531999999999",
      expect.objectContaining({ text: "Vamos nessa?" }),
    );
    expect(appendAgentMessage).not.toHaveBeenCalled();
  });
});
