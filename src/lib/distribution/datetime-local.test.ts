import { describe, expect, it } from "vitest";

import { datetimeLocalToIso, isoToDatetimeLocal } from "@/lib/distribution/datetime-local";

describe("datetime-local roundtrip", () => {
  it("preserva o horario local ao salvar e recarregar", () => {
    const local = "2026-08-16T21:18";
    const iso = datetimeLocalToIso(local);
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(isoToDatetimeLocal(iso!)).toBe(local);
  });

  it("converte ISO UTC de volta ao mesmo instante", () => {
    const iso = "2026-08-17T00:18:00.000Z";
    expect(datetimeLocalToIso(isoToDatetimeLocal(iso))).toBe(iso);
  });
});
