import type { PoliticianProfile } from "@/lib/types";
import { classifyIdeologyLane } from "@/lib/spectrum-ideology";

/** Versao dos prompts de roteiro para video (pipeline contexto + redacao). */
export const AVATAR_VIDEO_PROMPT_VERSION = "video-04.0";

/** Campos coletados no onboarding atual do Curador (video 03). */
export type CuradorVideoContext = {
  topic: string;
  spectrum?: string;
  glossaryTerms?: string[];
  personaArchetypes?: string[];
  voiceTones?: string[];
  avatarType?: string;
  /** Dados de campo do Sentinela — entrada do analista de contexto. */
  sentinelBriefing?: string;
  /** Raio-x politico — saida do analista, entrada do redator (system). */
  politicalContext?: string;
};

export type AvatarVideoPromptInput = {
  topic: string;
  profile?: PoliticianProfile | null;
  curadorContext?: Partial<CuradorVideoContext>;
};

export type AvatarVideoPromptBundle = {
  templateId: "avatar-video-04";
  promptVersion: typeof AVATAR_VIDEO_PROMPT_VERSION;
  system: string;
  user: string;
  context: CuradorVideoContext;
};

const DRAFT_PROFILE_MARKERS = {
  fullName: "Perfil em configuracao",
  role: "Mandato",
  city: "Cidade",
  audience: "Eleitorado local",
} as const;

/** Alinhado ao prompt de redacao (1 minuto de fala). */
export const AVATAR_VIDEO_TARGET_WORDS = 140;

function cleanList(items: string[] | undefined) {
  return (items ?? []).map((item) => item.trim()).filter(Boolean);
}

function isDraftPlaceholder(field: keyof typeof DRAFT_PROFILE_MARKERS, value: string | undefined) {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    return true;
  }

  return trimmed === DRAFT_PROFILE_MARKERS[field];
}

function buildIdeologyInstruction(spectrum: string) {
  const lane = classifyIdeologyLane(spectrum);
  const lines = [
    "A BASE INEGOCIAVEL (O QUE VOCE PENSA E COMO USAR O CONTEXTO):",
    `O candidato tem o posicionamento ideologico de: ${spectrum}. Esta e a sua bussola moral.`,
    'Ao ler o "CONTEXTO ATUAL" acima, voce DEVE absorver os Fatos.',
  ];

  if (lane === "centro") {
    lines.push(
      "Se o seu posicionamento for de Centro, rejeite a polarizacao extrema da Direita e da Esquerda, construindo um roteiro ancorado no pragmatismo, na moderacao e na resolucao do problema apontado no \"Clima Popular\".",
    );
  } else if (lane === "esquerda") {
    lines.push(
      "Se o seu posicionamento for de Esquerda (incluindo posicoes afins no espectro), ignore a narrativa da oposicao de direita e utilize ESTRITAMENTE os argumentos correspondentes a sua ideologia.",
    );
  } else if (lane === "direita") {
    lines.push(
      "Se o seu posicionamento for de Direita (incluindo posicoes afins no espectro), ignore a narrativa da oposicao de esquerda e utilize ESTRITAMENTE os argumentos correspondentes a sua ideologia.",
    );
  } else {
    lines.push(
      "Utilize ESTRITAMENTE os argumentos e medos correspondentes a visao de mundo do candidato.",
    );
  }

  lines.push(
    "Todos os argumentos, dores validadas e solucoes apresentadas no texto DEVEM obrigatoriamente refletir essa visao de mundo, sem excecoes.",
  );

  return lines.join(" ");
}

/**
 * Extrai apenas o que o usuario preencheu no Curador neste onboarding.
 * Ignora defaults de rascunho e dados de outras etapas (Criativo, Sentinela, etc.).
 */
export function pickCuradorVideoContext(
  topic: string,
  profile?: PoliticianProfile | null,
): CuradorVideoContext {
  const context: CuradorVideoContext = {
    topic: topic.trim(),
  };

  const spectrum = profile?.spectrum?.trim();
  if (spectrum) {
    context.spectrum = spectrum;
  }

  const glossaryTerms = cleanList(profile?.glossaryTerms);
  if (glossaryTerms.length) {
    context.glossaryTerms = glossaryTerms;
  }

  const personaArchetypes = cleanList(profile?.personaArchetypes);
  if (personaArchetypes.length) {
    context.personaArchetypes = personaArchetypes;
  }

  const voiceTones = cleanList(profile?.voiceTones);
  if (voiceTones.length) {
    context.voiceTones = voiceTones;
  }

  const avatarType = profile?.avatarType?.trim();
  if (avatarType) {
    context.avatarType = avatarType;
  }

  return context;
}

/** Indica se ha dados de mandato uteis fora do escopo do Curador (nao entram no prompt de video). */
export function hasNonCuradorProfileData(profile?: PoliticianProfile | null) {
  if (!profile) {
    return false;
  }

  return (
    (!isDraftPlaceholder("fullName", profile.fullName) && Boolean(profile.fullName.trim())) ||
    (!isDraftPlaceholder("role", profile.role) && Boolean(profile.role.trim())) ||
    (!isDraftPlaceholder("city", profile.city) && Boolean(profile.city.trim())) ||
    cleanList(profile.keyIssues).length > 0 ||
    cleanList(profile.slogans).length > 0 ||
    Boolean(profile.bio?.trim())
  );
}

function mergeCuradorVideoContext(
  base: CuradorVideoContext,
  override?: Partial<CuradorVideoContext>,
): CuradorVideoContext {
  if (!override) {
    return base;
  }

  return {
    ...base,
    ...override,
    topic: override.topic?.trim() || base.topic,
    politicalContext: override.politicalContext?.trim() || base.politicalContext,
    sentinelBriefing: override.sentinelBriefing?.trim() || base.sentinelBriefing,
  };
}

/**
 * Prompt de redacao (system + user) — etapa 2 do pipeline, com contexto politico no system.
 */
export function buildAvatarVideoPrompt(
  input: AvatarVideoPromptInput,
): AvatarVideoPromptBundle {
  const context = mergeCuradorVideoContext(
    pickCuradorVideoContext(input.topic, input.profile),
    input.curadorContext,
  );

  const systemParts = [
    "Voce e o estrategista chefe e redator principal de um candidato politico.",
    "Sua missao e criar roteiros curtos (maximo 1 minuto) desenhados matematicamente para retencao extrema e alto potencial de viralizacao organica, assumindo a identidade do candidato.",
  ];

  if (context.spectrum) {
    systemParts.push("", buildIdeologyInstruction(context.spectrum));
  }

  if (context.politicalContext?.trim()) {
    systemParts.push(
      "",
      "O CONTEXTO ATUAL (INTELIGENCIA DE CENARIO):",
      "Sua equipe de inteligencia preparou um dossie sobre o que esta acontecendo agora em relacao ao tema do video.",
      "Aqui esta o contexto atual:",
      context.politicalContext.trim(),
    );
  }

  if (context.personaArchetypes?.length || context.voiceTones?.length) {
    systemParts.push(
      "",
      "AS FERRAMENTAS TATICAS (COMO VOCE FALA):",
      "Para a entrega da mensagem, o usuario selecionou:",
    );

    if (context.personaArchetypes?.length) {
      systemParts.push(`Arquetipos: ${context.personaArchetypes.join(", ")}`);
    }

    if (context.voiceTones?.length) {
      systemParts.push(`Tom: ${context.voiceTones.join(", ")}`);
    }

    systemParts.push(
      "Sua Tarefa Estrategica para Viralizar: Analise o Tema do video e decida se a mensagem tera mais impacto (e maior chance de ser compartilhada) focando no Arquetipo ou na emocao do Tom.",
      "Utilize o Tom ou o Arquetipo, somente se a narrativa ficar mais magnetica e persuasiva, sempre ancorada na sua ideologia.",
      "Caso contrario, ignore o Arquetipo e o Tom.",
    );
  }

  systemParts.push("", "DIRETRIZES DE ESTILO E FORMATACAO");

  if (context.glossaryTerms?.length) {
    systemParts.push(
      `Glossario de Expressoes Pessoais: O candidato possui vicios de linguagem que o tornam autentico. Voce DEVE incorporar de forma natural alguma(s) da(s) seguinte(s) expressoes no roteiro: ${context.glossaryTerms.join(", ")}.`,
    );
  } else {
    systemParts.push(
      "Glossario de Expressoes Pessoais: Caso nao contenha expressoes no glossario, ignore esta regra.",
    );
  }

  systemParts.push(
    "Formato: O texto sera lido por um avatar de IA. Escreva APENAS o que sera falado, sem marcacoes de cenario, sem emojis e sem introducoes como \"Aqui esta o roteiro\".",
    "Nao use palavras excessivamente complexas ou rebuscadas; a fala deve soar como um ser humano conversando de frente para a camera.",
    "Pausas: Onde for necessaria uma pausa dramatica para respiracao, insira o simbolo \"...\" (reticencias).",
  );

  const userParts = [
    `Redija um roteiro de video magnetico e direto ao ponto, com duracao maxima de 1 minuto (cerca de ${AVATAR_VIDEO_TARGET_WORDS} palavras).`,
    "O objetivo e gerar imediata concordancia no espectador e faze-lo querer compartilhar o video.",
    "",
    "Parametros do Conteudo:",
    `Tema Central: ${context.topic}`,
  ];

  if (context.glossaryTerms?.length) {
    userParts.push(
      `Palavras Obrigatorias (insira de forma fluida e natural): ${context.glossaryTerms.join(", ")}`,
    );
  }

  userParts.push(
    "",
    "Estrutura de Viralizacao Obrigatoria:",
    "Gancho de 3 segundos: Uma frase inicial provocativa que prenda a atencao imediatamente.",
    "Validacao da Dor: Mostre que voce entende a frustracao ou o anseio do eleitor sobre esse tema gerando o pensamento: \"E exatamente assim que eu me sinto!\"",
    "A Frase de Efeito (Soundbite): O climax da mensagem. Entregue uma opiniao contundente e memoravel. Essa e a frase que motiva o compartilhamento.",
    "CTA Rapido: Um convite curto para quem concorda espalhar a mensagem.",
    "",
    "Entregue ESTRITAMENTE o texto que sera lido pelo avatar. Sem marcacoes de roteiro, sem justificar suas escolhas, sem emojis e direto ao ponto.",
  );

  return {
    templateId: "avatar-video-04",
    promptVersion: AVATAR_VIDEO_PROMPT_VERSION,
    system: systemParts.join("\n"),
    user: userParts.join("\n"),
    context,
  };
}
