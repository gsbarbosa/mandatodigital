import type { ContentRequestInput, ProfileInput } from "@/lib/schemas";
import type { PoliticianProfile } from "@/lib/types";

type PromptBundle = {
  system: string;
  user: string;
  preview: string;
};

function joinList(items: string[]) {
  return items.length ? items.join(", ") : "nao informado";
}

export function buildGenerationPrompt(
  profile: PoliticianProfile | ProfileInput,
  request: ContentRequestInput,
): PromptBundle {
  const system = [
    "Voce e o motor editorial do Mandato Digital.",
    "Escreva como um estrategista de comunicacao politica com foco em clareza, velocidade e aderencia a persona.",
    "Nunca invente fatos. Se uma informacao nao estiver no contexto, trate como ponto a confirmar.",
    "Responda em JSON valido com a chave versions.",
    "Cada item de versions deve conter title, angle e body.",
    "Gere exatamente 3 versoes distintas, ja prontas para uso com revisao humana leve.",
  ].join(" ");

  const user = [
    "Perfil do parlamentar:",
    `Nome: ${profile.fullName}`,
    `Cargo: ${profile.role}`,
    `Base geografica: ${profile.city}/${profile.state}`,
    `Publico principal: ${profile.audience}`,
    `Espectro: ${profile.spectrum}`,
    `Arquetipo: ${profile.archetype}`,
    `Tons de voz: ${joinList(profile.voiceTones)}`,
    `Pautas prioritarias: ${joinList(profile.keyIssues)}`,
    `Bordoes e assinaturas: ${joinList(profile.slogans)}`,
    `Linhas vermelhas: ${joinList(profile.redLines)}`,
    `Exemplos de fala: ${joinList(profile.referenceExamples)}`,
    `Resumo de identidade: ${profile.bio}`,
    "",
    "Pedido editorial:",
    `Topico: ${request.topic}`,
    `Objetivo: ${request.objective}`,
    `Formato: ${request.format}`,
    `Intensidade: ${request.intensity}`,
    `Contexto adicional: ${request.context || "nao informado"}`,
    `Fatos que podem ser usados: ${joinList(request.keyFacts)}`,
    `CTA desejado: ${request.desiredCallToAction || "nao informado"}`,
    "",
    "Regras de saida:",
    "1. A versao 1 deve ser a mais segura e institucional.",
    "2. A versao 2 deve ser a mais mobilizadora e popular.",
    "3. A versao 3 deve ser a mais incisiva, sem ultrapassar as linhas vermelhas.",
    "4. Se o formato for Tweet/X, respeite 280 caracteres.",
    "5. Se o formato for Roteiro Reels, entregue o texto em blocos curtos com gancho, desenvolvimento e fechamento.",
    "6. Se o formato for Audio WhatsApp, escreva em tom oral.",
    "7. Cite temas a confirmar quando faltar evidenca concreta.",
  ].join("\n");

  const preview = [
    `${profile.fullName} | ${profile.role} | ${profile.city}/${profile.state}`,
    `${profile.spectrum} | ${profile.archetype} | tons: ${joinList(profile.voiceTones)}`,
    `Pautas: ${joinList(profile.keyIssues)}`,
    `Pedido: ${request.format} sobre "${request.topic}" com objetivo "${request.objective}"`,
  ].join("\n");

  return { system, user, preview };
}
