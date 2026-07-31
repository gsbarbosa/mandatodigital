import { describe, expect, it } from "vitest";

import {
  pickCaricatureAsset,
  requireOwnedTrainingAsset,
  resolveCaricatureAsset,
} from "./training-asset-urls";
import type { ProfileTrainingAsset, TrainingAssetRole } from "./types";

function asset(
  id: string,
  role: TrainingAssetRole,
  createdAt = "2026-01-01T00:00:00.000Z",
): ProfileTrainingAsset {
  return {
    id,
    profileId: "p1",
    draftProfileId: null,
    sourceType: "upload",
    trainingRole: role,
    storageProvider: "firebase",
    storageBucket: null,
    storagePath: id,
    originalFilename: `${id}.bin`,
    mimeType: role === "voice_audio" ? "audio/mpeg" : "image/png",
    sizeBytes: 10,
    status: "uploaded",
    errorMessage: "",
    createdAt,
    updatedAt: createdAt,
  };
}

describe("requireOwnedTrainingAsset", () => {
  const assets = [
    asset("img-1", "avatar_image", "2026-01-01T00:00:00.000Z"),
    asset("img-2", "avatar_image", "2026-01-02T00:00:00.000Z"),
    asset("voice-1", "voice_audio"),
    asset("caric-editorial", "avatar_caricature", "2026-01-01T00:00:00.000Z"),
    asset("caric-3d", "avatar_caricature", "2026-01-03T00:00:00.000Z"),
  ];

  it("retorna o asset quando id e role batem", () => {
    const result = requireOwnedTrainingAsset(assets, {
      id: "img-1",
      role: "avatar_image",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.asset.id).toBe("img-1");
    }
  });

  it("falha se id estiver ausente (sem fallback para o mais recente)", () => {
    const result = requireOwnedTrainingAsset(assets, {
      id: "",
      role: "avatar_image",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.message).toMatch(/Selecione/i);
    }
  });

  it("falha se id não existir na lista do perfil", () => {
    const result = requireOwnedTrainingAsset(assets, {
      id: "outro-perfil",
      role: "voice_audio",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/não pertence/i);
    }
  });

  it("falha se o role não bater (ex.: pedir áudio com id de foto)", () => {
    const result = requireOwnedTrainingAsset(assets, {
      id: "img-2",
      role: "voice_audio",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/não é um/i);
    }
  });

  it("não troca caricatura editorial por 3D quando o id editorial é pedido", () => {
    const result = requireOwnedTrainingAsset(assets, {
      id: "caric-editorial",
      role: "avatar_caricature",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.asset.id).toBe("caric-editorial");
    }
    expect(pickCaricatureAsset(assets)?.id).toBe("caric-3d");
  });
});

describe("resolveCaricatureAsset", () => {
  const assets = [
    asset("caric-old", "avatar_caricature", "2026-01-01T00:00:00.000Z"),
    asset("caric-new", "avatar_caricature", "2026-01-02T00:00:00.000Z"),
  ];

  it("com id inválido retorna null (sem fallback silencioso)", () => {
    expect(resolveCaricatureAsset(assets, "inexistente")).toBeNull();
  });

  it("sem id retorna o mais recente (só para UI/listagem)", () => {
    expect(resolveCaricatureAsset(assets, null)?.id).toBe("caric-new");
  });
});
