/**
 * Catálogo fixo de portais por esfera — federal (10 nacionais) e estadual (5 por UF).
 * Usado pelo Sentinela para RSS/Google News sem depender do candidato cadastrar portais.
 */

export const BRAZILIAN_UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export type BrazilianUf = (typeof BRAZILIAN_UFS)[number];

/** Dez portais nacionais monitorados automaticamente no nível federal. */
export const NATIONAL_PORTAL_HOSTS = [
  "g1.globo.com",
  "cnnbrasil.com.br",
  "estadao.com.br",
  "folha.uol.com.br",
  "uol.com.br",
  "oglobo.globo.com",
  "r7.com",
  "terra.com.br",
  "metropoles.com",
  "poder360.com.br",
] as const;

/**
 * Buscadores de notícia usados nas TRÊS esferas (federal, estadual e municipal),
 * em cima das queries de tema + recorte geográfico. Google News é o primário;
 * o Bing News entra automaticamente quando o Google falha ou volta vazio
 * (circuit breaker em sentinel-rss.ts). Exportado para a tela de temas exibir
 * as fontes reais de cada esfera.
 */
export const NEWS_SEARCH_ENGINES = [
  { label: "Google News", role: "primário" },
  { label: "Bing News", role: "alternativo" },
] as const;

/**
 * Cinco portais por UF para o nível estadual.
 *
 * Curadoria: só veículos de circulação LOCAL do estado. Portais nacionais
 * (g1/uol/r7/terra) foram removidos de propósito — a cobertura nacional já vem
 * de NATIONAL_PORTAL_HOSTS, e repeti-los aqui gastava 3 das 5 vagas sem trazer
 * pauta regional. Cada host foi verificado (resolve + tem RSS/Atom, news
 * sitemap ou fallback via Google News site:) antes de entrar na lista.
 */
export const STATE_PORTAL_HOSTS: Record<BrazilianUf, readonly string[]> = {
  AC: [
    "ac24horas.com",
    "contilnetnoticias.com.br",
    "agazetadoacre.com",
    "oriobranco.net",
    "noticiasdahora.com.br",
  ],
  AL: [
    "gazetaweb.com",
    "tribunahoje.com",
    "cadaminuto.com.br",
    "tnh1.com.br",
    "alagoas24horas.com.br",
  ],
  AP: [
    "selesnafes.com",
    "diariodoamapa.com.br",
    "gazetadoamapa.com.br",
    "portaldoamapa.com.br",
    "jornaloamapa.com",
  ],
  AM: [
    "acritica.com",
    "emtempo.com.br",
    "d24am.com",
    "portaldoholanda.com.br",
    "amazonasatual.com.br",
  ],
  BA: [
    "correio24horas.com.br",
    "atarde.com.br",
    "bahianoticias.com.br",
    "metro1.com.br",
    "aratuon.com.br",
  ],
  CE: [
    "opovo.com.br",
    "diariodonordeste.verdesmares.com.br",
    "oestadoce.com.br",
    "tribunadoceara.com.br",
    "cearaagora.com.br",
  ],
  DF: [
    "correiobraziliense.com.br",
    "metropoles.com",
    "jornaldebrasilia.com.br",
    "agenciabrasilia.df.gov.br",
    "diariodopoder.com.br",
  ],
  ES: [
    "agazeta.com.br",
    "folhavitoria.com.br",
    "tribunaonline.com.br",
    "seculodiario.com.br",
    "eshoje.com.br",
  ],
  GO: [
    "opopular.com.br",
    "jornalopcao.com.br",
    "maisgoias.com.br",
    "ohoje.com",
    "portal6.com.br",
  ],
  MA: [
    "imirante.com",
    "oimparcial.com.br",
    "jornalpequeno.com.br",
    "mahoje.com.br",
    "portalguara.com",
  ],
  MT: [
    "midianews.com.br",
    "olhardireto.com.br",
    "rdnews.com.br",
    "gazetadigital.com.br",
    "sonoticias.com.br",
  ],
  MS: [
    "campograndenews.com.br",
    "midiamax.com.br",
    "correiodoestado.com.br",
    "topmidianews.com.br",
    "oestadoonline.com.br",
  ],
  MG: [
    "em.com.br",
    "otempo.com.br",
    "itatiaia.com.br",
    "hojeemdia.com.br",
    "diariodocomercio.com.br",
  ],
  PA: [
    "oliberal.com",
    "diariodopara.com.br",
    "dol.com.br",
    "romanews.com.br",
    "ver-o-fato.com.br",
  ],
  PB: [
    "jornaldaparaiba.com.br",
    "portalcorreio.com.br",
    "pbagora.com.br",
    "polemicaparaiba.com.br",
    "clickpb.com.br",
  ],
  PR: [
    "gazetadopovo.com.br",
    "bemparana.com.br",
    "tribunapr.com.br",
    "folhadelondrina.com.br",
    "ric.com.br",
  ],
  PE: [
    "diariodepernambuco.com.br",
    "folhape.com.br",
    "jc.uol.com.br",
    "ne10.uol.com.br",
    "marcozero.org",
  ],
  PI: ["cidadeverde.com", "gp1.com.br", "portalodia.com", "meionews.com", "180graus.com"],
  RJ: [
    "odia.ig.com.br",
    "extra.globo.com",
    "diariodorio.com",
    "ofluminense.com.br",
    "jb.com.br",
  ],
  RN: [
    "tribunadonorte.com.br",
    "agorarn.com.br",
    "novonoticias.com",
    "saibamais.jor.br",
    "potiguarnoticias.com.br",
  ],
  RS: [
    "gauchazh.clicrbs.com.br",
    "correiodopovo.com.br",
    "jornaldocomercio.com",
    "sul21.com.br",
    "matinal.org",
  ],
  RO: [
    "rondoniaovivo.com",
    "rondoniadinamica.com",
    "gentedeopiniao.com.br",
    "diariodaamazonia.com.br",
    "folhaderondonia.com.br",
  ],
  RR: [
    "folhabv.com.br",
    "roraimaemtempo.com.br",
    "roraima1.com.br",
    "roraimaemfoco.com",
    "boavistaja.com",
  ],
  SC: ["nsctotal.com.br", "ndmais.com.br", "ocp.news", "ric.com.br", "blumenews.com.br"],
  SP: [
    "gazetasp.com.br",
    "dgabc.com.br",
    "acidadeon.com",
    "correio.rac.com.br",
    "atribuna.com.br",
  ],
  SE: ["infonet.com.br", "f5news.com.br", "a8se.com", "cinform.com.br", "nenoticias.com.br"],
  TO: [
    "jornaldotocantins.com.br",
    "conexaoto.com.br",
    "t1noticias.com.br",
    "surgiu.com.br",
    "afnoticias.com.br",
  ],
};

/** Hosts estaduais curados — usado pra desempatar subdomínio de portal nacional. */
const STATE_PORTAL_HOST_SET = new Set<string>(Object.values(STATE_PORTAL_HOSTS).flat());

/**
 * Nome por extenso da UF. Buscas geográficas usam o nome, não a sigla: "MG" quase
 * nunca aparece no corpo de uma matéria, "Minas Gerais" aparece — a sigla sozinha
 * derrubava a recall do fallback `site:` a quase zero.
 */
const UF_NAMES: Record<BrazilianUf, string> = {
  AC: "Acre",
  AL: "Alagoas",
  AP: "Amapá",
  AM: "Amazonas",
  BA: "Bahia",
  CE: "Ceará",
  DF: "Distrito Federal",
  ES: "Espírito Santo",
  GO: "Goiás",
  MA: "Maranhão",
  MT: "Mato Grosso",
  MS: "Mato Grosso do Sul",
  MG: "Minas Gerais",
  PA: "Pará",
  PB: "Paraíba",
  PR: "Paraná",
  PE: "Pernambuco",
  PI: "Piauí",
  RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul",
  RO: "Rondônia",
  RR: "Roraima",
  SC: "Santa Catarina",
  SP: "São Paulo",
  SE: "Sergipe",
  TO: "Tocantins",
};

export function normalizeUf(input: string): BrazilianUf | null {
  const uf = input.trim().toUpperCase();
  return (BRAZILIAN_UFS as readonly string[]).includes(uf) ? (uf as BrazilianUf) : null;
}

/** Nome por extenso da UF, ou string vazia quando a sigla não é válida. */
export function getUfName(uf: string): string {
  const normalized = normalizeUf(uf);
  return normalized ? UF_NAMES[normalized] : "";
}

export function getNationalPortalHosts(): string[] {
  return [...NATIONAL_PORTAL_HOSTS];
}

export function getStatePortalHosts(uf: string): string[] {
  const normalized = normalizeUf(uf);
  if (!normalized) {
    return [];
  }
  return [...STATE_PORTAL_HOSTS[normalized]];
}

export function countCatalogPortalHosts(input: {
  federalThemeCount: number;
  estadualThemeCount: number;
  state: string;
}): number {
  let count = 0;
  if (input.federalThemeCount > 0) {
    count += NATIONAL_PORTAL_HOSTS.length;
  }
  if (input.estadualThemeCount > 0 && normalizeUf(input.state)) {
    count += STATE_PORTAL_HOSTS[normalizeUf(input.state)!].length;
  }
  return count;
}

export function isNationalPortalHost(host: string): boolean {
  const normalized = host.trim().toLowerCase().replace(/^www\./, "");
  if ((NATIONAL_PORTAL_HOSTS as readonly string[]).includes(normalized)) {
    return true;
  }
  // Subdomínio de portal nacional que é veículo estadual curado (ex.: jc.uol.com.br,
  // ne10.uol.com.br) não pode ser classificado como federal só pelo sufixo.
  if (STATE_PORTAL_HOST_SET.has(normalized)) {
    return false;
  }
  return NATIONAL_PORTAL_HOSTS.some((candidate) => normalized.endsWith(`.${candidate}`));
}

export function isStatePortalHost(host: string, uf: string): boolean {
  const normalizedUf = normalizeUf(uf);
  if (!normalizedUf) {
    return false;
  }
  const normalized = host.trim().toLowerCase().replace(/^www\./, "");
  return STATE_PORTAL_HOSTS[normalizedUf].some(
    (candidate) => normalized === candidate || normalized.endsWith(`.${candidate}`),
  );
}

/** Nome de exibição por host, usado na tela de configuração do monitoramento. */
const PORTAL_HOST_LABELS: Record<string, string> = {
  "g1.globo.com": "G1",
  "cnnbrasil.com.br": "CNN Brasil",
  "estadao.com.br": "Estadão",
  "folha.uol.com.br": "Folha de S.Paulo",
  "uol.com.br": "UOL",
  "oglobo.globo.com": "O Globo",
  "r7.com": "R7",
  "terra.com.br": "Terra",
  "metropoles.com": "Metrópoles",
  "poder360.com.br": "Poder360",
  // AC
  "ac24horas.com": "AC24horas",
  "contilnetnoticias.com.br": "ContilNet",
  "agazetadoacre.com": "A Gazeta do Acre",
  "oriobranco.net": "O Rio Branco",
  "noticiasdahora.com.br": "Notícias da Hora",
  // AL
  "gazetaweb.com": "Gazeta de Alagoas",
  "tribunahoje.com": "Tribuna Hoje",
  "cadaminuto.com.br": "Cada Minuto",
  "tnh1.com.br": "TNH1",
  "alagoas24horas.com.br": "Alagoas 24 Horas",
  // AP
  "selesnafes.com": "SelesNafes",
  "diariodoamapa.com.br": "Diário do Amapá",
  "gazetadoamapa.com.br": "Gazeta do Amapá",
  "portaldoamapa.com.br": "Portal do Amapá",
  "jornaloamapa.com": "Jornal O Amapá",
  // AM
  "acritica.com": "A Crítica",
  "emtempo.com.br": "Em Tempo",
  "d24am.com": "D24AM",
  "portaldoholanda.com.br": "Portal do Holanda",
  "amazonasatual.com.br": "Amazonas Atual",
  // BA
  "correio24horas.com.br": "Correio 24 Horas",
  "atarde.com.br": "A Tarde",
  "bahianoticias.com.br": "Bahia Notícias",
  "metro1.com.br": "Metro1",
  "aratuon.com.br": "Aratu On",
  // CE
  "opovo.com.br": "O Povo",
  "diariodonordeste.verdesmares.com.br": "Diário do Nordeste",
  "oestadoce.com.br": "O Estado (CE)",
  "tribunadoceara.com.br": "Tribuna do Ceará",
  "cearaagora.com.br": "Ceará Agora",
  // DF
  "correiobraziliense.com.br": "Correio Braziliense",
  "jornaldebrasilia.com.br": "Jornal de Brasília",
  "agenciabrasilia.df.gov.br": "Agência Brasília",
  "diariodopoder.com.br": "Diário do Poder",
  // ES
  "agazeta.com.br": "A Gazeta (ES)",
  "folhavitoria.com.br": "Folha Vitória",
  "tribunaonline.com.br": "A Tribuna (ES)",
  "seculodiario.com.br": "Século Diário",
  "eshoje.com.br": "ES Hoje",
  // GO
  "opopular.com.br": "O Popular",
  "jornalopcao.com.br": "Jornal Opção",
  "maisgoias.com.br": "Mais Goiás",
  "ohoje.com": "O Hoje",
  "portal6.com.br": "Portal 6",
  // MA
  "imirante.com": "Imirante",
  "oimparcial.com.br": "O Imparcial",
  "jornalpequeno.com.br": "Jornal Pequeno",
  "mahoje.com.br": "Maranhão Hoje",
  "portalguara.com": "Record News Maranhão",
  // MT
  "midianews.com.br": "MidiaNews",
  "olhardireto.com.br": "Olhar Direto",
  "rdnews.com.br": "RD News",
  "gazetadigital.com.br": "Gazeta Digital",
  "sonoticias.com.br": "Só Notícias",
  // MS
  "campograndenews.com.br": "Campo Grande News",
  "midiamax.com.br": "Midiamax",
  "correiodoestado.com.br": "Correio do Estado",
  "topmidianews.com.br": "Top Mídia News",
  "oestadoonline.com.br": "O Estado (MS)",
  // MG
  "em.com.br": "Estado de Minas",
  "otempo.com.br": "O Tempo",
  "itatiaia.com.br": "Itatiaia",
  "hojeemdia.com.br": "Hoje em Dia",
  "diariodocomercio.com.br": "Diário do Comércio",
  // PA
  "oliberal.com": "O Liberal",
  "diariodopara.com.br": "Diário do Pará",
  "dol.com.br": "DOL — Diário Online",
  "romanews.com.br": "Roma News",
  "ver-o-fato.com.br": "Ver-o-Fato",
  // PB
  "jornaldaparaiba.com.br": "Jornal da Paraíba",
  "portalcorreio.com.br": "Portal Correio",
  "pbagora.com.br": "PB Agora",
  "polemicaparaiba.com.br": "Polêmica Paraíba",
  "clickpb.com.br": "ClickPB",
  // PR
  "gazetadopovo.com.br": "Gazeta do Povo",
  "bemparana.com.br": "Bem Paraná",
  "tribunapr.com.br": "Tribuna do Paraná",
  "folhadelondrina.com.br": "Folha de Londrina",
  "ric.com.br": "RIC",
  // PE
  "diariodepernambuco.com.br": "Diário de Pernambuco",
  "folhape.com.br": "Folha de Pernambuco",
  "jc.uol.com.br": "Jornal do Commercio",
  "ne10.uol.com.br": "NE10",
  "marcozero.org": "Marco Zero",
  // PI
  "cidadeverde.com": "Cidade Verde",
  "gp1.com.br": "GP1",
  "portalodia.com": "O Dia (PI)",
  "meionews.com": "Meio News",
  "180graus.com": "180graus",
  // RJ
  "odia.ig.com.br": "O Dia",
  "extra.globo.com": "Extra",
  "diariodorio.com": "Diário do Rio",
  "ofluminense.com.br": "O Fluminense",
  "jb.com.br": "Jornal do Brasil",
  // RN
  "tribunadonorte.com.br": "Tribuna do Norte",
  "agorarn.com.br": "Agora RN",
  "novonoticias.com": "Novo Notícias",
  "saibamais.jor.br": "Saiba Mais",
  "potiguarnoticias.com.br": "Potiguar Notícias",
  // RS
  "gauchazh.clicrbs.com.br": "GZH",
  "correiodopovo.com.br": "Correio do Povo",
  "jornaldocomercio.com": "Jornal do Comércio (RS)",
  "sul21.com.br": "Sul21",
  "matinal.org": "Matinal",
  // RO
  "rondoniaovivo.com": "Rondônia Ao Vivo",
  "rondoniadinamica.com": "Rondônia Dinâmica",
  "gentedeopiniao.com.br": "Gente de Opinião",
  "diariodaamazonia.com.br": "Diário da Amazônia",
  "folhaderondonia.com.br": "Folha de Rondônia",
  // RR
  "folhabv.com.br": "Folha BV",
  "roraimaemtempo.com.br": "Roraima em Tempo",
  "roraima1.com.br": "Roraima1",
  "roraimaemfoco.com": "Roraima em Foco",
  "boavistaja.com": "Boa Vista Já",
  // SC
  "nsctotal.com.br": "NSC Total",
  "ndmais.com.br": "ND+",
  "ocp.news": "OCP News",
  "blumenews.com.br": "Blumenews",
  // SP
  "gazetasp.com.br": "Gazeta de S.Paulo",
  "dgabc.com.br": "Diário do Grande ABC",
  "acidadeon.com": "ACidadeON",
  "correio.rac.com.br": "Correio Popular",
  "atribuna.com.br": "A Tribuna (Santos)",
  // SE
  "infonet.com.br": "Infonet",
  "f5news.com.br": "F5 News",
  "a8se.com": "A8SE",
  "cinform.com.br": "Cinform",
  "nenoticias.com.br": "NE Notícias",
  // TO
  "jornaldotocantins.com.br": "Jornal do Tocantins",
  "conexaoto.com.br": "Conexão Tocantins",
  "t1noticias.com.br": "T1 Notícias",
  "surgiu.com.br": "Surgiu",
  "afnoticias.com.br": "AF Notícias",
};

/** Nome de exibição do host, com fallback derivado do domínio para hosts sem curadoria. */
export function getPortalHostLabel(host: string): string {
  const normalized = host.trim().toLowerCase().replace(/^www\./, "");
  const known = PORTAL_HOST_LABELS[normalized];
  if (known) {
    return known;
  }
  const firstLabel = normalized.split(".")[0] ?? normalized;
  return firstLabel.charAt(0).toUpperCase() + firstLabel.slice(1);
}
