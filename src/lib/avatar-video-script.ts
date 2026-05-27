import type { PoliticianProfile } from "@/lib/types";

const MAX_TRANSCRIPT_LENGTH = 500;

export function buildAvatarVideoTranscript(input: {
  topic: string;
  profile?: PoliticianProfile | null;
}) {
  const topic = input.topic.trim();
  const profile = input.profile;
  const lines: string[] = [];

  if (profile?.fullName) {
    lines.push(`Eu sou ${profile.fullName}.`);
  }

  if (profile?.role && profile?.city) {
    lines.push(`Atuo como ${profile.role} em ${profile.city}.`);
  }

  lines.push(`Hoje quero falar sobre ${topic}.`);

  if (profile?.spectrum) {
    lines.push(`Meu posicionamento sobre este tema e ${profile.spectrum.toLowerCase()}.`);
  }

  if (profile?.glossaryTerms?.length) {
    lines.push(`Costumo falar de forma natural, usando expressoes como ${profile.glossaryTerms.slice(0, 3).join(", ")}.`);
  }

  lines.push("Vou ser direto, claro e trazer uma mensagem objetiva para voce compartilhar.");

  const transcript = lines.join(" ").replace(/\s+/g, " ").trim();

  if (transcript.length <= MAX_TRANSCRIPT_LENGTH) {
    return transcript;
  }

  return `${transcript.slice(0, MAX_TRANSCRIPT_LENGTH - 3).trim()}...`;
}
