"use client";

type AppStatusToastProps = {
  message: string;
  variant: "success" | "error";
  onDismiss?: () => void;
};

export function AppStatusToast({ message, variant, onDismiss }: AppStatusToastProps) {
  return (
    <div
      className={`app-status-toast message-banner ${variant}`}
      role="status"
      aria-live="polite"
    >
      <span className="app-status-toast-text">{message}</span>
      {onDismiss ? (
        <button
          type="button"
          className="app-status-toast-dismiss"
          aria-label="Fechar aviso"
          onClick={onDismiss}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}
