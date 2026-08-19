import { archetypeOptions, voiceToneOptions } from "@/lib/constants";

/**
 * Roteiro falado no trial (ex-degustação / DEMO_MODE).
 * Sem LLM: só flavor de tom/arquétipo na abertura e no fechamento.
 */

export type TrialAvatarScriptKind = "gemeo" | "caricato" | "mascote3d";

const TRIAL_AVATAR_SCRIPT_LABEL: Record<TrialAvatarScriptKind, string> = {
  gemeo: "gêmeo digital",
  caricato: "caricato",
  mascote3d: "mascote 3D",
};

type ArchetypeOption = (typeof archetypeOptions)[number];
type VoiceToneOption = (typeof voiceToneOptions)[number];

const TRIAL_TONE_OPENERS: Record<VoiceToneOption, string> = {
  Academico: "Prezado(a),",
  Popular: "E aí, tudo certo?",
  Indignado: "Chega de esperar.",
  Conciliador: "Que bom te ver por aqui.",
  Institucional: "Boa tarde.",
  "Tecnico/Exito": "Vamos direto ao resultado.",
  Didatico: "Vou te explicar rapidinho.",
  Patriotico: "Pelo nosso Brasil,",
  Agressivo: "Sem rodeios.",
  Sofisticado: "É um prazer.",
  Otimista: "Que alegria estar aqui!",
  "Paternal/Maternal": "Vem cá, deixa eu te mostrar uma coisa.",
  "Sarcastico/Ironico": "Ah, finalmente chegou a hora.",
  Motivacional: "Bora com tudo!",
  Denuncista: "Presta atenção nisso.",
  Humoristico: "Opa, chegou a diversão!",
};

const TRIAL_ARCHETYPE_CLOSERS: Record<ArchetypeOption, string> = {
  "O Estadista (Serio, Longo prazo)":
    "Como estadista, penso sempre no que constrói o futuro do nosso mandato.",
  "Homem do Povo (Empatia)":
    "Porque, no fim das contas, tudo isso é para te ouvir e representar de verdade.",
  "O Xerife/Justiceiro (Ordem)": "E ordem se constrói com presença e transparência, todos os dias.",
  "O Missionario (Moral/Costumes)": "Tudo isso a serviço dos valores que defendemos juntos.",
  "O Gestor/CEO (Eficiencia)": "Eficiência é isso: tecnologia trabalhando para o seu mandato.",
  "O Militante (Mobilizador)": "E é assim que a gente mobiliza: mandato forte se constrói junto.",
  "O Professor (Didatico)": "E, como sempre, o segredo está em explicar bem, passo a passo.",
  "O Conciliador (Uniao/Pontes)": "Tudo pensado para unir, dialogar e construir pontes.",
  "Agro/Regionalista (Interior)": "Tecnologia de ponta, com os pés fincados na nossa terra.",
  "O Inovador/Digital (Tech)": "É inovação de verdade, chegando primeiro no seu mandato.",
};

export function trialAvatarScriptKindFromProduction(input: {
  generateMode: "avatar" | "caricature" | "photo_real";
  caricatureVariant?: string | null;
}): TrialAvatarScriptKind {
  if (input.generateMode === "caricature") {
    if (input.caricatureVariant === "mascot_3d" || input.caricatureVariant === "mascote3d") {
      return "mascote3d";
    }
    return "caricato";
  }
  return "gemeo";
}

export function trialFixedAvatarScript(
  kind: TrialAvatarScriptKind = "gemeo",
  style?: { archetype?: string; tone?: string },
): string {
  const label = TRIAL_AVATAR_SCRIPT_LABEL[kind];
  const opener = TRIAL_TONE_OPENERS[style?.tone as VoiceToneOption] ?? "Olá.";
  const closer = TRIAL_ARCHETYPE_CLOSERS[style?.archetype as ArchetypeOption];

  return (
    `${opener} Eu sou o seu ${label}. Nessa versão de teste o objetivo é conhecer o resultado visual do seu avatar treinado. ` +
    "Se não está soando exatamente como você, basta fazer um novo upload da sua voz. " +
    "Aproveito para dizer que além dos avatares, monitoramos os temas da sua região, geramos pautas automatizadas, " +
    "publicações em 7 redes sociais e tudo em conformidade com as resoluções atuais do TSE." +
    (closer ? ` ${closer}` : "")
  );
}

export function spokenTranscriptForAccount(input: {
  guestQuotas: boolean;
  generateMode: "avatar" | "caricature" | "photo_real";
  caricatureVariant?: string | null;
  requestedTranscript: string;
  archetype?: string | null;
  tone?: string | null;
}): { transcript: string; usedTrialFixedScript: boolean } {
  if (!input.guestQuotas) {
    return { transcript: input.requestedTranscript, usedTrialFixedScript: false };
  }
  return {
    transcript: trialFixedAvatarScript(
      trialAvatarScriptKindFromProduction({
        generateMode: input.generateMode,
        caricatureVariant: input.caricatureVariant,
      }),
      {
        archetype: input.archetype?.trim() || undefined,
        tone: input.tone?.trim() || undefined,
      },
    ),
    usedTrialFixedScript: true,
  };
}

export const TRIAL_GENERATE_AVATAR_TITLE = "Vídeo de demonstração";

export const TRIAL_GENERATE_AVATAR_BODY =
  "No trial o vídeo serve para você ver o resultado do seu avatar. " +
  "Nos planos pagos, o roteiro aprovado é o que o avatar fala de fato. " +
  "Aviso: nessa versão, o avatar lê um texto padrão.";

export const TRIAL_GENERATE_AVATAR_CTA = "Gerar vídeo de demonstração";

export const TRIAL_GENERATE_AVATAR_CANCEL = "Cancelar";
