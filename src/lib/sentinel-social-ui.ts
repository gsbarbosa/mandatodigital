/** Flag pública para exibir UI de perfis sociais no radar (espelha SENTINEL_SOCIAL_ENABLED). */
export function isSentinelSocialUiEnabled() {
  const value = process.env.NEXT_PUBLIC_SENTINEL_SOCIAL_ENABLED?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}
