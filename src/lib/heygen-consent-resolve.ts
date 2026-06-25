import {
  formatHeyGenError,
  heygenCreateAvatarConsent,
  heygenGetAvatarGroup,
} from "@/lib/heygen";
import { isConsentApproved } from "@/lib/heygen-twin-display";

function isConsentAlreadyBoundError(error: unknown) {
  const message = formatHeyGenError(error).toLowerCase();
  return (
    message.includes("security code already binded") ||
    message.includes("already binded") ||
    message.includes("already bound")
  );
}

export async function resolveHeyGenAvatarConsentLink(input: {
  groupId: string;
  consentStatus?: string | null;
  rerouteUrl?: string;
  /** Treino novo: sempre solicita link mesmo sem status na API ainda */
  requireFreshLink?: boolean;
}) {
  const groupId = input.groupId.trim();
  if (!groupId) {
    throw new Error("group_id ausente para gerar link de consentimento.");
  }

  let consentStatus = input.consentStatus ?? null;

  if (!input.requireFreshLink && isConsentApproved(consentStatus)) {
    return {
      consentUrl: null as string | null,
      consentStatus,
      needsConsent: false,
    };
  }

  try {
    const consent = await heygenCreateAvatarConsent({
      groupId,
      rerouteUrl: input.rerouteUrl,
    });
    return {
      consentUrl: consent.consentUrl,
      consentStatus:
        consent.raw.data?.avatar_group?.consent_status ?? consentStatus,
      needsConsent: true,
    };
  } catch (error) {
    if (!isConsentAlreadyBoundError(error)) {
      throw error;
    }

    const group = await heygenGetAvatarGroup(groupId);
    consentStatus = group.data?.avatar_group?.consent_status ?? consentStatus;

    // Conta já vinculada na HeyGen: consentimento satisfeito mesmo se o grupo ainda
    // reportar pending_consent enquanto sincroniza.
    return {
      consentUrl: null,
      consentStatus: isConsentApproved(consentStatus)
        ? consentStatus
        : consentStatus || "completed",
      needsConsent: false,
    };
  }
}
