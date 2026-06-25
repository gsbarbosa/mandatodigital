import { describe, expect, it } from "vitest";

import {
  formatTwinLookDisplayName,
  isTwinLookReadyForVideo,
  resolveAvatarTrainingName,
  resolveDigitalTwinTrainingPhase,
  resolveHeyGenTrainingPhase,
  trainingPhaseFromTwinLook,
  twinGroupRequiresConsentLink,
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

  it("nao exige consentimento quando needsConsent e false", () => {
    expect(
      resolveHeyGenTrainingPhase({
        mode: "digital_twin",
        consentStatus: "pending",
        groupStatus: "processing",
        needsConsent: false,
      }),
    ).toBe("processing");
  });

  it("nao trava em awaiting_consent quando consentimento ja esta aprovado", () => {
    expect(
      resolveHeyGenTrainingPhase({
        mode: "digital_twin",
        consentStatus: "completed",
        groupStatus: "processing",
        consentUrl: "https://example.com/consent",
      }),
    ).toBe("processing");
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

  it("nao exige consentimento quando needsConsent e false mesmo com pending_consent", () => {
    expect(
      resolveHeyGenTrainingPhase({
        mode: "digital_twin",
        consentStatus: "pending",
        groupStatus: "pending_consent",
        needsConsent: false,
      }),
    ).toBe("processing");
  });
});

describe("twinGroupRequiresConsentLink", () => {
  it("exige link quando grupo esta em pending_consent", () => {
    expect(twinGroupRequiresConsentLink(null, "pending_consent")).toBe(true);
  });

  it("nao exige link quando consentimento ja foi aprovado", () => {
    expect(twinGroupRequiresConsentLink("completed", "pending_consent")).toBe(
      false,
    );
  });

  it("nao exige link quando grupo ja processa sem status pendente", () => {
    expect(twinGroupRequiresConsentLink(null, "processing")).toBe(false);
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

describe("resolveAvatarTrainingName", () => {
  it("ignora placeholder do perfil e usa cargo e cidade", () => {
    expect(
      resolveAvatarTrainingName({
        fullName: "Perfil em configuracao",
        role: "Vereador",
        city: "Campinas",
      }),
    ).toBe("Vereador — Campinas");
  });

  it("usa fallback amigavel quando nao ha dados", () => {
    expect(resolveAvatarTrainingName({ fullName: "Perfil em configuracao" })).toBe(
      "Gêmeo digital",
    );
  });
});

describe("formatTwinLookDisplayName", () => {
  it("remove sufixo digital twin e placeholder da plataforma", () => {
    expect(
      formatTwinLookDisplayName("Perfil em configuracao (digital twin)", {
        role: "Deputado",
        city: "SP",
      }),
    ).toBe("Deputado — SP");
  });
});
