type AppSpinnerSize = "sm" | "md" | "lg";
type AppSpinnerVariant = "on-dark" | "brand";

const spinnerSizeClass: Record<AppSpinnerSize, string> = {
  sm: "app-spinner--sm",
  md: "app-spinner--md",
  lg: "app-spinner--lg",
};

/** Spinner acessível — use dentro de `AppLoadingStatus` ou botões. */
export function AppSpinner({
  size = "md",
  variant = "brand",
  className = "",
}: {
  size?: AppSpinnerSize;
  variant?: AppSpinnerVariant;
  className?: string;
}) {
  return (
    <span
      className={[
        "app-spinner",
        spinnerSizeClass[size],
        variant === "on-dark" ? "app-spinner--on-dark" : "app-spinner--brand",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden="true"
    />
  );
}

/** Linha compacta: spinner + mensagem (uploads, ações assíncronas). */
export function AppLoadingRow({
  message,
  size = "sm",
}: {
  message: string;
  size?: AppSpinnerSize;
}) {
  return (
    <span className="app-loading-row">
      <AppSpinner size={size} variant="on-dark" />
      <span>{message}</span>
    </span>
  );
}

/** Bloco de status para seções e fallbacks de Suspense. */
export function AppLoadingStatus({
  message,
  className = "",
}: {
  message: string;
  className?: string;
}) {
  return (
    <div
      className={["app-loading-status", className].filter(Boolean).join(" ")}
      role="status"
      aria-live="polite"
    >
      <AppSpinner size="md" variant="brand" />
      <p className="app-loading-status-message">{message}</p>
    </div>
  );
}

function SkeletonLine({ className = "" }: { className?: string }) {
  return <span className={["app-skeleton app-skeleton-line", className].filter(Boolean).join(" ")} />;
}

/** Placeholder de lista de criativos (Início / Meus criativos). */
export function CreativeListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <ul
      className="persona-creative-list persona-top-gap app-skeleton-list"
      aria-hidden="true"
    >
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="persona-creative-list-item app-skeleton-list-item">
          <div className="persona-creative-list-main app-skeleton-list-main">
            <SkeletonLine className="app-skeleton-line--title" />
            <SkeletonLine className="app-skeleton-line--meta" />
            <SkeletonLine className="app-skeleton-line--meta-short" />
          </div>
          <div className="app-skeleton-actions">
            <span className="app-skeleton app-skeleton-button" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Placeholder dos cards wireframe do Sentinela. */
export function SentinelSuggestionsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <ul className="persona-sentinel-wire-list persona-top-gap app-skeleton-list" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="persona-sentinel-wire-item app-skeleton-sentinel-item">
          <span className="app-skeleton app-skeleton-sentinel-score" />
          <div className="persona-sentinel-wire-card app-skeleton-sentinel-card">
            <div className="app-skeleton-sentinel-body">
              <SkeletonLine className="app-skeleton-line--title" />
              <SkeletonLine />
              <SkeletonLine className="app-skeleton-line--meta-short" />
            </div>
            <span className="app-skeleton app-skeleton-sentinel-action" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Retângulo pulsante para mídia (preview de asset, thumb). */
export function MediaPreviewSkeleton({ className = "" }: { className?: string }) {
  return (
    <span
      className={["app-skeleton app-skeleton-media", className].filter(Boolean).join(" ")}
      aria-hidden="true"
    />
  );
}
