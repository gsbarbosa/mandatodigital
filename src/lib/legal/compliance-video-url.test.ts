import { describe, expect, it } from "vitest";

import {
  extractComplianceStoragePathFromUrl,
  isGcsSignedUrlExpired,
} from "@/lib/legal/compliance-video-url";

describe("extractComplianceStoragePathFromUrl", () => {
  it("le path de URL GCS v4 do video selado", () => {
    const url =
      "https://storage.googleapis.com/madatodigital.firebasestorage.app/compliance/sealed/abc123.mp4?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Date=20260808T221909Z&X-Goog-Expires=604800&X-Goog-Signature=deadbeef";
    expect(extractComplianceStoragePathFromUrl(url)).toBe("compliance/sealed/abc123.mp4");
  });

  it("le path de URL do Firebase Storage", () => {
    const url =
      "https://firebasestorage.googleapis.com/v0/b/madatodigital.firebasestorage.app/o/compliance%2Fsealed%2Fabc123.mp4?alt=media&token=x";
    expect(extractComplianceStoragePathFromUrl(url)).toBe("compliance/sealed/abc123.mp4");
  });

  it("ignora URL que nao e do bucket de compliance", () => {
    expect(
      extractComplianceStoragePathFromUrl("https://files.heygen.ai/video/abc.mp4"),
    ).toBeNull();
    expect(
      extractComplianceStoragePathFromUrl(
        "https://storage.googleapis.com/other-bucket/avatars/x.mp4",
      ),
    ).toBeNull();
  });
});

describe("isGcsSignedUrlExpired", () => {
  it("detecta token vencido", () => {
    const url =
      "https://storage.googleapis.com/b/compliance/sealed/x.mp4?X-Goog-Date=20260808T221909Z&X-Goog-Expires=604800";
    expect(isGcsSignedUrlExpired(url, Date.parse("2026-08-17T00:17:56.000Z"))).toBe(true);
  });

  it("considera vigente dentro da janela", () => {
    const url =
      "https://storage.googleapis.com/b/compliance/sealed/x.mp4?X-Goog-Date=20260816T000000Z&X-Goog-Expires=604800";
    expect(
      isGcsSignedUrlExpired(url, Date.parse("2026-08-16T00:30:00.000Z"), 0),
    ).toBe(false);
  });
});
