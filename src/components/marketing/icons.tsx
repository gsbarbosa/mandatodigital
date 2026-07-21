import type { ReactNode, SVGProps } from "react";

import type { AgentAccent } from "@/lib/marketing/shared";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function IconBase({ size = 20, className, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  );
}

export function IconRadar(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 21a9 9 0 1 0-9-9" />
      <path d="M12 17a5 5 0 1 0-5-5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <path d="M12 3v2.5M21 12h-2.5" />
    </IconBase>
  );
}

export function IconPersona(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 19.5c1.5-3.2 4-4.8 7-4.8s5.5 1.6 7 4.8" />
      <path d="M16.5 7.5c.8-.9 1.2-1.8 1.2-2.8" />
    </IconBase>
  );
}

export function IconClapper(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3 9.5h18v9.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9.5Z" />
      <path d="M3 9.5 7.2 3.8a1.5 1.5 0 0 1 2-.4L21 9.5" />
      <path d="M8 4.5 6.2 9.5M12.5 5.8 10.7 10.8M17 7.2 15.2 12.2" />
    </IconBase>
  );
}

export function IconShieldCheck(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 3 5 6v5.5c0 4.2 2.8 7.4 7 8.5 4.2-1.1 7-4.3 7-8.5V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </IconBase>
  );
}

export function IconShareNodes(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="6" cy="12" r="2.2" />
      <circle cx="18" cy="6.5" r="2.2" />
      <circle cx="18" cy="17.5" r="2.2" />
      <path d="m8 11.2 7.2-3.5M8 12.8l7.2 3.5" />
    </IconBase>
  );
}

export function IconBolt(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M13 3 5.5 13.5h5L10 21l8-11h-5L13 3Z" />
    </IconBase>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M20 6.5 9.5 17 4 11.5" />
    </IconBase>
  );
}

export function IconClock(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </IconBase>
  );
}

export function IconFeed(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3.5" y="4" width="17" height="16" rx="2.5" />
      <path d="M7.5 8.5h9M7.5 12h9M7.5 15.5h6" />
    </IconBase>
  );
}

export function IconLayers(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m12 4 8 4-8 4-8-4 8-4Z" />
      <path d="m4 12 8 4 8-4" />
      <path d="m4 16 8 4 8-4" />
    </IconBase>
  );
}

export function IconUsers(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19c.9-2.8 2.9-4.2 5.5-4.2S13.6 16.2 14.5 19" />
      <circle cx="16.5" cy="8.5" r="2.4" />
      <path d="M15 14.8c2 .3 3.6 1.4 4.5 4.2" />
    </IconBase>
  );
}

export function IconGauge(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5.2 17.2A8.5 8.5 0 1 1 18.8 17.2" />
      <path d="M12 13.5 15.5 9" />
      <circle cx="12" cy="13.5" r="1.2" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

export function IconFingerprint(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 11.5v4.2" />
      <path d="M9.2 12.2c.3 2.2 1.2 3.8 2.8 5.3" />
      <path d="M14.8 12c-.2 2.6-1.1 4.3-2.8 5.8" />
      <path d="M7.2 10.8c.5-2.3 2.3-3.8 4.8-3.8s4.3 1.5 4.8 3.8" />
      <path d="M5.2 13.5c.4-4 3.2-6.8 6.8-6.8s6.4 2.8 6.8 6.8" />
    </IconBase>
  );
}

export function IconVolume(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 14V10h3.2L12 6.5v11L7.2 14H4Z" />
      <path d="M15.2 9.2a3.8 3.8 0 0 1 0 5.6" />
      <path d="M17.5 7a6.5 6.5 0 0 1 0 10" />
    </IconBase>
  );
}

export function IconZapFast(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M13 2.5 4.5 13.2h5.3L9.2 21.5 19.5 10.2h-5.5L13 2.5Z" />
    </IconBase>
  );
}

export function IconScale(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 4v16" />
      <path d="M8 20h8" />
      <path d="M5 8h14" />
      <path d="M7 8 4.5 14h5L7 8Z" />
      <path d="m17 8 2.5 6h-5L17 8Z" />
    </IconBase>
  );
}

export function IconMoon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M19 13.5A7.5 7.5 0 1 1 10.5 5 6 6 0 0 0 19 13.5Z" />
    </IconBase>
  );
}

export function IconSparkles(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 3.5 13.4 8.6 18.5 10 13.4 11.4 12 16.5 10.6 11.4 5.5 10 10.6 8.6 12 3.5Z" />
      <path d="m18.5 15.5.7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.3Z" />
    </IconBase>
  );
}

export function IconGavel(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m14 5 5 5" />
      <path d="m11.5 7.5 5 5" />
      <path d="M9 14 4.5 18.5" />
      <path d="M3.5 19.5h6" />
      <path d="m13 4 2.5 1-6 6-2.5-1L13 4Z" />
    </IconBase>
  );
}

export function IconSilence(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8 8 8 8" />
      <path d="M9 15.5h6" />
    </IconBase>
  );
}

export function IconReceipt(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M7 3.5h10v17l-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2V3.5Z" />
      <path d="M9.5 8h5M9.5 11.5h5M9.5 15h3.5" />
    </IconBase>
  );
}

export function IconLock(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </IconBase>
  );
}

export function IconFileCheck(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M14 3.5H8a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V9l-4-5.5Z" />
      <path d="M14 3.5V9h5" />
      <path d="m9.5 14 1.7 1.7 3.3-3.4" />
    </IconBase>
  );
}

export function IconScreenshot(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M7 8h1.5" />
    </IconBase>
  );
}

export function IconPix(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M8.5 7.5h7l3 4.5-3 4.5h-7l-3-4.5 3-4.5Z" />
      <path d="M10 10.5h4M10 13.5h2.5" />
    </IconBase>
  );
}

export function IconBarcode(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 6v12M8 6v12M10.5 6v12M14 6v12M16.5 6v12M19 6v12" />
    </IconBase>
  );
}

export function IconIdCard(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3.5" y="6" width="17" height="12" rx="2" />
      <circle cx="9" cy="12" r="2" />
      <path d="M13.5 10.5h4M13.5 13.5h3" />
    </IconBase>
  );
}

export function IconAlert(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 4 3.8 19h16.4L12 4Z" />
      <path d="M12 10v4" />
      <circle cx="12" cy="16.5" r="0.8" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

export function IconArrowRight(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </IconBase>
  );
}

export function IconInbox(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3.5 13.5 6 5.5h12l2.5 8" />
      <path d="M3.5 13.5H9l1.2 2h3.6l1.2-2h5.5v5a1.5 1.5 0 0 1-1.5 1.5h-14a1.5 1.5 0 0 1-1.5-1.5v-5Z" />
    </IconBase>
  );
}

export function IconOutbox(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 14V5.5" />
      <path d="m8.5 9 3.5-3.5L15.5 9" />
      <path d="M5 14.5v4a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5v-4" />
    </IconBase>
  );
}

/** Social marks — filled, monochrome (currentColor). */
function SocialBase({ size = 16, className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function IconInstagram(props: IconProps) {
  return (
    <SocialBase {...props}>
      <path d="M12 7.2A4.8 4.8 0 1 0 12 16.8 4.8 4.8 0 0 0 12 7.2Zm0 7.9a3.1 3.1 0 1 1 0-6.2 3.1 3.1 0 0 1 0 6.2Z" />
      <path d="M17.4 6.1a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2Z" />
      <path d="M12 3.5c-2.3 0-2.6 0-3.5.1-1.7.1-3.2 1.5-3.3 3.3-.1.9-.1 1.2-.1 3.5s0 2.6.1 3.5c.1 1.8 1.6 3.2 3.3 3.3.9.1 1.2.1 3.5.1s2.6 0 3.5-.1c1.7-.1 3.2-1.5 3.3-3.3.1-.9.1-1.2.1-3.5s0-2.6-.1-3.5c-.1-1.8-1.6-3.2-3.3-3.3-.9-.1-1.2-.1-3.5-.1Zm0 1.7c2.2 0 2.5 0 3.4.1 1 .1 1.5.6 1.6 1.6.1.9.1 1.1.1 3.3s0 2.5-.1 3.4c-.1 1-.6 1.5-1.6 1.6-.9.1-1.1.1-3.4.1s-2.5 0-3.4-.1c-1-.1-1.5-.6-1.6-1.6-.1-.9-.1-1.1-.1-3.4s0-2.5.1-3.4c.1-1 .6-1.5 1.6-1.6.9-.1 1.2-.1 3.4-.1Z" />
    </SocialBase>
  );
}

export function IconTikTok(props: IconProps) {
  return (
    <SocialBase {...props}>
      <path d="M19.2 8.4a6.2 6.2 0 0 1-3.6-1.2v7.1a5.5 5.5 0 1 1-4.7-5.4v2.5a3 3 0 1 0 2.1 2.9V3.5h2.3c.2 1.4 1.1 2.7 2.4 3.5.8.5 1.7.8 2.6.9v2.5c-.4 0-.7 0-1.1-.1Z" />
    </SocialBase>
  );
}

export function IconYouTube(props: IconProps) {
  return (
    <SocialBase {...props}>
      <path d="M21.6 7.8a2.6 2.6 0 0 0-1.8-1.9C18.2 5.5 12 5.5 12 5.5s-6.2 0-7.8.4A2.6 2.6 0 0 0 2.4 7.8 27.4 27.4 0 0 0 2 12a27.4 27.4 0 0 0 .4 4.2 2.6 2.6 0 0 0 1.8 1.9c1.6.4 7.8.4 7.8.4s6.2 0 7.8-.4a2.6 2.6 0 0 0 1.8-1.9A27.4 27.4 0 0 0 22 12a27.4 27.4 0 0 0-.4-4.2ZM10 15.2V8.8L15.5 12 10 15.2Z" />
    </SocialBase>
  );
}

export function IconX(props: IconProps) {
  return (
    <SocialBase {...props}>
      <path d="M16.8 4h2.5l-5.5 6.3L20.5 20h-5.2l-4-5.3L6.6 20H4.1l5.9-6.7L3.5 4h5.3l3.7 4.9L16.8 4Zm-.9 14.4h1.4L8.1 5.5H6.6l9.3 12.9Z" />
    </SocialBase>
  );
}

export function IconLinkedIn(props: IconProps) {
  return (
    <SocialBase {...props}>
      <path d="M6.3 9.2H3.6V20h2.7V9.2ZM4.9 4a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2ZM20.4 20h-2.7v-5.3c0-1.3 0-2.9-1.8-2.9s-2 1.4-2 2.8V20H11V9.2h2.6v1.5h.1c.4-.7 1.3-1.8 3.2-1.8 3.4 0 4 2.2 4 5.1V20Z" />
    </SocialBase>
  );
}

export function IconFacebook(props: IconProps) {
  return (
    <SocialBase {...props}>
      <path d="M14.5 20v-7.2h2.4l.4-2.8h-2.8V8.3c0-.8.2-1.4 1.4-1.4h1.5V4.4A20 20 0 0 0 14.8 4c-2.5 0-4.2 1.5-4.2 4.3v2.4H8v2.8h2.6V20h3.9Z" />
    </SocialBase>
  );
}

export function IconThreads(props: IconProps) {
  return (
    <SocialBase {...props}>
      <path d="M16.4 11.3c-.1-2.3-1.4-3.9-3.8-3.9-2.6 0-4.2 1.9-4.2 4.7 0 2.6 1.4 4.6 4.1 4.6 1.9 0 3.3-.8 3.9-2.1l-1.4-.7c-.4.8-1.2 1.3-2.4 1.3-1.6 0-2.6-1.2-2.6-3.1 0-1.9 1-3.1 2.6-3.1 1.3 0 2.1.7 2.3 1.9h-2.2v1.5h3.8c0-.1.1-.6.1-.9Zm2.8-.9c.2 1.1.2 2.2 0 3.2-.5 2.8-2.5 4.8-5.4 5.3-1 .2-2 .2-3 0-2.8-.5-4.8-2.5-5.3-5.4-.2-1-.2-2 0-3 .5-2.8 2.5-4.8 5.3-5.3 1-.2 2-.2 3 0 2.2.4 3.9 1.8 4.8 3.7l-1.6.8c-.6-1.4-1.8-2.4-3.5-2.7-.7-.1-1.5-.1-2.2 0-2.1.4-3.5 1.8-3.9 3.9-.1.7-.1 1.5 0 2.2.4 2.1 1.8 3.5 3.9 3.9.7.1 1.5.1 2.2 0 2.1-.4 3.5-1.8 3.9-3.9.1-.7.1-1.4 0-2.1h1.8Z" />
    </SocialBase>
  );
}

export const AGENT_ICONS: Record<AgentAccent, (props: IconProps) => ReactNode> = {
  sentinela: IconRadar,
  curador: IconPersona,
  criativo: IconClapper,
  auditor: IconShieldCheck,
  distribuidor: IconShareNodes,
};

export const SOCIAL_ICONS: Record<string, (props: IconProps) => ReactNode> = {
  Instagram: IconInstagram,
  TikTok: IconTikTok,
  YouTube: IconYouTube,
  X: IconX,
  LinkedIn: IconLinkedIn,
  Facebook: IconFacebook,
  Threads: IconThreads,
};

export function MarketingIconBadge({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${className}`}
      aria-hidden
    >
      {children}
    </div>
  );
}
