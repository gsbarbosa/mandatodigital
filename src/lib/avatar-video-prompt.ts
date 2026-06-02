import type { PoliticianProfile } from "@/lib/types";

/** Versao dos prompts de roteiro para video (Instrucoes_Back__end_video_03). */
export const AVATAR_VIDEO_PROMPT_VERSION = "video-03.2";

/** Campos coletados no onboarding atual do Curador (video 03). */
export type CuradorVideoContext = {
  topic: string;
  spectrum?: string;
  glossaryTerms?: string[];
  personaArchetypes?: string[];
  voiceTones?: string[];
  avatarType?: string;
};

export type AvatarVideoPromptInput = {
  topic: string;
  profile?: PoliticianProfile | null;
};

export type AvatarVideoPromptBundle = {
  templateId: "avatar-video-03";
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

/**
 * Prompt pai (system + user) do video 03, usando somente contexto do Curador.
 */
export function buildAvatarVideoPrompt(
  input: AvatarVideoPromptInput,
): AvatarVideoPromptBundle {
  const context = pickCuradorVideoContext(input.topic, input.profile);
  const systemParts = [
    "Voce e o estrategista chefe e redator principal de um candidato politico.",
    "Sua missao e criar roteiros curtos (maximo 1 minuto) desenhados matematicamente para retencao extrema e alto potencial de viralizacao organica, assumindo a identidade do candidato.",
  ];

  if (context.spectrum) {
    systemParts.push(
      "",
      "A BASE INEGOCIAVEL (O QUE VOCE PENSA):",
      `O candidato tem o posicionamento ideologico de: ${context.spectrum}.`,
      "Esta e a sua bussola moral. Todos os argumentos, dores validadas e solucoes apresentadas no texto DEVEM obrigatoriamente refletir a visao de mundo e os valores desta ideologia politica, sem excecoes.",
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
      "Sua Tarefa Estrategica para Viralizar: Analise o Tema do video e decida se a mensagem tera mais impacto focando no Arquetipo ou na emocao do Tom.",
      "Utilize Tom ou Arquetipo somente se a narrativa ficar mais magnetica e persuasiva",
      context.spectrum
        ? ", sempre ancorada na ideologia informada. Caso contrario, ignore Arquetipo e Tom."
        : ". Caso contrario, ignore Arquetipo e Tom.",
    );
  }

  if (context.avatarType) {
    systemParts.push("", `Tipo de avatar escolhido: ${context.avatarType}.`);
  }

  systemParts.push(
    "",
    "DIRETRIZES DE ESTILO E FORMATACAO",
  );

  if (context.glossaryTerms?.length) {
    systemParts.push(
      `Glossario de Expressoes Pessoais (OBRIGATORIO — use SOMENTE desta lista, nao invente bordoes nem reutilize expressoes de exemplos anteriores): ${context.glossaryTerms.join(", ")}.`,
    );
  }

  systemParts.push(
    "Formato: O texto sera lido por um avatar de IA. Escreva APENAS o que sera falado, sem marcacoes de cenario, sem emojis e sem introducoes como \"Aqui esta o roteiro\".",
    "Nao use palavras excessivamente complexas ou rebuscadas; a fala deve soar como um ser humano conversando de frente para a camera.",
    "Pausas: Onde for necessaria uma pausa dramatica para respiracao, insira o simbolo \"...\" (reticencias).",
  );

  const userParts = [
    "Redija um roteiro de video magnetico e direto ao ponto, com duracao maxima de 1 minuto (cerca de 140 palavras).",
    "O objetivo e gerar imediata concordancia no espectador e faze-lo querer compartilhar o video.",
    "",
    "Parametros do Conteudo:",
    `Tema Central: ${context.topic}`,
  ];

  if (context.glossaryTerms?.length) {
    userParts.push(
      `Palavras Obrigatorias (insira de forma fluida e natural; use APENAS estas, sem sinonimos nem expressoes fora da lista): ${context.glossaryTerms.join(", ")}`,
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
    templateId: "avatar-video-03",
    promptVersion: AVATAR_VIDEO_PROMPT_VERSION,
    system: systemParts.join("\n"),
    user: userParts.join("\n"),
    context,
  };
}
