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
  options?: { openFeedback?: boolean },
) {
  const targetUrl = options?.openFeedback ? `${path}?e2e=open-feedback` : path;
  await page.goto(targetUrl);
  await expect(page.getByRole("heading", { name: "Mandato Digital" })).toBeVisible();
  await page.waitForLoadState("networkidle");
}

export async function gotoHome(
  page: Page,
  options?: { openFeedback?: boolean },
) {
  await gotoPath(page, "/", options);
}

export async function gotoCurador(
  page: Page,
  options?: { openFeedback?: boolean },
) {
  await gotoPath(page, "/curador", options);
}

export async function gotoCriativo(
  page: Page,
  options?: { openFeedback?: boolean },
) {
  await gotoPath(page, "/criativo", options);
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

export async function openFeedbackDrawer(
  page: Page,
  options?: { path?: "/" | "/curador" | "/criativo" | "/auditor" | "/admin" },
) {
  await gotoPath(page, options?.path ?? "/", { openFeedback: true });

  await expect(page.getByTestId("feedback-drawer")).toHaveAttribute(
    "aria-hidden",
    "false",
  );

  await expect(page.getByTestId("feedback-drawer-heading")).toBeVisible();
  await expect(page.getByTestId("product-feedback-screen")).toBeVisible();
}

export async function submitProductFeedback(
  page: Page,
  input: {
    screen: string;
    workedWell: string;
    issueObserved: string;
  },
) {
  await openFeedbackDrawer(page);

  await page.getByTestId("product-feedback-screen").fill(input.screen);
  await page.getByTestId("product-feedback-worked-well").fill(input.workedWell);
  await page.getByTestId("product-feedback-issue").fill(input.issueObserved);

  const feedbackResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/product-feedback") &&
      response.request().method() === "POST",
    { timeout: 90_000 },
  );
  await page.getByTestId("submit-product-feedback").click();
  const response = await feedbackResponse;
  expect(response.status()).toBe(201);

  return page.getByTestId("product-feedback-card").first();
}

export async function expectTextNotEmpty(locator: Locator) {
  const text = (await locator.textContent())?.trim() || "";
  expect(text.length).toBeGreaterThan(12);
}
