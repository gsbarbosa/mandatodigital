import { describe, expect, it } from "vitest";

import { conversationReplySchema } from "@/lib/outbound/schemas";
import {
  computeSuggestionAutoSendAt,
  isConversationRole,
  isSuggestionAutoSendDue,
} from "@/lib/outbound/types";

describe("isConversationRole", () => {
  it("aceita os três papéis da thread", () => {
    expect(isConversationRole("lead")).toBe(true);
    expect(isConversationRole("agente")).toBe(true);
    expect(isConversationRole("humano")).toBe(true);
  });

  it("rejeita valor desconhecido — vira lead no mapDoc", () => {
    expect(isConversationRole("operador")).toBe(false);
    expect(isConversationRole("")).toBe(false);
  });
});

describe("computeSuggestionAutoSendAt", () => {
  it("agenda 3 minutos quando a IA não está assumida", () => {
    const now = Date.parse("2026-08-18T12:00:00.000Z");
    expect(computeSuggestionAutoSendAt(false, now)).toBe("2026-08-18T12:03:00.000Z");
  });

  it("não agenda quando a IA está assumida", () => {
    expect(computeSuggestionAutoSendAt(true, Date.parse("2026-08-18T12:00:00.000Z"))).toBe("");
  });
});

describe("isSuggestionAutoSendDue", () => {
  const base = {
    suggestedReply: "Oi, vamos conversar?",
    autoSendAt: "2026-08-18T12:03:00.000Z",
    agentPaused: false,
  };
  const now = Date.parse("2026-08-18T12:03:01.000Z");

  it("venceu e a IA não está assumida — deve enviar", () => {
    expect(isSuggestionAutoSendDue(base, now)).toBe(true);
  });

  it("nunca envia se a thread foi assumida", () => {
    expect(isSuggestionAutoSendDue({ ...base, agentPaused: true }, now)).toBe(false);
  });

  it("não envia se o prazo ainda não chegou", () => {
    expect(isSuggestionAutoSendDue(base, Date.parse("2026-08-18T12:02:59.000Z"))).toBe(false);
  });

  it("não envia sem texto de sugestão", () => {
    expect(isSuggestionAutoSendDue({ ...base, suggestedReply: "  " }, now)).toBe(false);
  });
});

describe("conversationReplySchema", () => {
  it("recusa vazio e corta espaço", () => {
    expect(conversationReplySchema.safeParse({ text: "   " }).success).toBe(false);
    expect(conversationReplySchema.parse({ text: "  olá  " }).text).toBe("olá");
  });
});
