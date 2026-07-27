#!/usr/bin/env node
/**
 * Gera os dados geográficos usados na seleção de Estado/Município da tela de temas:
 *
 *  - src/lib/geo/brazil-uf-map.ts       malha das 27 UFs (26 estados + DF) em SVG
 *  - public/geo/municipios/<UF>.json    municípios de cada UF, carregados sob demanda
 *
 * Fonte: APIs públicas do IBGE. Rode manualmente quando a malha ou a lista de
 * municípios mudar (criação/fusão de município, ajuste de divisa):
 *
 *   node scripts/generate-brazil-geo.mjs
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const MALHA_URL =
  "https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=image/svg+xml&intrarregiao=UF&qualidade=minima";
const MUNICIPIOS_URL =
  "https://servicodados.ibge.gov.br/api/v1/localidades/municipios?view=nivelado";

/** Código IBGE da UF -> sigla e nome. */
const UF_BY_CODE = {
  11: ["RO", "Rondônia"],
  12: ["AC", "Acre"],
  13: ["AM", "Amazonas"],
  14: ["RR", "Roraima"],
  15: ["PA", "Pará"],
  16: ["AP", "Amapá"],
  17: ["TO", "Tocantins"],
  21: ["MA", "Maranhão"],
  22: ["PI", "Piauí"],
  23: ["CE", "Ceará"],
  24: ["RN", "Rio Grande do Norte"],
  25: ["PB", "Paraíba"],
  26: ["PE", "Pernambuco"],
  27: ["AL", "Alagoas"],
  28: ["SE", "Sergipe"],
  29: ["BA", "Bahia"],
  31: ["MG", "Minas Gerais"],
  32: ["ES", "Espírito Santo"],
  33: ["RJ", "Rio de Janeiro"],
  35: ["SP", "São Paulo"],
  41: ["PR", "Paraná"],
  42: ["SC", "Santa Catarina"],
  43: ["RS", "Rio Grande do Sul"],
  50: ["MS", "Mato Grosso do Sul"],
  51: ["MT", "Mato Grosso"],
  52: ["GO", "Goiás"],
  53: ["DF", "Distrito Federal"],
};

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Falha ao buscar ${url}: HTTP ${response.status}`);
  }
  return response.text();
}

function extractViewBox(svg) {
  const match = svg.match(/viewBox="([^"]+)"/);
  if (!match) {
    throw new Error("viewBox não encontrado na malha do IBGE.");
  }
  return match[1];
}

function extractGroupTransform(svg) {
  const match = svg.match(/<g[^>]*transform="([^"]+)"/);
  if (!match) {
    throw new Error("transform do grupo não encontrado na malha do IBGE.");
  }
  return match[1];
}

function extractPaths(svg) {
  const paths = new Map();
  const pattern = /<path\s+id="(\d+)"\s+d="([^"]+)"/g;
  let match;
  while ((match = pattern.exec(svg)) !== null) {
    paths.set(Number(match[1]), match[2]);
  }
  return paths;
}

async function generateMap() {
  const svg = await fetchText(MALHA_URL);
  const viewBox = extractViewBox(svg);
  const transform = extractGroupTransform(svg);
  const paths = extractPaths(svg);

  const missing = Object.keys(UF_BY_CODE).filter((code) => !paths.has(Number(code)));
  if (missing.length > 0) {
    throw new Error(`UFs sem geometria na malha: ${missing.join(", ")}`);
  }

  const entries = Object.entries(UF_BY_CODE)
    .sort(([, a], [, b]) => a[0].localeCompare(b[0], "pt-BR"))
    .map(([code, [sigla, nome]]) => {
      const d = paths.get(Number(code));
      return `  { uf: "${sigla}", nome: "${nome}", d: "${d}" },`;
    });

  const file = `/**
 * Malha das 27 UFs (26 estados + Distrito Federal) para o seletor visual de Estado.
 *
 * ARQUIVO GERADO — não edite à mão. Rode \`node scripts/generate-brazil-geo.mjs\`.
 * Fonte: malhas territoriais do IBGE (qualidade mínima, suficiente para clique).
 */

export type BrazilUfShape = {
  /** Sigla da UF, como gravada no perfil. */
  uf: string;
  /** Nome por extenso, usado em tooltip e leitor de tela. */
  nome: string;
  /** Path SVG do contorno da UF. */
  d: string;
};

/** viewBox do SVG completo do Brasil. */
export const BRAZIL_MAP_VIEW_BOX = "${viewBox}";

/** Transform aplicado ao grupo de paths (converte a projeção do IBGE). */
export const BRAZIL_MAP_TRANSFORM = "${transform}";

export const BRAZIL_UF_SHAPES: readonly BrazilUfShape[] = [
${entries.join("\n")}
];

export const BRAZIL_UF_NAME_BY_SIGLA: Readonly<Record<string, string>> = Object.fromEntries(
  BRAZIL_UF_SHAPES.map((shape) => [shape.uf, shape.nome]),
);
`;

  const target = path.join(ROOT, "src", "lib", "geo", "brazil-uf-map.ts");
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, file, "utf8");
  console.log(`✓ ${path.relative(ROOT, target)} (${entries.length} UFs)`);
}

async function generateMunicipios() {
  const raw = JSON.parse(await fetchText(MUNICIPIOS_URL));
  const byUf = new Map();

  for (const row of raw) {
    const uf = row["UF-sigla"];
    const nome = row["municipio-nome"];
    if (!uf || !nome) continue;
    if (!byUf.has(uf)) {
      byUf.set(uf, []);
    }
    byUf.get(uf).push(nome);
  }

  const outDir = path.join(ROOT, "public", "geo", "municipios");
  await mkdir(outDir, { recursive: true });

  let total = 0;
  for (const [uf, nomes] of [...byUf].sort(([a], [b]) => a.localeCompare(b, "pt-BR"))) {
    const sorted = [...new Set(nomes)].sort((a, b) => a.localeCompare(b, "pt-BR"));
    total += sorted.length;
    await writeFile(path.join(outDir, `${uf}.json`), JSON.stringify(sorted), "utf8");
  }

  console.log(`✓ public/geo/municipios/*.json (${byUf.size} UFs, ${total} municípios)`);
}

await generateMap();
await generateMunicipios();
