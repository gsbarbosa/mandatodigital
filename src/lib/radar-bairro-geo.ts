/**
 * Camada geográfica do Radar de Bairro: decide sozinho se a cidade do mandato é
 * "cidade inteira" ou "por bairro", e lista bairros candidatos quando for o caso.
 *
 * O usuário nunca digita bairro pra essa parte — a decisão sai da população do
 * município (IBGE). Ver docs/radar-de-bairro.md.
 *
 * Tudo aqui é rede lenta e tolerante a falha: é chamado na CURADORIA (ação
 * ocasional, com tela de carregamento própria), nunca no refresh do dia a dia.
 */

import { isUf } from "@/lib/eleicao-2026";

/**
 * Corte que separa "usa o nome da cidade" de "usa bairros". Decisão de produto,
 * não constante técnica: abaixo disso o grupo de bairro em geral nem existe como
 * identidade social (só grupo da cidade), acima disso o inverso — não existe
 * grupo "da cidade inteira" numa capital. Ajustável com mais casos reais.
 */
export const RADAR_BAIRRO_POPULATION_THRESHOLD = 125_000;

/** Timeout curto: qualquer fonte externa aqui é "melhor esforço", nunca bloqueante. */
const FETCH_TIMEOUT_MS = 20_000;

/**
 * Espelhos do Overpass (OpenStreetMap). O público oficial devolve 429/406 com
 * frequência e exige User-Agent identificável — por isso a lista e o header.
 */
const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

const OVERPASS_USER_AGENT = "mandato-digital/1.0 (radar-de-bairro)";

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeUf(uf: string): string {
  return uf.trim().toUpperCase();
}

/** Compara nome de município/bairro ignorando acento, caixa e espaço extra. */
export function normalizeCityName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

type IbgeMunicipio = { nome?: unknown; codigo_ibge?: unknown };

/**
 * Código IBGE do município a partir de nome + UF. Usa a BrasilAPI (mesma família
 * de fonte pública já usada no projeto pra geografia) — sem chave.
 */
export async function resolveMunicipioCode(city: string, uf: string): Promise<string | null> {
  const normalizedUf = normalizeUf(uf);
  const target = normalizeCityName(city);
  if (!target || !isUf(normalizedUf)) {
    return null;
  }

  const response = await fetchWithTimeout(
    `https://brasilapi.com.br/api/ibge/municipios/v1/${encodeURIComponent(normalizedUf)}`,
  );
  if (!response?.ok) {
    return null;
  }

  const payload = (await response.json().catch(() => null)) as IbgeMunicipio[] | null;
  if (!Array.isArray(payload)) {
    return null;
  }

  const match = payload.find((item) => normalizeCityName(String(item?.nome ?? "")) === target);
  const code = String(match?.codigo_ibge ?? "").trim();
  return code || null;
}

/**
 * População estimada do município (agregado 6579 / variável 9324 do IBGE).
 * null = não deu pra saber — quem chama decide o fallback.
 */
export async function fetchMunicipioPopulation(municipioCode: string): Promise<number | null> {
  const code = municipioCode.trim();
  if (!/^\d{7}$/.test(code)) {
    return null;
  }

  const response = await fetchWithTimeout(
    `https://servicodados.ibge.gov.br/api/v3/agregados/6579/periodos/-1/variaveis/9324?localidades=N6[${code}]`,
  );
  if (!response?.ok) {
    return null;
  }

  const payload = (await response.json().catch(() => null)) as unknown;
  if (!Array.isArray(payload) || !payload.length) {
    return null;
  }

  // Formato: [{ resultados: [{ series: [{ serie: { "2025": "266561" } }] }] }]
  const serie = (payload[0] as Record<string, unknown> | undefined)?.resultados;
  if (!Array.isArray(serie) || !serie.length) {
    return null;
  }
  const series = (serie[0] as Record<string, unknown> | undefined)?.series;
  if (!Array.isArray(series) || !series.length) {
    return null;
  }
  const values = (series[0] as Record<string, unknown> | undefined)?.serie;
  if (!values || typeof values !== "object") {
    return null;
  }

  const parsed = Object.values(values as Record<string, unknown>)
    .map((value) => Number(String(value).replace(/\D+/g, "")))
    .filter((value) => Number.isFinite(value) && value > 0);

  return parsed.length ? parsed[parsed.length - 1]! : null;
}

export type RadarBairroCityMode = {
  /** "cidade" = busca pelo município; "bairro" = precisa de lista de bairros. */
  mode: "cidade" | "bairro";
  population: number | null;
  municipioCode: string | null;
};

/**
 * Decide o modo da cidade. Sem população confiável, cai em "cidade" — é o modo
 * mais barato e que não depende de curadoria de N bairros; erra pra menos, não
 * pra mais.
 */
export async function resolveCityMode(city: string, uf: string): Promise<RadarBairroCityMode> {
  const municipioCode = await resolveMunicipioCode(city, uf);
  if (!municipioCode) {
    return { mode: "cidade", population: null, municipioCode: null };
  }

  const population = await fetchMunicipioPopulation(municipioCode);
  if (population === null) {
    return { mode: "cidade", population: null, municipioCode };
  }

  return {
    mode: population >= RADAR_BAIRRO_POPULATION_THRESHOLD ? "bairro" : "cidade",
    population,
    municipioCode,
  };
}

export type OsmNeighborhood = {
  name: string;
  /** População quando o OSM tem a tag preenchida — sinal forte, porém raro. */
  population: number | null;
  /** place=suburb costuma marcar bairro "de verdade"; neighbourhood pega loteamento. */
  isSuburb: boolean;
};

function parseOverpassElements(raw: unknown): OsmNeighborhood[] {
  if (!raw || typeof raw !== "object") {
    return [];
  }
  const elements = (raw as Record<string, unknown>).elements;
  if (!Array.isArray(elements)) {
    return [];
  }

  const byName = new Map<string, OsmNeighborhood>();
  for (const element of elements) {
    const tags = (element as Record<string, unknown> | undefined)?.tags;
    if (!tags || typeof tags !== "object") {
      continue;
    }
    const record = tags as Record<string, unknown>;
    const name = String(record.name ?? "").trim();
    if (!name) {
      continue;
    }
    const populationRaw = String(record.population ?? "").replace(/\D+/g, "");
    const population = populationRaw ? Number(populationRaw) : null;
    const isSuburb = String(record.place ?? "") === "suburb";

    const previous = byName.get(name);
    if (!previous) {
      byName.set(name, {
        name,
        population: Number.isFinite(population) && population ? population : null,
        isSuburb,
      });
      continue;
    }
    // Mesmo nome em nós diferentes: fica com o sinal mais forte de cada campo.
    byName.set(name, {
      name,
      population: previous.population ?? (Number.isFinite(population) && population ? population : null),
      isSuburb: previous.isSuburb || isSuburb,
    });
  }

  return [...byName.values()];
}

/**
 * Bairros da cidade no OpenStreetMap. Lista bruta — a priorização de quais valem
 * tentar fica em `rankNeighborhoodCandidates`.
 */
export async function fetchOsmNeighborhoods(city: string, uf: string): Promise<OsmNeighborhood[]> {
  const cityName = city.trim();
  if (!cityName) {
    return [];
  }

  const query = `[out:json][timeout:45];
area["boundary"="administrative"]["admin_level"="8"]["name"="${cityName.replace(/"/g, "")}"]->.a;
(node["place"~"^(suburb|neighbourhood|quarter)$"](area.a););
out tags qt;`;

  for (const mirror of OVERPASS_MIRRORS) {
    const response = await fetchWithTimeout(mirror, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": OVERPASS_USER_AGENT,
      },
      body: `data=${encodeURIComponent(query)}`,
    });
    if (!response?.ok) {
      continue;
    }
    const text = await response.text().catch(() => "");
    if (!text.trim().startsWith("{")) {
      // Espelho devolveu HTML de erro/rate-limit — tenta o próximo.
      continue;
    }
    const parsed = parseOverpassElements(JSON.parse(text));
    if (parsed.length) {
      return parsed;
    }
  }

  return [];
}

/**
 * Ordena bairros candidatos por chance de ter comunidade organizada — nenhuma
 * fonte isolada é confiável, então combina as que existirem:
 *
 * 1. população preenchida no OSM (sinal mais forte, mas raro: 9 de 520 em SP)
 * 2. `place=suburb` (funciona em BH — 289→36 —, não em SP, onde quase tudo é suburb)
 * 3. nomes que o time considera conhecidos (palpite barato, sem risco: tudo passa
 *    pela verificação de atividade depois)
 * 4. o resto da lista
 *
 * A ordem só decide QUEM É TENTADO PRIMEIRO. Quem entra de fato no cadastro é
 * decidido pela verificação (bairro inexpressivo não tem grupo ativo e cai lá).
 */
export function rankNeighborhoodCandidates(
  neighborhoods: OsmNeighborhood[],
  knownNames: string[] = [],
): string[] {
  const known = new Set(knownNames.map(normalizeCityName).filter(Boolean));
  const suburbCount = neighborhoods.filter((item) => item.isSuburb).length;
  // place=suburb só é sinal útil quando de fato filtra: se quase tudo é suburb
  // (caso de São Paulo), a tag não separa nada e vira ruído.
  const suburbIsMeaningful =
    suburbCount > 0 && suburbCount <= Math.max(8, Math.floor(neighborhoods.length * 0.4));

  return [...neighborhoods]
    .map((item) => {
      let score = 0;
      if (item.population) {
        score += 1000 + Math.min(item.population, 500_000) / 1000;
      }
      if (known.has(normalizeCityName(item.name))) {
        score += 500;
      }
      if (suburbIsMeaningful && item.isSuburb) {
        score += 100;
      }
      return { name: item.name, score };
    })
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name, "pt-BR"))
    .map((item) => item.name);
}
