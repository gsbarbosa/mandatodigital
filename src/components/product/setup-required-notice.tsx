"use client";

import Link from "next/link";
import type { Route } from "next";

type SetupRequiredNoticeProps = {
  message: string;
  href: string;
  actionLabel?: string;
};

export function SetupRequiredNotice({
  message,
  href,
  actionLabel = "Completar configuração",
}: SetupRequiredNoticeProps) {
  return (
    <div className="setup-required-notice" role="alert" data-testid="setup-required-notice">
      <p className="persona-helper-text persona-helper-highlight">{message}</p>
      <Link href={href as Route} className="persona-btn persona-btn-secondary">
        {actionLabel}
      </Link>
    </div>
  );
}
