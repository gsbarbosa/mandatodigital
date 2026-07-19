import {
  expect,
  type APIRequestContext,
  type Locator,
  type Page,
} from "@playwright/test";

export function createAutotestToken(prefix: string) {
  return `[AUTOTEST] ${prefix} ${Date.now()}`;
}

async function gotoPath(
  page: Page,
  path: string,
) {
  await page.goto(path);
  if (path === "/curador") {
    await expect(
      page.getByRole("heading", { name: "Calibragem de Persona" }),
    ).toBeVisible();
  } else {
    await expect(
      page.getByRole("heading", { name: /tropa de ia|mandato digital/i }),
    ).toBeVisible();
  }
  await page.waitForLoadState("networkidle");
}

export async function gotoHome(page: Page) {
  await gotoPath(page, "/");
}

export async function gotoCurador(page: Page) {
  await gotoPath(page, "/curador");
}

export async function gotoCriativo(page: Page) {
  await gotoPath(page, "/criativo");
}

export async function saveAutotestProfile(request: APIRequestContext) {
  const token = createAutotestToken("perfil");
  const response = await request.put("/api/profile", {
    data: {
      fullName: `${token} Maria Souza`,
      role: "Vereadora",
      city: "Recife",
      state: "PE",
      audience: "familias de bairro, pequenos empreendedores e servidores",
      spectrum: "Centro-Direita",
      archetype: "Fiscal",
      voiceTones: ["Didatico", "Popular"],
      keyIssues: ["Saude publica", "Tempo de espera", "Fiscalizacao"],
      slogans: ["Gente em primeiro lugar"],
      redLines: ["nao inventar dado", "nao acusar sem prova"],
      referenceExamples: ["falar de forma firme, simples e com foco em entrega"],
      bio: "Mandato focado em fiscalizacao, saude publica e linguagem simples, com cobranca firme e compromisso com entrega concreta nos bairros.",
    },
  });

  expect(response.status()).toBe(200);

  return token;
}

export async function generateAutotestContent(page: Page) {
  const topic = createAutotestToken("tema consultas especializadas");
  await gotoCriativo(page);

  await page.getByTestId("request-topic").fill(
    `${topic}: aumento no tempo de espera para consultas especializadas`,
  );
  await page
    .getByTestId("request-objective")
    .fill("cobrar resposta da prefeitura com foco em solucao local");
  await page
    .getByTestId("request-cta")
    .fill("compartilhe este post e conte seu bairro");
  await page
    .getByTestId("request-context")
    .fill("a fila cresceu nas ultimas semanas e o impacto ja chegou nos bairros");
  await page
    .getByTestId("request-key-facts")
    .fill("moradores relataram remarcacoes\npostos com alta demanda");

  const generationResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/generate") &&
      response.request().method() === "POST",
    { timeout: 90_000 },
  );
  await page.getByTestId("generate-content-button").click();
  const response = await generationResponse;
  expect(response.status()).toBe(200);
  await expect(page.getByText(topic).first()).toBeVisible();

  return topic;
}

export async function expectTextNotEmpty(locator: Locator) {
  const text = (await locator.textContent())?.trim() || "";
  expect(text.length).toBeGreaterThan(12);
}
