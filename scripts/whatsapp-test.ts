/**
 * Teste ponta a ponta do WhatsApp outbound, sem passar pelo painel.
 *
 *   npm run whatsapp:test -- --check
 *       Só valida a configuração (não envia nada).
 *
 *   npm run whatsapp:test -- --agente="tenho interesse, como funciona?"
 *       Roda o agente de IA sobre uma mensagem simulada e imprime a resposta
 *       SEM enviar. Serve para conferir tom e conteúdo antes de falar com gente.
 *
 *   npm run whatsapp:test -- --to=5531992439177 --template=md_intro_vaga_sigla_v1 --params="Gustavo"
 *       Envia um template de verdade para o número informado.
 *
 * Doc: docs/marketing-outbound.md
 */
import fs from "node:fs";
import path from "node:path";

import { generateAgentReply } from "../src/lib/outbound/conversation-agent";
import { classifyPhone } from "../src/lib/outbound/phone";
import type { MarketingConversation } from "../src/lib/outbound/types";
import { resolveWhatsappConfig, sendTemplate } from "../src/lib/outbound/whatsapp";

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    return;
  }
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    if (!line || line.startsWith("#") || !line.includes("=")) {
      continue;
    }
    const separator = line.indexOf("=");
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1).replace(/\\n/g, "\n").replace(/\\"/g, '"');
    }
    if (!String(process.env[key] ?? "").trim()) {
      process.env[key] = value;
    }
  }
}

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((item) => item.startsWith(prefix))?.slice(prefix.length);
}

function checkmark(ok: boolean) {
  return ok ? "ok  " : "FALTA";
}

async function reportConfig() {
  const config = await resolveWhatsappConfig();
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN?.trim() || "";
  const appSecret = process.env.WHATSAPP_APP_SECRET?.trim() || "";
  const baseUrl = process.env.APP_BASE_URL?.trim() || "";
  const demoLink = process.env.WHATSAPP_DEMO_LINK_URL?.trim() || "";

  console.log("Configuração do WhatsApp");
  console.log(`  ${checkmark(Boolean(config))}  WHATSAPP_PHONE_NUMBER_ID + WHATSAPP_ACCESS_TOKEN (enviar)`);
  console.log(`  ${checkmark(Boolean(verifyToken))}  WHATSAPP_VERIFY_TOKEN (handshake do webhook)`);
  console.log(`  ${checkmark(Boolean(appSecret))}  WHATSAPP_APP_SECRET (assinatura do webhook)`);
  console.log(`  ${checkmark(Boolean(baseUrl))}  APP_BASE_URL (URL pública do webhook)`);
  console.log(`  ${demoLink ? "ok  " : "-   "}  WHATSAPP_DEMO_LINK_URL (opcional; sem ele a IA não promete link)`);

  if (baseUrl) {
    console.log("");
    console.log(`  URL do webhook para cadastrar no Meta: ${baseUrl.replace(/\/$/, "")}/api/webhooks/whatsapp`);
  }

  return config;
}

async function runAgent(mensagem: string) {
  const conversa: MarketingConversation = {
    id: "teste",
    contactId: "teste",
    contactName: "Gustavo",
    phoneE164: arg("to") || "5531992439177",
    campaignId: "teste",
    messages: [{ role: "lead", text: mensagem, providerMessageId: "teste", at: new Date().toISOString() }],
    lastInboundAt: new Date().toISOString(),
    agentPaused: false,
    suggestedReply: "",
    suggestedAt: "",
    autoSendAt: "",
    lastError: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  console.log("");
  console.log(`Lead diz: ${mensagem}`);
  console.log("");

  const reply = await generateAgentReply(conversa);
  if (!reply) {
    console.error("A IA não retornou resposta (provider de LLM configurado?).");
    process.exitCode = 1;
    return;
  }

  console.log(`Marina responderia (${reply.provider}/${reply.model}, ${reply.text.length} chars):`);
  console.log("");
  console.log(reply.text);
  console.log("");
  console.log("Nada foi enviado — este modo só imprime.");
}

async function main() {
  loadEnvLocal();

  const config = await reportConfig();

  const mensagemAgente = arg("agente");
  if (mensagemAgente) {
    await runAgent(mensagemAgente);
    return;
  }

  const to = arg("to");
  if (!to) {
    console.log("");
    console.log("Nada enviado. Use --to=<numero> --template=<nome> para disparar, ou --agente=\"...\" para testar a IA.");
    return;
  }

  if (!config) {
    console.error("");
    console.error("Não dá para enviar: faltam credenciais do WhatsApp acima.");
    process.exitCode = 1;
    return;
  }

  const classified = classifyPhone(to);
  if (!classified?.isMobile) {
    console.error(`Número inválido ou não-móvel: ${to}`);
    process.exitCode = 1;
    return;
  }

  const templateName = arg("template") || "md_intro_vaga_sigla_v1";
  const params = (arg("params") || "").split("|").map((p) => p.trim()).filter(Boolean);

  console.log("");
  console.log(`Enviando template "${templateName}" para ${classified.e164}`);
  console.log(`  parâmetros: ${params.length > 0 ? params.join(" | ") : "(nenhum)"}`);

  try {
    const { messageId } = await sendTemplate({
      config,
      to: classified.e164,
      templateName,
      languageCode: arg("lang") || "pt_BR",
      params,
    });
    console.log(`  enviado. message id: ${messageId}`);
    console.log("");
    console.log("Agora responda no WhatsApp. Se o webhook estiver cadastrado no Meta, a IA");
    console.log("responde sozinha e a conversa aparece em /admin/marketing → Conversas.");
  } catch (error) {
    console.error("");
    console.error(`Falha no envio: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
