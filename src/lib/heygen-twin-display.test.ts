import { describe, expect, it } from "vitest";

import {
  isTwinLookReadyForVideo,
  resolveDigitalTwinTrainingPhase,
  resolveHeyGenTrainingPhase,
  trainingPhaseFromTwinLook,
  twinLookHasOperationalPreview,
} from "./heygen-twin-display";

describe("resolveHeyGenTrainingPhase", () => {
  it("marca pronto com status ready ou completed", () => {
    expect(
      resolveHeyGenTrainingPhase({
        mode: "digital_twin",
        consentStatus: "completed",
        groupStatus: "ready",
      }),
    ).toBe("ready");
    expect(
      resolveHeyGenTrainingPhase({
        mode: "digital_twin",
        consentStatus: "approved",
        groupStatus: "completed",
      }),
    ).toBe("ready");
  });

  it("marca pronto quando consentimento ok e status vazio", () => {
    expect(
      resolveHeyGenTrainingPhase({
        mode: "digital_twin",
        consentStatus: "completed",
        groupStatus: "",
      }),
    ).toBe("ready");
  });

  it("mantém processamento enquanto status indica fila", () => {
    expect(
      resolveHeyGenTrainingPhase({
        mode: "digital_twin",
        consentStatus: "completed",
        groupStatus: "processing",
      }),
    ).toBe("processing");
  });
});

describe("resolveDigitalTwinTrainingPhase", () => {
  it("promove processing para ready quando há look com consentimento aprovado", () => {
    expect(
      resolveDigitalTwinTrainingPhase({
        consentStatus: "completed",
        groupStatus: "processing",
        look: { id: "look-1" },
      }),
    ).toBe("ready");
  });
});

describe("isTwinLookReadyForVideo", () => {
  it("libera geração quando o look está pronto na HeyGen", () => {
    expect(
      isTwinLookReadyForVideo({
        id: "look-1",
        groupStatus: "ready",
        consentStatus: "approved",
      }),
    ).toBe(true);
  });

  it("bloqueia geração com consentimento pendente", () => {
    expect(
      isTwinLookReadyForVideo({
        id: "look-1",
        groupStatus: "processing",
        consentStatus: "pending",
      }),
    ).toBe(false);
  });

  it("libera geração com preview mesmo se status do grupo ainda for processing", () => {
    const look = {
      id: "look-1",
      groupStatus: "processing",
      consentStatus: "completed",
      preview_video_url: "https://cdn.heygen.com/preview.mp4",
    };
    expect(twinLookHasOperationalPreview(look)).toBe(true);
    expect(isTwinLookReadyForVideo(look)).toBe(true);
  });

  it("libera geração com consentimento ok mesmo sem preview quando grupo fica em processing", () => {
    expect(
      isTwinLookReadyForVideo({
        id: "look-1",
        groupStatus: "processing",
        consentStatus: "approved",
      }),
    ).toBe(true);
  });

  it("usa trainingPhaseFromTwinLook como alias", () => {
    expect(
      trainingPhaseFromTwinLook({
        id: "look-1",
        groupStatus: "ready",
        consentStatus: "completed",
      }),
    ).toBe("ready");
  });
});
