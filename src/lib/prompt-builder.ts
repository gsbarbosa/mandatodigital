import { createHash } from "node:crypto";

import type { ContentRequestInput, ProfileInput } from "@/lib/schemas";
import type { PoliticianProfile, PromptTemplateMetadata } from "@/lib/types";

export const GENERATION_PROMPT_TEMPLATE_ID = "core-politico";
export const GENERATION_PROMPT_VERSION = "2026-05-26.2";

type PromptBundle = PromptTemplateMetadata & {
  system: string;
  user: string;
  fingerprint: string;
};

type BuildGenerationPromptOptions = {
  templateId?: string;
  promptVersion?: string;
  systemAddendum?: string;
  userAddendum?: string;
};

function joinList(items?: string[] | null) {
  const list = items ?? [];
  return list.length ? list.join(", ") : "não informado";
}

export function buildGenerationPrompt(
  profile: PoliticianProfile | ProfileInput,
  request: ContentRequestInput,
  options?: BuildGenerationPromptOptions,
): PromptBundle {
  const system = [
    "Você e o estrategista chefe e redator principal de um mandato político.",
    "Sua missao e criar roteiros curtos com alto potencial de retencao, concordancia imediata e compartilhamento organico.",
    "A base inegociavel e a identidade política do candidato: ideologia, red lines, pautas, glossario e contexto local.",
    "Arquetipo e tom sao ferramentas taticas: use apenas quando deixarem a mensagem mais magnetica, sem trair a identidade principal.",
    "Nunca invente fatos. Se uma informação não estiver no contexto, trate como ponto a confirmar.",
    "Escreva apenas o que pode ser falado em frente a camera, com oralidade natural, sem emojis e sem marcacoes tecnicas na resposta final.",
    "Responda em JSON válido com a chave versions.",
    "Cada item de versions deve conter title, angle e body.",
    "Gere exatamente 3 versões distintas, já prontas para uso com revisao humana leve.",
    options?.systemAddendum?.trim() || "",
  ]
    .filter(Boolean)
    .join(" ");

  const user = [
    "Perfil do parlamentar:",
    `Nome: ${profile.fullName}`,
    `Cargo: ${profile.role}`,
    `Base geografica: ${profile.city}/${profile.state}`,
    `Publico principal: ${profile.audience}`,
    `Posicionamento ideologico: ${profile.spectrum}`,
    `Arquetipo principal: ${profile.archetype}`,
    `Arquetipos auxiliares: ${joinList(profile.personaArchetypes)}`,
    `Tons de voz: ${joinList(profile.voiceTones)}`,
    `Pautas prioritarias: ${joinList(profile.keyIssues)}`,
    `Bordoes e assinaturas: ${joinList(profile.slogans)}`,
    `Glossário pessoal: ${joinList(profile.glossaryTerms)}`,
    `Linhas vermelhas: ${joinList(profile.redLines)}`,
    `Exemplos de fala: ${joinList(profile.referenceExamples)}`,
    `Resumo de identidade: ${profile.bio}`,
    `Radar de temas priorizados: ${joinList(profile.sentinelThemes)}`,
    `Radar de oposicao: ${joinList(profile.oppositionThemes)}`,
    `Emoção do avatar: ${joinList(profile.avatarEmotions)}`,
    `Tipo de avatar: ${profile.avatarType || "não informado"}`,
    `Velocidade de voz: ${profile.voicePace}`,
    `Estilos de edição preferidos: ${joinList(profile.editingStyles)}`,
    "",
    "Pedido editorial:",
    `Topico: ${request.topic}`,
    `Objetivo: ${request.objective}`,
    `Formato: ${request.format}`,
    `Intensidade: ${request.intensity}`,
    `Contexto adicional: ${request.context || "não informado"}`,
    `Fatos que podem ser usados: ${joinList(request.keyFacts)}`,
    `CTA desejado: ${request.desiredCallToAction || "não informado"}`,
    `Palavras obrigatórias: ${joinList(request.mandatoryTerms)}`,
    "",
    "Regras de saida:",
    "1. A versão 1 deve ser a mais segura e institucional.",
    "2. A versão 2 deve ser a mais popular, emocional e compartilhavel.",
    "3. A versão 3 deve ser a mais incisiva, sem ultrapassar as linhas vermelhas.",
    "4. Toda versão deve conter gancho inicial, validacao da dor, frase de efeito e CTA rapido.",
    "5. Se o formato for Tweet/X, respeite 280 caracteres.",
    "6. Se o formato for Roteiro Reels, entregue um roteiro de video curto com oralidade natural e ate cerca de 140 palavras.",
    "7. Se o formato for Áudio WhatsApp, escreva em tom oral.",
    "8. Incorpore glossario e palavras obrigatórias de forma fluida quando fizer sentido.",
    "9. Cite temas a confirmar quando faltar evidenca concreta.",
    options?.userAddendum?.trim() || "",
  ]
    .filter(Boolean)
    .join("\n");

  const preview = [
    `${profile.fullName} | ${profile.role} | ${profile.city}/${profile.state}`,
    `${profile.spectrum} | ${profile.archetype} | tons: ${joinList(profile.voiceTones)}`,
    `Pautas: ${joinList(profile.keyIssues)}`,
    `Pedido: ${request.format} sobre "${request.topic}" com objetivo "${request.objective}"`,
  ].join("\n");

  const templateId = options?.templateId?.trim() || GENERATION_PROMPT_TEMPLATE_ID;
  const promptVersion =
    options?.promptVersion?.trim() || GENERATION_PROMPT_VERSION;
  const fingerprint = createHash("sha256")
    .update(`${templateId}\n${promptVersion}\n${system}\n${user}`)
    .digest("hex");

  return {
    system,
    user,
    preview,
    templateId,
    promptVersion,
    fingerprint,
  };
}
