type BrandLogoProps = {
  className?: string;
  width?: number;
  priority?: boolean;
  /** Preenche a largura do container pai. */
  fluid?: boolean;
};

const LOGO_WIDTH = 2139;
const LOGO_HEIGHT = 735;

export function BrandLogo({ className, width = 188, priority = false, fluid = false }: BrandLogoProps) {
  const height = Math.round((width * LOGO_HEIGHT) / LOGO_WIDTH);
  const fluidClassName = fluid ? "block h-auto w-full max-w-full" : undefined;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand-logo.svg"
      alt="Mandato Digital"
      width={fluid ? LOGO_WIDTH : width}
      height={fluid ? LOGO_HEIGHT : height}
      className={[fluidClassName, className].filter(Boolean).join(" ") || undefined}
      decoding="async"
      {...(priority ? { fetchPriority: "high" as const } : {})}
    />
  );
}
