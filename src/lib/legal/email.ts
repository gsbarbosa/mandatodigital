import { Resend } from "resend";

export type ContractEmailAttachment = {
  filename: string;
  content: Buffer;
};

export async function sendContractAcceptanceEmail(input: {
  to: string;
  campaignName: string;
  planName: string;
  acceptanceId: string;
  attachments: ContractEmailAttachment[];
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  const internalCopy = process.env.EMAIL_INTERNAL_COPY?.trim();

  if (!apiKey || !from) {
    return {
      sent: false as const,
      reason: "RESEND_API_KEY ou EMAIL_FROM nao configurados.",
    };
  }

  const resend = new Resend(apiKey);
  const toList = [input.to];
  if (internalCopy) {
    toList.push(internalCopy);
  }

  const { error } = await resend.emails.send({
    from,
    to: toList,
    subject: `Mandato Digital — Contrato e Dossiê (${input.acceptanceId.slice(0, 8)})`,
    text: [
      `Olá, ${input.campaignName}.`,
      "",
      `Segue em anexo o Contrato de Licenciamento e o Dossiê de Transparência referentes ao plano ${input.planName}.`,
      "",
      "A Nota Fiscal será enviada após a liquidação do pagamento (PIX ou boleto).",
      "",
      `Referência do aceite: ${input.acceptanceId}`,
      "",
      "Atenciosamente,",
      "Equipe Mandato Digital / EatEasy",
    ].join("\n"),
    attachments: input.attachments.map((item) => ({
      filename: item.filename,
      content: item.content,
    })),
  });

  if (error) {
    throw new Error(error.message || "Falha ao enviar e-mail transacional.");
  }

  return { sent: true as const };
}
