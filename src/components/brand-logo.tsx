type BrandLogoProps = {
  className?: string;
  width?: number;
  priority?: boolean;
  /** Preenche a largura do container pai. */
  fluid?: boolean;
};

const LOGO_WIDTH = 2096;
const LOGO_HEIGHT = 612;

/**
 * Logo adaptativa ao tema: variante on-dark (ícones claros) e on-light
 * (ícones/recortes escurecidos para fundo branco).
 */
export function BrandLogo({ className, width = 188, priority = false, fluid = false }: BrandLogoProps) {
  const height = Math.round((width * LOGO_HEIGHT) / LOGO_WIDTH);
  const sizeProps = fluid
    ? { width: LOGO_WIDTH, height: LOGO_HEIGHT }
    : { width, height };
  const fluidClassName = fluid ? "h-auto w-full max-w-full" : undefined;
  const sharedClass = ["brand-logo", fluidClassName, className].filter(Boolean).join(" ");
  const fetchPriority = priority ? ({ fetchPriority: "high" as const }) : {};

  return (
    <span className="brand-logo-wrap inline-block max-w-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand-logo-on-dark.png"
        alt="Mandato Digital"
        className={`${sharedClass} brand-logo-on-dark`}
        decoding="async"
        {...sizeProps}
        {...fetchPriority}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand-logo-on-light.png"
        alt=""
        aria-hidden="true"
        className={`${sharedClass} brand-logo-on-light`}
        decoding="async"
        {...sizeProps}
      />
    </span>
  );
}
