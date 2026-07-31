import { describe, expect, it, vi, afterEach } from "vitest";

import { appLog, safeApiPath, summarizeError } from "./log";

describe("observability/log", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emite payload JSON com scope/event", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    appLog("heygen", "video_create_started", {
      profileId: "p1",
      generateMode: "photo_real",
    });
    expect(spy).toHaveBeenCalledOnce();
    const [line, payload] = spy.mock.calls[0] ?? [];
    expect(line).toBe("[heygen] video_create_started");
    expect(payload).toMatchObject({
      scope: "heygen",
      event: "video_create_started",
      profileId: "p1",
      generateMode: "photo_real",
    });
  });

  it("resume erros longos", () => {
    const summarized = summarizeError(new Error("x".repeat(500)));
    expect(summarized.length).toBeLessThanOrEqual(361);
  });

  it("remove querystring de paths", () => {
    expect(safeApiPath("/v1/video?token=abc")).toBe("/v1/video");
  });
});
