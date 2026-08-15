/**
 * Filtro de relevância das manchetes cruas — exclui esporte, fofoca/entretenimento
 * e loteria/horóscopo, que não têm correlação com o cenário político, econômico e
 * social do Brasil (o interesse de quem usa a plataforma).
 *
 * Heurística por frase (não palavra solta): nomes de time/cidade (ex.: "Bahia",
 * "Fortaleza", "Santos") também são nomes de estado/município usados em notícia
 * política legítima, então as frases abaixo exigem contexto específico de esporte
 * pra não derrubar cobertura estadual/municipal real. Isso é um heurístico simples
 * (sem LLM, mantendo o mecanismo desta tela isolado) — não pega 100% dos casos
 * (ex.: uma notícia de Justiça que cita um clube de futebol no título passa).
 */
const EXCLUDED_PHRASES = [
  // esporte
  "futebol",
  "campeonato brasileiro",
  "brasileirão",
  "libertadores",
  "copa do brasil",
  "copa américa",
  "champions league",
  "premier league",
  "seleção brasileira",
  "seleção masculina",
  "seleção feminina",
  "gol de",
  "marcou o gol",
  "pênalti",
  "pênaltis",
  "escanteio",
  "var confirma",
  "artilheiro",
  "goleiro",
  "zagueiro",
  "lateral-direito",
  "lateral-esquerdo",
  "meia-atacante",
  "técnico demitido",
  "técnico do time",
  "clássico entre",
  "final da copa",
  "estreia da seleção",
  "convocação da seleção",
  "contratação do clube",
  "mercado da bola",
  "janela de transferências",
  "hat-trick",
  "basquete",
  "vôlei",
  "fórmula 1",
  "grande prêmio de",
  " ufc ",
  " mma ",
  " nba ",
  "jogos olímpicos",
  // famosos / entretenimento / fofoca
  "bbb",
  "big brother brasil",
  "a fazenda",
  "reality show",
  "ex-bbb",
  "novela das",
  "capítulo da novela",
  "climão entre",
  "affair de",
  "terminou o casamento",
  "pediu o divórcio",
  "novo namoro",
  "ficou noivo",
  "engravidou de",
  "influencer digital",
  "polêmica na web",
  "web reage",
  "viralizou nas redes",
  "famosos do",
  "hollywood",
  "prêmio grammy",
  "oscar de melhor",
  "lançamento do álbum",
  "show da banda",
  "ingressos esgotados",
  "participação no reality",
  "dança dos famosos",
  "fofoca",
  "resenha do filme",
  "crítica do filme",
  "sessão da tarde",
  "estreia nos cinemas",
  "elenco do filme",
  "trailer de",
  "novo filme da",
  "temporada da série",
  // loteria / horóscopo
  "mega-sena",
  "dia de sorte",
  "lotofácil",
  "quina de",
  "loteria federal",
  "resultado do sorteio",
  "horóscopo",
  "mapa astral",
  "previsão do seu signo",
];

/**
 * true = manchete pode aparecer em Notícias do Dia; false = excluída pelo filtro.
 * Checa título E subtítulo — algumas matérias só denunciam o assunto (esporte,
 * fofoca etc.) no subtítulo, não no título (ex.: "Botafogo: STJD divulga
 * resultado do julgamento" só cita "lateral-esquerdo" no texto de apoio).
 */
export function isPoliticallyRelevantHeadline(title: string, summary?: string): boolean {
  const normalized = ` ${title.toLowerCase()} ${(summary ?? "").toLowerCase()} `;
  return !EXCLUDED_PHRASES.some((phrase) => normalized.includes(phrase));
}
