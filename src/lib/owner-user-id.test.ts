import { describe, expect, it } from "vitest";

import { toDatabaseOwnerUserId } from "./owner-user-id";

describe("toDatabaseOwnerUserId", () => {
  it("mantem uuid existente", () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    expect(toDatabaseOwnerUserId(uuid)).toBe(uuid);
  });

  it("converte uid do firebase em uuid valido", () => {
    const mapped = toDatabaseOwnerUserId("N7RR9WP1YbWPGIDcIk6jZD4B18J2");
    expect(mapped).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(toDatabaseOwnerUserId("N7RR9WP1YbWPGIDcIk6jZD4B18J2")).toBe(mapped);
  });
});
