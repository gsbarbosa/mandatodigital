import { describe, expect, it, vi, afterEach } from "vitest";

import { appLog, buildAppLogEntry, safeApiPath, summarizeError } from "./log";

describe("observability/log", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emite uma linha JSON com severity/scope/event", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    appLog("heygen", "video_create_started", {
      profileId: "p1",
      generateMode: "photo_real",
    });
    expect(spy).toHaveBeenCalledOnce();
    const [line] = spy.mock.calls[0] ?? [];
    expect(typeof line).toBe("string");
    expect(String(line).includes("\n")).toBe(false);
    const payload = JSON.parse(String(line));
    expect(payload).toMatchObject({
      severity: "INFO",
      message: "[heygen] video_create_started",
      scope: "heygen",
      event: "video_create_started",
      profileId: "p1",
      generateMode: "photo_real",
    });
  });

  it("mapeia warn/error para WARNING/ERROR", () => {
    expect(buildAppLogEntry("client", "video_generate_failed", {}, "warn").severity).toBe(
      "WARNING",
    );
    expect(buildAppLogEntry("heygen", "train_failed", {}, "error").severity).toBe("ERROR");
  });

  it("resume erros longos", () => {
    const summarized = summarizeError(new Error("x".repeat(500)));
    expect(summarized.length).toBeLessThanOrEqual(361);
  });

  it("remove querystring de paths", () => {
    expect(safeApiPath("/v1/video?token=abc")).toBe("/v1/video");
  });
});
