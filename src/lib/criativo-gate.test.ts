import { describe, expect, it } from "vitest";

import { getCriativoGate, withGateReturnParam } from "./criativo-gate";

describe("getCriativoGate", () => {
  it("manda espectro vazio para Personalizar", () => {
    const gate = getCriativoGate({
      spectrum: "",
      hasVoiceAudio: true,
      hasPhotoAvatar: true,
      hasCaricaturePair: false,
    });
    expect(gate?.href).toBe("/curador#persona");
    expect(gate?.cta).toMatch(/Personalizar/i);
  });

  it("manda áudio ausente para treinar#audio", () => {
    const gate = getCriativoGate({
      spectrum: "centro",
      hasVoiceAudio: false,
      hasPhotoAvatar: true,
      hasCaricaturePair: false,
    });
    expect(gate?.href).toBe("/avatares/foto-real/treinar#audio");
    expect(gate?.cta).toBe("Configurar avatar");
  });

  it("manda foto/caricatura ausentes para treinar#foto", () => {
    const gate = getCriativoGate({
      spectrum: "centro",
      hasVoiceAudio: true,
      hasPhotoAvatar: false,
      hasCaricaturePair: false,
    });
    expect(gate?.href).toBe("/avatares/foto-real/treinar#foto");
  });

  it("libera quando espectro, áudio e foto estão ok", () => {
    expect(
      getCriativoGate({
        spectrum: "centro",
        hasVoiceAudio: true,
        hasPhotoAvatar: true,
        hasCaricaturePair: false,
      }),
    ).toBeNull();
  });

  it("libera com caricatura no lugar da foto", () => {
    expect(
      getCriativoGate({
        spectrum: "centro",
        hasVoiceAudio: true,
        hasPhotoAvatar: false,
        hasCaricaturePair: true,
      }),
    ).toBeNull();
  });
});

describe("withGateReturnParam", () => {
  it("insere o return antes do hash", () => {
    expect(withGateReturnParam("/curador#persona", "/criativo/novo")).toBe(
      "/curador?return=%2Fcriativo%2Fnovo#persona",
    );
  });

  it("preserva a query de origem, codificada", () => {
    expect(
      withGateReturnParam("/curador#persona", "/criativo/novo?tema=Educação"),
    ).toBe("/curador?return=%2Fcriativo%2Fnovo%3Ftema%3DEduca%C3%A7%C3%A3o#persona");
  });

  it("funciona em hrefs sem hash", () => {
    expect(withGateReturnParam("/avatares/foto-real/treinar", "/independente")).toBe(
      "/avatares/foto-real/treinar?return=%2Findependente",
    );
  });
});
