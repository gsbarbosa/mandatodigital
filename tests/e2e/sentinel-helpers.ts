import { expect, type APIRequestContext, type Page } from "@playwright/test";

import { evaluateSentinelFeedQuality } from "../../src/lib/sentinel-quality-assertions";
import type { MockSentinelSuggestion } from "../../src/lib/sentinel-mock-suggestions";
import type { SentinelSuggestionsMeta } from "../../src/lib/sentinel-types";

/** Temas estáveis para o e2e — cobrem as esferas e costumam ter cobertura RSS. */
export const E2E_FEDERAL_THEMES = [
  "Desemprego",
  "Carga Tributária",
  "Contratos Públicos",
  "Inflação e Preços",
  "Vacinação",
] as const;

export const E2E_ESTADUAL_THEMES = [
  "Segurança Pública",
  "Valorização Policial",
  "Saúde Pública (SUS)",
  "Educação Básica",
  "Mobilidade Urbana",
] as const;

/** Impede modais/checklist de onboarding de interceptar o E2E do Sentinela. */
export async function suppressOnboardingForE2E(page: Page) {
  await page.addInitScript(() => {
    const dismissedState = JSON.stringify({
      dismissed: true,
      welcomeSeen: true,
      replayRequested: false,
      tourFromScratch: false,
      localDone: [],
    });

    const originalGetItem = Storage.prototype.getItem;
    const originalSetItem = Storage.prototype.setItem;

    Storage.prototype.getItem = function getItem(key: string) {
      if (typeof key === "string" && key.startsWith("md:onboarding:v2:")) {
        return dismissedState;
      }
      return originalGetItem.call(this, key);
    };

    Storage.prototype.setItem = function setItem(key: string, value: string) {
      if (typeof key === "string" && key.startsWith("md:onboarding:v2:")) {
        return originalSetItem.call(this, key, dismissedState);
      }
      return originalSetItem.call(this, key, value);
    };
  });
}

export async function dismissOnboardingOverlays(page: Page) {
  // Welcome pode montar um tick depois do first paint (race mounted vs localStorage).
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const laterButton = page.getByRole("button", { name: /Ver checklist depois/i });
    if (await laterButton.isVisible().catch(() => false)) {
      await laterButton.click().catch(() => undefined);
    }

    const dialog = page.locator('[role="dialog"][aria-modal="true"]');
    const count = await dialog.count();
    if (count === 0) {
      return;
    }

    const close = dialog.getByRole("button", { name: "Fechar" }).first();
    if (await close.isVisible().catch(() => false)) {
      await close.click().catch(() => undefined);
    }

    await page.evaluate(() => {
      document
        .querySelectorAll('[role="dialog"][aria-modal="true"]')
        .forEach((node) => node.remove());
    });

    await page.waitForTimeout(300);
  }
}

export async function gotoMonitoramento(page: Page) {
  await suppressOnboardingForE2E(page);
  await page.goto("/monitoramento");
  await page.waitForLoadState("domcontentloaded");

  if (page.url().includes("/login")) {
    throw new Error("Sessão inválida — rode npm run test:e2e:auth com E2E_EMAIL/E2E_PASSWORD.");
  }

  if (page.url().includes("/acesso-antecipado/dados")) {
    throw new Error(
      "Cadastro incompleto — complete /acesso-antecipado/dados na conta E2E antes dos testes do Sentinela.",
    );
  }

  await expect(page.getByTestId("monitoramento-page")).toBeVisible({ timeout: 30_000 });
  await dismissOnboardingOverlays(page);
}

export async function gotoTemas(page: Page) {
  await suppressOnboardingForE2E(page);
  await page.goto("/monitoramento/temas");
  await page.waitForLoadState("domcontentloaded");

  if (page.url().includes("/login")) {
    throw new Error("Sessão inválida — rode npm run test:e2e:auth com E2E_EMAIL/E2E_PASSWORD.");
  }

  if (page.url().includes("/acesso-antecipado/dados")) {
    throw new Error(
      "Cadastro incompleto — complete /acesso-antecipado/dados na conta E2E antes dos testes do Sentinela.",
    );
  }

  await expect(page.getByTestId("temas-page")).toBeVisible({ timeout: 30_000 });
  await dismissOnboardingOverlays(page);
}

async function clearSphereThemes(page: Page, sphere: "federal" | "estadual") {
  const active = page.locator(
    `[data-testid="theme-tag-pill"][data-sphere="${sphere}"][data-active="true"]`,
  );
  const count = await active.count();
  for (let index = 0; index < count; index += 1) {
    // Sempre o primeiro ativo: a lista muda a cada clique.
    await active.first().click();
  }
}

async function selectSphereThemes(
  page: Page,
  sphere: "federal" | "estadual",
  themes: readonly string[],
) {
  for (const theme of themes) {
    const pill = page.locator(
      `[data-testid="theme-tag-pill"][data-sphere="${sphere}"][data-theme="${theme}"]`,
    );
    await expect(pill, `Tema ausente no catálogo: ${theme} (${sphere})`).toBeVisible();
    const isActive = (await pill.getAttribute("data-active")) === "true";
    if (!isActive) {
      await pill.click();
    }
    await expect(pill).toHaveAttribute("data-active", "true");
  }
}

export async function configureSentinelThemes(
  page: Page,
  options: {
    federal?: readonly string[];
    estadual?: readonly string[];
    state?: string;
  } = {},
) {
  const federal = options.federal ?? E2E_FEDERAL_THEMES;
  const estadual = options.estadual ?? E2E_ESTADUAL_THEMES;
  const state = options.state ?? "MG";

  await gotoTemas(page);

  const uf = page.getByTestId("temas-uf-select");
  await uf.selectOption(state);
  await expect(uf).toHaveValue(state);

  await clearSphereThemes(page, "federal");
  await selectSphereThemes(page, "federal", federal);

  await clearSphereThemes(page, "estadual");
  await selectSphereThemes(page, "estadual", estadual);

  return { federal: [...federal], estadual: [...estadual], state };
}

export async function saveRadar(page: Page) {
  const profileResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/profile") && response.request().method() === "PUT",
    { timeout: 120_000 },
  );

  await page.getByTestId("salvar-radar-button").click();
  const response = await profileResponse;
  expect(response.status(), await response.text()).toBe(200);

  const payload = (await response.json()) as {
    profile?: {
      sentinelThemesFederal?: string[];
      sentinelThemesEstadual?: string[];
      state?: string;
    };
    sentinelRefreshSkipped?: boolean;
    sentinelRefreshMessage?: string | null;
  };

  return payload;
}

export async function goToMonitoramentoFromPrompt(page: Page) {
  const prompt = page.getByTestId("monitoramento-prompt");
  if (await prompt.isVisible().catch(() => false)) {
    await page.getByTestId("monitoramento-prompt-sim").click();
  } else {
    await page.goto("/monitoramento");
  }
  await expect(page.getByTestId("monitoramento-page")).toBeVisible({ timeout: 30_000 });
}

export async function fetchSentinelSuggestions(request: APIRequestContext) {
  const response = await request.get("/api/sentinel/suggestions");
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()) as {
    suggestions: MockSentinelSuggestion[];
    meta: SentinelSuggestionsMeta | null;
  };
}

export async function fetchProfile(request: APIRequestContext) {
  const response = await request.get("/api/profile");
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()) as {
    profile: {
      sentinelThemesFederal?: string[];
      sentinelThemesEstadual?: string[];
      state?: string;
    } | null;
  };
}

export async function refreshSentinelPautas(page: Page) {
  const refreshResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/sentinel/refresh") &&
      response.request().method() === "POST",
    { timeout: 300_000 },
  );

  await page.getByTestId("refresh-pautas-button").click();
  const response = await refreshResponse;
  expect(response.status(), await response.text()).toBe(200);

  const payload = (await response.json()) as {
    suggestions: MockSentinelSuggestion[];
    meta: SentinelSuggestionsMeta | null;
    skipped?: boolean;
    message?: string;
  };

  return payload;
}

/**
 * Após salvar temas o refresh roda em background. Preferimos o botão
 * Atualizar para ter resposta síncrona e assertions confiáveis.
 *
 * Nota: em Next 16, Playwright deve usar host permitido em
 * `allowedDevOrigins` (127.0.0.1) — senão a hidratação React falha.
 */
export async function waitForSentinelFeedAfterThemes(
  page: Page,
  request: APIRequestContext,
  options: { preferManualRefresh?: boolean } = {},
) {
  const preferManualRefresh = options.preferManualRefresh !== false;

  if (preferManualRefresh) {
    return refreshSentinelPautas(page);
  }

  const deadline = Date.now() + 240_000;
  let last = await fetchSentinelSuggestions(request);
  while (Date.now() < deadline) {
    if (last.suggestions.length > 0 && last.meta && !last.meta.cached) {
      return last;
    }
    await page.waitForTimeout(5_000);
    last = await fetchSentinelSuggestions(request);
  }
  return last;
}

export function assertFeedQualityFromApi(
  payload: {
    suggestions: MockSentinelSuggestion[];
    meta: SentinelSuggestionsMeta | null;
  },
  options?: { expectQualityRank?: boolean; minCards?: number },
) {
  const report = evaluateSentinelFeedQuality(
    { suggestions: payload.suggestions, meta: payload.meta },
    {
      expectQualityRank: options?.expectQualityRank,
      minCards: options?.minCards ?? 1,
    },
  );

  expect(
    report.ok,
    `Falhas de qualidade:\n- ${report.failures.join("\n- ")}\nstats=${JSON.stringify(report.stats)}`,
  ).toBe(true);

  return report;
}

export function assertSuggestionThemesWithinRadar(
  suggestions: MockSentinelSuggestion[],
  radarThemes: string[],
) {
  const allowed = new Set(radarThemes);
  const news = suggestions.filter(
    (item) => !(item.evidence.actors ?? []).some((actor) => actor.sourceList === "opposition"),
  );

  for (const suggestion of news) {
    const label = suggestion.themeLabel.trim();
    expect(
      allowed.has(label),
      `Card fora do radar configurado: themeLabel="${label}" topic="${suggestion.topic}"`,
    ).toBe(true);
  }
}
