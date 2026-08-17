import { beforeEach, describe, expect, it, vi } from "vitest";

import { AsyncJobQuotaError } from "@/lib/async-jobs-enqueue";
import { getBlackoutWindow, ELECTION_DATE } from "@/lib/distribution/blackout";
import { publishDueScheduledPosts } from "@/lib/distribution/publish-scheduled";

const listScheduledDue = vi.fn();
const update = vi.fn();
const getByProfileId = vi.fn();
const enqueuePublishPostJob = vi.fn();

vi.mock("@/lib/distribution/post-storage", () => ({
  distributionPostStorage: {
    listScheduledDue: (...args: unknown[]) => listScheduledDue(...args),
    update: (...args: unknown[]) => update(...args),
  },
}));

vi.mock("@/lib/distribution/connection-storage", () => ({
  socialConnectionStorage: {
    getByProfileId: (...args: unknown[]) => getByProfileId(...args),
  },
}));

vi.mock("@/lib/distribution/enqueue-publish", () => ({
  enqueuePublishPostJob: (...args: unknown[]) => enqueuePublishPostJob(...args),
}));

function post(overrides: Record<string, unknown> = {}) {
  return {
    id: "post-1",
    ownerUserId: "owner-1",
    profileId: "profile-1",
    channels: ["instagram"],
    perChannelStatus: {},
    scheduledAt: "2026-03-01T12:00:00.000Z",
    ...overrides,
  };
}

// Fora da janela de blackout de 2026-10-04.
const SAFE_NOW = new Date("2026-03-01T12:05:00.000Z");

describe("publishDueScheduledPosts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getByProfileId.mockResolvedValue({ electionDate: null });
    enqueuePublishPostJob.mockResolvedValue({ jobId: "job-1" });
  });

  it("reenfileira o agendado vencido com scheduledAt null e dueAt do pacote", async () => {
    listScheduledDue.mockResolvedValue([post()]);

    const result = await publishDueScheduledPosts({ now: SAFE_NOW });

    expect(result.enqueued).toBe(1);
    expect(enqueuePublishPostJob).toHaveBeenCalledWith({
      ownerUserId: "owner-1",
      distributionPostId: "post-1",
      channels: ["instagram"],
      scheduledAt: null,
      dueAt: "2026-03-01T12:00:00.000Z",
    });
  });

  it("bloqueia quando o blackout entrou em vigor depois do Go", async () => {
    const window = getBlackoutWindow(ELECTION_DATE)!;
    const insideBlackout = new Date(window.start.getTime() + 60 * 60 * 1000);
    listScheduledDue.mockResolvedValue([post()]);

    const result = await publishDueScheduledPosts({ now: insideBlackout });

    expect(result.blocked).toBe(1);
    expect(enqueuePublishPostJob).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      "post-1",
      expect.objectContaining({ status: "blocked_blackout" }),
    );
  });

  it("respeita electionDate da conexao (pleito suplementar)", async () => {
    const suplementar = "2026-03-01";
    getByProfileId.mockResolvedValue({ electionDate: suplementar });
    listScheduledDue.mockResolvedValue([post()]);

    const result = await publishDueScheduledPosts({ now: SAFE_NOW });

    expect(result.blocked).toBe(1);
    expect(enqueuePublishPostJob).not.toHaveBeenCalled();
  });

  it("corrige o status do pacote ja publicado em vez de pular pra sempre", async () => {
    listScheduledDue.mockResolvedValue([
      post({ perChannelStatus: { instagram: { status: "published" } } }),
    ]);

    const result = await publishDueScheduledPosts({ now: SAFE_NOW });

    expect(result.skipped).toBe(1);
    expect(enqueuePublishPostJob).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      "post-1",
      expect.objectContaining({ status: "published" }),
    );
  });

  it("mantem o pacote agendado quando bate na quota (tenta no proximo tick)", async () => {
    listScheduledDue.mockResolvedValue([post()]);
    enqueuePublishPostJob.mockRejectedValue(new AsyncJobQuotaError("ja existe uma publicacao"));

    const result = await publishDueScheduledPosts({ now: SAFE_NOW });

    expect(result.skipped).toBe(1);
    expect(result.failed).toBe(0);
    expect(update).not.toHaveBeenCalled();
  });

  it("uma falha nao interrompe os demais pacotes", async () => {
    listScheduledDue.mockResolvedValue([post(), post({ id: "post-2" })]);
    enqueuePublishPostJob
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ jobId: "job-2" });

    const result = await publishDueScheduledPosts({ now: SAFE_NOW });

    expect(result.scanned).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.enqueued).toBe(1);
  });
});
