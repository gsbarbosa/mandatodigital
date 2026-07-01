export function parsePlatformAdminEmails(): string[] {
  return (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function isPlatformAdminEmail(email: string | null | undefined): boolean {
  const normalized = email?.trim().toLowerCase() ?? "";
  if (!normalized) {
    return false;
  }

  const allowlist = parsePlatformAdminEmails();
  if (allowlist.length > 0) {
    return allowlist.includes(normalized);
  }

  return process.env.NODE_ENV !== "production";
}
