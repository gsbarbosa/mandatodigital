import {
  formatHeyGenError,
  heygenDeleteAvatarGroup,
  heygenListAvatarGroups,
} from "@/lib/heygen";

export async function deletePrivateHeyGenAvatarGroup(groupId: string) {
  const normalizedGroupId = String(groupId ?? "").trim();
  if (!normalizedGroupId) {
    return {
      deleted: [] as string[],
      errors: [{ groupId: "", message: "group_id ausente." }],
      totalBefore: 0,
    };
  }

  try {
    await heygenDeleteAvatarGroup(normalizedGroupId);
    return {
      deleted: [normalizedGroupId],
      errors: [] as Array<{ groupId: string; message: string }>,
      totalBefore: 1,
    };
  } catch (error) {
    return {
      deleted: [] as string[],
      errors: [
        {
          groupId: normalizedGroupId,
          message: formatHeyGenError(error),
        },
      ],
      totalBefore: 1,
    };
  }
}

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
