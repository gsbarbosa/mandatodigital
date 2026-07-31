type BrandLogoProps = {
  className?: string;
  /** Altura do monograma em px — deve ≈ fontSize (cap-height óptica). */
  markSize?: number;
  /** Tamanho do wordmark em px. */
  fontSize?: number;
  /** Compat: largura total aproximada do lockup antigo. */
  width?: number;
  /** Mantido por compat; SVG inline não usa fetchPriority. */
  priority?: boolean;
  fluid?: boolean;
};

/** Monograma MD — viewBox 64×48, geometria do protótipo inicial. */
function MdMonogram({ size, className }: { size: number; className?: string }) {
  const height = size;
  const width = Math.round((size * 64) / 48);

  return (
    <svg
      viewBox="0 0 64 48"
      width={width}
      height={height}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={["brand-logo-mark shrink-0 block", className].filter(Boolean).join(" ")}
      style={{ width, height }}
    >
      <path fill="currentColor" d="M0 48V5L10 11V48H0z" />
      <path fill="currentColor" d="M13 48V17L23 10.5V48H13z" />
      <path fill="currentColor" d="M26 48V7.5L37 0V48H26z" />
      <path
        fill="#00B86B"
        d="M38.5 10H46A17 19 0 0 1 46 48H38.5V40.5H43.5A10 11 0 0 0 43.5 17.5H38.5V10Z"
      />
    </svg>
  );
}

/**
 * Marca Mandato Digital — Proposta 2 (geometria alinhada ao protótipo).
 * Mark e texto na mesma altura óptica; cores adaptam dark/light via CSS.
 */
export function BrandLogo({
  className,
  markSize,
  fontSize,
  width,
  fluid = false,
}: BrandLogoProps) {
  const resolvedFont =
    fontSize ??
    (width != null ? Math.max(14, Math.round(width * 0.1)) : fluid ? 16 : 15);
  const resolvedMark = markSize ?? resolvedFont;

  return (
    <span
      className={[
        "brand-logo inline-flex items-center gap-2",
        fluid ? "w-full max-w-full" : undefined,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Mandato Digital"
    >
      <MdMonogram size={resolvedMark} />
      <span
        className="whitespace-nowrap font-semibold tracking-tight leading-none"
        style={{ fontSize: resolvedFont, lineHeight: 1 }}
      >
        <span className="brand-logo-word-mandato">Mandato</span>{" "}
        <span className="brand-logo-word-digital">Digital</span>
      </span>
    </span>
  );
}

export { MdMonogram };
