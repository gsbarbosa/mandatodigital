import {
  formatHeyGenError,
  heygenDeleteAvatarGroup,
  heygenListAvatarGroups,
} from "@/lib/heygen";

export async function purgePrivateHeyGenAvatarGroups() {
  const response = await heygenListAvatarGroups({
    ownership: "private",
    limit: 50,
  });

  const groups = response.data ?? [];
  const deleted: string[] = [];
  const errors: Array<{ groupId: string; message: string }> = [];

  for (const group of groups) {
    const groupId = String(group.id ?? "").trim();
    if (!groupId) {
      continue;
    }

    try {
      await heygenDeleteAvatarGroup(groupId);
      deleted.push(groupId);
    } catch (error) {
      errors.push({
        groupId,
        message: formatHeyGenError(error),
      });
    }
  }

  return {
    deleted,
    errors,
    totalBefore: groups.length,
  };
}
