import { describe, expect, it } from "vitest";

import { resolveActiveTwinGroupId } from "./heygen-avatar-refazer";

describe("resolveActiveTwinGroupId", () => {
  it("prioriza o group id salvo nas prefs", () => {
    expect(
      resolveActiveTwinGroupId({
        heygenAvatarGroupId: "group-prefs",
        selectedTwinLook: { id: "look-1", group_id: "group-selected" },
        linkedTwinLook: { id: "look-2", group_id: "group-linked" },
      }),
    ).toBe("group-prefs");
  });

  it("usa o look selecionado quando não ha group id nas prefs", () => {
    expect(
      resolveActiveTwinGroupId({
        heygenAvatarGroupId: "",
        selectedTwinLook: { id: "look-1", group_id: "group-selected" },
        linkedTwinLook: { id: "look-2", group_id: "group-linked" },
      }),
    ).toBe("group-selected");
  });

  it("cai no look vinculado como ultimo fallback", () => {
    expect(
      resolveActiveTwinGroupId({
        heygenAvatarGroupId: "",
        selectedTwinLook: null,
        linkedTwinLook: { id: "look-2", group_id: "group-linked" },
      }),
    ).toBe("group-linked");
  });
});
