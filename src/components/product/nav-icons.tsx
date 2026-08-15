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

export function DistribuidorIcon({ className }: IconProps) {
  return (
    <svg className={className} {...BASE_PROPS}>
      <circle cx="6" cy="12" r="2.2" />
      <circle cx="18" cy="6.5" r="2.2" />
      <circle cx="18" cy="17.5" r="2.2" />
      <path d="M8.1 11.2l7.2-3.5M8.1 12.8l7.2 3.5" />
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

export function NationalIcon({ className }: IconProps) {
  return (
    <svg className={className} {...BASE_PROPS}>
      <circle cx="12" cy="12" r="7.7" />
      <path d="M12 4.3c2.4 2 3.8 4.8 3.8 7.7s-1.4 5.7-3.8 7.7c-2.4-2-3.8-4.8-3.8-7.7s1.4-5.7 3.8-7.7z" />
      <path d="M4.6 12h14.8" />
    </svg>
  );
}

export function StateIcon({ className }: IconProps) {
  return (
    <svg className={className} {...BASE_PROPS}>
      <path d="M4.5 6.5l5-2 5 2 5-2v13l-5 2-5-2-5 2z" />
      <path d="M9.5 4.5v13M14.5 6.5v13" />
    </svg>
  );
}

export function MunicipalIcon({ className }: IconProps) {
  return (
    <svg className={className} {...BASE_PROPS}>
      <path d="M5 20.5V8.5l4-2.5v14.5" />
      <path d="M13 20.5V4.5l6 3v13" />
      <path d="M7 11h.01M7 14.5h.01M15.5 9h.01M15.5 12.5h.01M15.5 16h.01" />
    </svg>
  );
}

export function InterestIcon({ className }: IconProps) {
  return (
    <svg className={className} {...BASE_PROPS}>
      <path d="M12 21V10" />
      <path d="M8.5 13a5 5 0 0 1 7 0M6 10.3a9 9 0 0 1 12 0" />
      <circle cx="12" cy="7.5" r="1.3" />
    </svg>
  );
}

export function AdversariosIcon({ className }: IconProps) {
  return (
    <svg className={className} {...BASE_PROPS}>
      <path d="M5 3.5v17M5 4.5h6l-1.8 3 1.8 3H5" />
      <path d="M19 20.5v-17M19 19.5h-6l1.8-3-1.8-3H19" />
    </svg>
  );
}

export function NoticiasDoDiaIcon({ className }: IconProps) {
  return (
    <svg className={className} {...BASE_PROPS}>
      <path d="M4.5 6.5h11a1.5 1.5 0 0 1 1.5 1.5v10a2 2 0 0 1-2 2h-9a1.5 1.5 0 0 1-1.5-1.5z" />
      <path d="M17 10.5h2.5v8a1.5 1.5 0 0 1-1.5 1.5" />
      <path d="M7.5 10h5M7.5 13h6.5M7.5 16h6.5" />
    </svg>
  );
}

export function GemeoDigitalIcon({ className }: IconProps) {
  return (
    <svg className={className} {...BASE_PROPS}>
      <path d="M4 9V6.5A2.5 2.5 0 0 1 6.5 4H9M15 4h2.5A2.5 2.5 0 0 1 20 6.5V9M20 15v2.5a2.5 2.5 0 0 1-2.5 2.5H15M9 20H6.5A2.5 2.5 0 0 1 4 17.5V15" />
      <circle cx="12" cy="10.6" r="2.3" />
      <path d="M8.3 16.3c.8-1.7 2.1-2.6 3.7-2.6s2.9.9 3.7 2.6" />
    </svg>
  );
}

export function CaricatoIcon({ className }: IconProps) {
  return (
    <svg className={className} {...BASE_PROPS}>
      <path d="M4.5 8.5c0-2.5 3-4.5 7.5-4.5s7.5 2 7.5 4.5c0 5-3 10-7.5 10s-7.5-5-7.5-10z" />
      <path d="M8.5 10.5c.5-.8 1.6-.8 2 0M13.5 10.5c.5-.8 1.6-.8 2 0" />
      <path d="M9.5 15c1.5 1 3.5 1 5 0" />
    </svg>
  );
}

export function Mascote3DIcon({ className }: IconProps) {
  return (
    <svg className={className} {...BASE_PROPS}>
      <path d="M12 4.5c4 0 6.5 3.3 6.5 7.5s-2.9 7.5-6.5 7.5-6.5-3.3-6.5-7.5S8 4.5 12 4.5z" />
      <path d="M9.3 11.5h.01M14.7 11.5h.01" strokeWidth={2.6} />
      <path d="M9.5 15c.8.6 1.7.9 2.5.9s1.7-.3 2.5-.9" />
    </svg>
  );
}

export function DadosPessoaisIcon({ className }: IconProps) {
  return (
    <svg className={className} {...BASE_PROPS}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <circle cx="9" cy="11.5" r="2" />
      <path d="M6.2 16c.5-1.6 1.8-2.5 2.8-2.5s2.3.9 2.8 2.5" />
      <path d="M14.5 10h3M14.5 13h3" />
    </svg>
  );
}

export function PlanosPrecosIcon({ className }: IconProps) {
  return (
    <svg className={className} {...BASE_PROPS}>
      <path d="M11.5 3.5h5.7a1.3 1.3 0 0 1 1.3 1.3v5.7a2 2 0 0 1-.6 1.4l-8 8a2 2 0 0 1-2.8 0l-5-5a2 2 0 0 1 0-2.8l8-8a2 2 0 0 1 1.4-.6z" />
      <circle cx="15.3" cy="8.7" r="1.3" />
    </svg>
  );
}

export function PagamentosIcon({ className }: IconProps) {
  return (
    <svg className={className} {...BASE_PROPS}>
      <path d="M6.5 3.5h11v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-1 .65z" />
      <path d="M9 8h6M9 11.5h6M9 15h4" />
    </svg>
  );
}

export function CnpjIcon({ className }: IconProps) {
  return (
    <svg className={className} {...BASE_PROPS}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="M7.5 15.5v-6l1.5-1 1.5 1v6z" />
      <path d="M14 9.5h3M14 12.5h3M14 15.5h2" />
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
