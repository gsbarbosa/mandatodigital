/**
 * Ícones de traço (line-art) do menu lateral — um por item, aderente ao
 * conceito do item (mesmo espírito visual: stroke fino, cantos arredondados).
 */
type IconProps = { className?: string };

const BASE_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
};

export function MonitoramentoIcon({ className }: IconProps) {
  return (
    <svg className={className} {...BASE_PROPS}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M7.5 9h5M7.5 12.5h9M7.5 16h9" />
      <path d="M14.5 9h2" />
    </svg>
  );
}

export function AvatarNavIcon({ className }: IconProps) {
  return (
    <svg className={className} {...BASE_PROPS}>
      <circle cx="12" cy="8.3" r="3.6" />
      <path d="M4.5 19.5c0-4.14 3.36-7.5 7.5-7.5s7.5 3.36 7.5 7.5" />
    </svg>
  );
}

export function CriativoIcon({ className }: IconProps) {
  return (
    <svg className={className} {...BASE_PROPS}>
      <path d="M12 3.5l1.4 3.2 3.3.4-2.4 2.3.6 3.3L12 11l-2.9 1.7.6-3.3-2.4-2.3 3.3-.4z" />
      <path d="M19 15.5l.7 1.6 1.6.2-1.2 1.1.3 1.6-1.4-.8-1.4.8.3-1.6-1.2-1.1 1.6-.2z" />
      <path d="M5 15.5l.6 1.3 1.4.2-1 .9.2 1.4-1.2-.7-1.2.7.2-1.4-1-.9 1.4-.2z" />
    </svg>
  );
}

export function PautaIndependenteIcon({ className }: IconProps) {
  return (
    <svg className={className} {...BASE_PROPS}>
      <path d="M13.5 3.5h-6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8z" />
      <path d="M13.5 3.5V8h5" />
      <path d="M12 12v5M9.5 14.5h5" />
    </svg>
  );
}

export function ComplianceIcon({ className }: IconProps) {
  return (
    <svg className={className} {...BASE_PROPS}>
      <path d="M12 3.3l6.5 2.4v5.1c0 4.5-2.8 7.6-6.5 8.9-3.7-1.3-6.5-4.4-6.5-8.9V5.7z" />
      <path d="M9.2 12.2l1.9 1.9 3.7-3.9" />
    </svg>
  );
}

export function AuditoriaIcon({ className }: IconProps) {
  return (
    <svg className={className} {...BASE_PROPS}>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M9.5 8.2l4-1M9 10.5h4M9.5 12.8l3-.6" />
      <path d="M15 15l5.2 5.2" />
    </svg>
  );
}

export function AcessoAntecipadoIcon({ className }: IconProps) {
  return (
    <svg className={className} {...BASE_PROPS}>
      <path d="M12 2.8c2.7 1.9 4.4 5.3 4.4 9 0 1.8-.8 3.5-1.8 4.6l-2.6 2.7-2.6-2.7c-1-1.1-1.8-2.8-1.8-4.6 0-3.7 1.7-7.1 4.4-9z" />
      <circle cx="12" cy="9.6" r="1.6" />
      <path d="M8.3 15.8l-2.4 2.4M15.7 15.8l2.4 2.4" />
    </svg>
  );
}

export function SuporteIcon({ className }: IconProps) {
  return (
    <svg className={className} {...BASE_PROPS}>
      <circle cx="12" cy="12" r="8.2" />
      <circle cx="12" cy="12" r="3.4" />
      <path d="M6.3 6.3l3.3 3.3M17.7 6.3l-3.3 3.3M6.3 17.7l3.3-3.3M17.7 17.7l-3.3-3.3" />
    </svg>
  );
}

export function GuiaIcon({ className }: IconProps) {
  return (
    <svg className={className} {...BASE_PROPS}>
      <path d="M6 3v18" />
      <path d="M6 4.5h10l-2.4 3 2.4 3H6" />
      <path d="M4 21h5" />
    </svg>
  );
}

export function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg className={className} {...BASE_PROPS} strokeWidth={2}>
      <path d="M5.5 8.5L12 15l6.5-6.5" />
    </svg>
  );
}
