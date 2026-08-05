import type { ReactNode } from "react";

const TITLE_CLASS =
  "text-2xl font-bold tracking-tight text-md-text md:text-3xl";

const DESCRIPTION_CLASS =
  "mt-2 max-w-2xl text-sm leading-relaxed text-md-text-soft";

type ProductPageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  /** Conteúdo à direita (CTAs, metadados). */
  actions?: ReactNode;
  className?: string;
  titleClassName?: string;
  /** Substitui integralmente as classes padrão da descrição (ex.: remover max-w-2xl). */
  descriptionClassName?: string;
  id?: string;
  "data-onboarding-anchor"?: string;
};

/** Título padrão das páginas do produto (shell). */
export function ProductPageHeader({
  title,
  description,
  actions,
  className = "",
  titleClassName = "",
  descriptionClassName,
  id,
  "data-onboarding-anchor": onboardingAnchor,
}: ProductPageHeaderProps) {
  const hasActions = Boolean(actions);

  return (
    <header
      id={id}
      data-onboarding-anchor={onboardingAnchor}
      className={
        hasActions
          ? `relative z-10 mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-start ${className}`.trim()
          : `relative z-10 mb-8 ${className}`.trim()
      }
    >
      <div className="min-w-0">
        <h1 className={`${TITLE_CLASS} ${titleClassName}`.trim()}>{title}</h1>
        {description ? (
          <div className={descriptionClassName ?? DESCRIPTION_CLASS}>{description}</div>
        ) : null}
      </div>
      {actions}
    </header>
  );
}

export const PRODUCT_PAGE_TITLE_CLASS = TITLE_CLASS;
export const PRODUCT_PAGE_DESCRIPTION_CLASS = DESCRIPTION_CLASS;
