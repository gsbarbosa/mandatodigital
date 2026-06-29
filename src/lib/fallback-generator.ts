import type { ContentRequestInput } from "@/lib/schemas";
import type { PoliticianProfile } from "@/lib/types";

type GeneratedVariant = {
  title: string;
  angle: string;
  body: string;
};

const introByIntensity = {
  Cautelosa: [
    "Estou acompanhando esse tema com atencao.",
    "Esse assunto exige seriedade e responsabilidade.",
    "Antes de qualquer conclusao, precisamos olhar os fatos.",
  ],
  Firme: [
    "Não da para tratar esse tema como algo secundario.",
    "Minha posicao sobre isso e objetiva.",
    "Esse debate precisa sair da enrolacao e ir para a pratica.",
  ],
  Confrontadora: [
    "Não vou fingir normalidade diante desse problema.",
    "Chega de discurso bonito sem entrega concreta.",
    "Quem vive a realidade da cidade sabe que isso não da mais para tolerar.",
  ],
} as const;

function pickByIndex(items: readonly string[], index: number) {
  return items[index % items.length];
}

function hashtagsFromProfile(profile: PoliticianProfile) {
  return (profile.keyIssues ?? [])
    .slice(0, 2)
    .map((issue) => `#${issue.replace(/\s+/g, "")}`);
}

function buildBody(
  profile: PoliticianProfile,
  request: ContentRequestInput,
  variantIndex: number,
  angle: string,
) {
  const intro = pickByIndex(introByIntensity[request.intensity], variantIndex);
  const mainIssue = (profile.keyIssues ?? [])[0] ?? "resultado concreto";
  const secondaryIssue =
    (profile.keyIssues ?? [])[1] ?? "respeito com quem mora aqui";
  const signature = (profile.slogans ?? [])[0] ? `${(profile.slogans ?? [])[0]}.` : "";
  const glossaryLead = (profile.glossaryTerms ?? [])[0]
    ? `${(profile.glossaryTerms ?? [])[0]}, `
    : "";
  const mandatoryTerms = (request.mandatoryTerms ?? []).length
    ? `Termos-chave: ${(request.mandatoryTerms ?? []).join(", ")}.`
    : "";
  const cta = request.desiredCallToAction
    ? request.desiredCallToAction
    : "Se esse tema tambem importa para voce, me diga como isso afeta o seu bairro.";

  if (request.format === "Tweet/X") {
    const tweet = `${intro} ${request.topic} pede acao, transparencia e foco em ${mainIssue.toLowerCase()}. Em ${profile.city}, meu compromisso e transformar cobranca em entrega. ${cta}`;
    return tweet.length > 280 ? `${tweet.slice(0, 277)}...` : tweet;
  }

  if (request.format === "Roteiro Reels") {
    return [
      `${glossaryLead}${intro} ${request.topic}.`,
      `Quem mora em ${profile.city} sabe que isso bate direto em ${mainIssue.toLowerCase()} e ${secondaryIssue.toLowerCase()}.`,
      request.context
        ? request.context
        : "A dor real da cidade precisa virar posicionamento claro, não comentario generico.",
      mandatoryTerms,
      `Como ${profile.role}, eu sustento uma resposta ${angle.toLowerCase()}, coerente com ${profile.spectrum.toLowerCase()} e com a identidade do nosso mandato.`,
      signature,
      cta,
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (request.format === "Áudio WhatsApp") {
    return [
      `Oi, gente. Aqui e ${profile.fullName.split(" ")[0]}. ${intro}`,
      `Estou falando sobre ${request.topic.toLowerCase()} porque isso conversa diretamente com ${mainIssue.toLowerCase()} em ${profile.city}.`,
      (request.keyFacts ?? []).length
        ? `O que já sabemos: ${(request.keyFacts ?? []).join("; ")}.`
        : "Ainda há pontos que precisam ser confirmados, mas o impacto local já merece resposta.",
      `Minha linha e ${angle.toLowerCase()}, sem abrir mao de ${secondaryIssue.toLowerCase()}.`,
      cta,
    ].join("\n\n");
  }

  const hashtags = hashtagsFromProfile(profile).join(" ");

  return [
    intro,
    "",
    `${request.topic} não pode ser tratado como mais uma manchete que passa. Em ${profile.city}, esse debate toca diretamente em ${mainIssue.toLowerCase()} e ${secondaryIssue.toLowerCase()}.`,
    request.context
      ? `Meu ponto de partida e simples: ${request.context}`
      : "Meu ponto de partida e simples: resposta publica com clareza, contexto e compromisso com entrega.",
    (request.keyFacts ?? []).length
      ? `Fatos que ajudam a orientar a resposta: ${(request.keyFacts ?? []).join("; ")}.`
      : "Onde ainda faltar confirmacao, o certo e sinalizar isso com transparencia.",
    `Como ${profile.role}, vou sustentar uma abordagem ${angle.toLowerCase()}, coerente com ${profile.spectrum.toLowerCase()} e com a voz que construimos juntos.`,
    signature,
    "",
    cta,
    "",
    hashtags,
  ].join("\n");
}

export function buildFallbackVariants(
  profile: PoliticianProfile,
  request: ContentRequestInput,
  promptPreview: string,
): Array<GeneratedVariant & { promptPreview: string; provider: string }> {
  const angles = [
    "Institucional e segura",
    "Mobilizadora e popular",
    "Incisiva com controle de risco",
  ];

  return angles.map((angle, index) => ({
    title: `Versao ${index + 1} · ${angle}`,
    angle,
    body: buildBody(profile, request, index, angle),
    promptPreview,
    provider: "fallback-local",
  }));
}
