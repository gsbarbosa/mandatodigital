import { describe, expect, it } from "vitest";

import { isConversationRole } from "@/lib/outbound/types";
import { conversationReplySchema } from "@/lib/outbound/schemas";

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

describe("conversationReplySchema", () => {
  it("recusa vazio e corta espaço", () => {
    expect(conversationReplySchema.safeParse({ text: "   " }).success).toBe(false);
    expect(conversationReplySchema.parse({ text: "  olá  " }).text).toBe("olá");
  });
});
