import { Resend } from "resend";

export type ContractEmailAttachment = {
  filename: string;
  content: Buffer;
};

async function resolveResendClient() {
  let apiKey = process.env.RESEND_API_KEY?.trim() || "";
  try {
    const { resolveProviderApiKey } = await import("@/lib/admin/provider-secrets");
    const resolved = await resolveProviderApiKey("resend");
    if (resolved.token) {
      apiKey = resolved.token;
    }
  } catch {
    // Firestore indisponível — usa env.
  }
  const from = process.env.EMAIL_FROM?.trim();
  const internalCopy = process.env.EMAIL_INTERNAL_COPY?.trim();

  if (!apiKey || !from) {
    return null;
  }

  return {
    resend: new Resend(apiKey),
    from,
    internalCopy: internalCopy || null,
  };
}

export async function sendContractAcceptanceEmail(input: {
  to: string;
  campaignName: string;
  planName: string;
  acceptanceId: string;
  attachments: ContractEmailAttachment[];
}) {
  const client = await resolveResendClient();
  if (!client) {
    return {
      sent: false as const,
      reason: "RESEND_API_KEY ou EMAIL_FROM nao configurados.",
    };
  }

  const toList = [input.to];
  if (client.internalCopy) {
    toList.push(client.internalCopy);
  }

  const { error } = await client.resend.emails.send({
    from: client.from,
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

export async function sendNfsAuthorizedEmail(input: {
  to: string;
  campaignName: string;
  nfsNumber: string | null;
  pdfUrl: string;
  xmlUrl?: string | null;
}) {
  const client = await resolveResendClient();
  if (!client) {
    return {
      sent: false as const,
      reason: "RESEND_API_KEY ou EMAIL_FROM nao configurados.",
    };
  }

  const attachments: ContractEmailAttachment[] = [];
  const numberSlug = (input.nfsNumber || "nfs").replace(/[^\w.-]+/g, "_");

  try {
    const pdfResponse = await fetch(input.pdfUrl, { cache: "no-store" });
    if (pdfResponse.ok) {
      attachments.push({
        filename: `nota-fiscal-${numberSlug}.pdf`,
        content: Buffer.from(await pdfResponse.arrayBuffer()),
      });
    }
  } catch {
    // Segue com link se download falhar.
  }

  if (input.xmlUrl) {
    try {
      const xmlResponse = await fetch(input.xmlUrl, { cache: "no-store" });
      if (xmlResponse.ok) {
        attachments.push({
          filename: `nota-fiscal-${numberSlug}.xml`,
          content: Buffer.from(await xmlResponse.arrayBuffer()),
        });
      }
    } catch {
      // opcional
    }
  }

  const toList = [input.to];
  if (client.internalCopy) {
    toList.push(client.internalCopy);
  }

  const nfsLabel = input.nfsNumber?.trim() || "autorizada";
  const { error } = await client.resend.emails.send({
    from: client.from,
    to: toList,
    subject: `Mandato Digital — Nota Fiscal (${nfsLabel})`,
    text: [
      `Olá, ${input.campaignName}.`,
      "",
      "Segue a Nota Fiscal de Serviço referente à liquidação do pagamento.",
      input.nfsNumber ? `Número: ${input.nfsNumber}` : null,
      "",
      attachments.length ? "O PDF está em anexo." : `PDF: ${input.pdfUrl}`,
      input.xmlUrl && !attachments.some((a) => a.filename.endsWith(".xml"))
        ? `XML: ${input.xmlUrl}`
        : null,
      "",
      "Atenciosamente,",
      "Equipe Mandato Digital / EatEasy",
    ]
      .filter((line): line is string => line != null)
      .join("\n"),
    attachments: attachments.map((item) => ({
      filename: item.filename,
      content: item.content,
    })),
  });

  if (error) {
    throw new Error(error.message || "Falha ao enviar e-mail da Nota Fiscal.");
  }

  return { sent: true as const };
}
