import type { SentinelSocialNetwork } from "@/lib/sentinel-mock-suggestions";

export function SentinelSocialIcon({
  network,
  className = "",
}: {
  network: SentinelSocialNetwork;
  className?: string;
}) {
  const shared = `${className} persona-sentinel-social-icon`.trim();

  if (network === "instagram") {
    return (
      <svg className={shared} viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3.5" y="3.5" width="17" height="17" rx="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="17.4" cy="6.6" r="1.2" fill="currentColor" />
      </svg>
    );
  }

  if (network === "tiktok") {
    return (
      <svg className={shared} viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M14.5 4.5c.4 2.2 1.8 3.8 4 4.2v3.2c-1.5.1-2.9-.4-4-1.2v5.8c0 3.4-2.8 5.8-6 5.3-2.5-.4-4.4-2.6-4.5-5.1-.2-3.1 2.2-5.6 5.2-5.6.5 0 1 .1 1.5.2v3.4c-.4-.2-.9-.4-1.4-.3-1.2.2-2 1.2-1.8 2.4.2 1 1.1 1.7 2.2 1.7 1.4 0 2.3-.9 2.3-2.5V4.5h2.5z"
          fill="currentColor"
        />
      </svg>
    );
  }

  return (
    <svg className={shared} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5.2 4.5h3.4l2.5 7.1L13.6 4.5H17l-4.8 12.7c-.5 1.3-1.5 2-2.8 2H6.8l1.1-3h2.5l3.8-10.2z"
        fill="currentColor"
      />
    </svg>
  );
}
