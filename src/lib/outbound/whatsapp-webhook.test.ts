import crypto from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  isValidSignature,
  normalizeWaId,
  parseWebhookPayload,
} from "@/lib/outbound/whatsapp-webhook";

const SECRET = "segredo-do-app";

function sign(body: string, secret = SECRET) {
  return `sha256=${crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;
}

describe("isValidSignature", () => {
  const rawBody = '{"object":"whatsapp_business_account"}';

  it("aceita assinatura correta", () => {
    expect(
      isValidSignature({ rawBody, signatureHeader: sign(rawBody), appSecret: SECRET }),
    ).toBe(true);
  });

  it("rejeita assinatura de outro segredo", () => {
    expect(
      isValidSignature({
        rawBody,
        signatureHeader: sign(rawBody, "outro-segredo"),
        appSecret: SECRET,
      }),
    ).toBe(false);
  });

  it("rejeita quando o corpo foi adulterado", () => {
    const signature = sign(rawBody);
    expect(
      isValidSignature({ rawBody: `${rawBody} `, signatureHeader: signature, appSecret: SECRET }),
    ).toBe(false);
  });

  it("rejeita header ausente ou segredo vazio", () => {
    expect(isValidSignature({ rawBody, signatureHeader: null, appSecret: SECRET })).toBe(false);
    expect(isValidSignature({ rawBody, signatureHeader: sign(rawBody), appSecret: "" })).toBe(false);
  });

  it("rejeita header de tamanho diferente sem estourar", () => {
    expect(isValidSignature({ rawBody, signatureHeader: "sha256=abc", appSecret: SECRET })).toBe(
      false,
    );
  });
});

describe("parseWebhookPayload", () => {
  it("extrai mensagem de texto com nome do perfil", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                contacts: [{ wa_id: "5531992439177", profile: { name: "Gustavo" } }],
                messages: [
                  {
                    from: "5531992439177",
                    id: "wamid.ABC",
                    type: "text",
                    text: { body: "  tenho interesse  " },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const { messages } = parseWebhookPayload(payload);
    expect(messages).toEqual([
      {
        from: "5531992439177",
        text: "tenho interesse",
        providerMessageId: "wamid.ABC",
        profileName: "Gustavo",
        kind: "text",
      },
    ]);
  });

  it("extrai resposta de botão interativo", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    from: "5511999999999",
                    id: "wamid.BTN",
                    type: "interactive",
                    interactive: { button_reply: { title: "Quero ver" } },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    expect(parseWebhookPayload(payload).messages[0]?.text).toBe("Quero ver");
    expect(parseWebhookPayload(payload).messages[0]?.kind).toBe("interactive");
  });

  it("marca clique de botão de template", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    from: "5511999999999",
                    id: "wamid.TPL",
                    type: "button",
                    button: { text: "Sim. Seja breve", payload: "sim" },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    expect(parseWebhookPayload(payload).messages[0]).toMatchObject({
      text: "Sim. Seja breve",
      kind: "button",
    });
  });

  it("separa status de entrega das mensagens", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                statuses: [
                  { id: "wamid.XYZ", status: "delivered", recipient_id: "5531992439177" },
                ],
              },
            },
          ],
        },
      ],
    };

    const { messages, statuses } = parseWebhookPayload(payload);
    expect(messages).toHaveLength(0);
    expect(statuses).toEqual([
      { providerMessageId: "wamid.XYZ", status: "delivered", recipient: "5531992439177" },
    ]);
  });

  it("não quebra com payload vazio ou inesperado", () => {
    expect(parseWebhookPayload(null)).toEqual({ messages: [], statuses: [] });
    expect(parseWebhookPayload({})).toEqual({ messages: [], statuses: [] });
    expect(parseWebhookPayload({ entry: [{}] })).toEqual({ messages: [], statuses: [] });
  });

  it("mantém mensagem sem texto (áudio/imagem) para atendimento humano", () => {
    const payload = {
      entry: [
        { changes: [{ value: { messages: [{ from: "5511999999999", id: "wamid.AUD", type: "audio" }] } }] },
      ],
    };
    expect(parseWebhookPayload(payload).messages[0]).toMatchObject({
      providerMessageId: "wamid.AUD",
      text: "",
      kind: "media",
    });
  });
});

describe("normalizeWaId", () => {
  it("mantém celular brasileiro completo", () => {
    expect(normalizeWaId("5531992439177")).toBe("5531992439177");
  });

  it("acrescenta o 9º dígito quando a Meta envia sem ele", () => {
    expect(normalizeWaId("553192439177")).toBe("5531992439177");
  });

  it("descarta formatação", () => {
    expect(normalizeWaId("+55 (31) 99243-9177")).toBe("5531992439177");
  });

  it("deixa número estrangeiro intacto", () => {
    expect(normalizeWaId("14155552671")).toBe("14155552671");
  });
});
