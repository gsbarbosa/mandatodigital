import { expect, test } from "@playwright/test";

import { gotoCurador, saveAutotestProfile } from "./helpers";

test.describe("fluxo essencial Argil no Curador", () => {
  test("treina avatar em dry-run sem consumir creditos", async ({ page, request }) => {
    await saveAutotestProfile(request);

    await gotoCurador(page);

    const trainingUploads = Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes("/api/profile/training-assets") &&
          response.request().method() === "POST",
        { timeout: 30_000 },
      ),
      page.waitForResponse(
        (response) =>
          response.url().includes("/api/profile/training-assets") &&
          response.request().method() === "POST",
        { timeout: 30_000 },
      ),
    ]);

    await page.getByTestId("training-dataset-input").setInputFiles({
      name: "treino.mp4",
      mimeType: "video/mp4",
      buffer: Buffer.from("dummy-training-video"),
    });
    await page.getByTestId("training-consent-input").setInputFiles({
      name: "autorizacao.mp4",
      mimeType: "video/mp4",
      buffer: Buffer.from("dummy-consent-video"),
    });

    const [upload1, upload2] = await trainingUploads;
    expect(upload1.status()).toBe(201);
    expect(upload2.status()).toBe(201);

    const createResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/argil/avatars/train") &&
        response.request().method() === "POST",
      { timeout: 30_000 },
    );

    const trainButton = page.getByTestId("train-avatar-button");
    await trainButton.scrollIntoViewIfNeeded();
    await expect(trainButton).toBeEnabled({ timeout: 30_000 });
    await trainButton.click();

    const response = await createResponse;
    expect(response.status()).toBe(201);

    const payload = (await response.json()) as {
      dryRun?: boolean;
      training?: { id: string; status?: string };
    };

    expect(payload.dryRun).toBe(true);
    expect(payload.training?.id).toBeTruthy();

    await expect(page.getByTestId("argil-avatar-training-panel")).toBeVisible();
    await expect(page.getByTestId("argil-avatar-training-status")).toContainText("IDLE", {
      timeout: 20_000,
    });
  });

  test("gera um video por tema em dry-run sem consumir creditos", async ({
    page,
    request,
  }) => {
    await saveAutotestProfile(request);
    const topic = `[AUTOTEST] tema saude publica ${Date.now()}`;

    await gotoCurador(page);

    const topicField = page.getByTestId("avatar-video-topic");
    await topicField.scrollIntoViewIfNeeded();
    await topicField.fill(topic);

    const createResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/argil/videos") &&
        response.request().method() === "POST",
      { timeout: 30_000 },
    );

    const generateButton = page.getByTestId("generate-avatar-video-button");
    await generateButton.scrollIntoViewIfNeeded();
    await generateButton.click();

    const response = await createResponse;
    expect(response.status()).toBe(201);

    const payload = (await response.json()) as {
      dryRun?: boolean;
      generation?: { id: string; status?: string; topic?: string };
    };

    expect(payload.dryRun).toBe(true);
    expect(payload.generation?.id).toBeTruthy();
    expect(payload.generation?.topic).toBe(topic);

    await expect(page.getByTestId("argil-video-generation-panel")).toBeVisible();
    await expect(page.getByTestId("argil-video-status")).toContainText("DONE", {
      timeout: 20_000,
    });
    await expect(page.getByTestId("argil-video-final-link")).toBeVisible();
  });
});
