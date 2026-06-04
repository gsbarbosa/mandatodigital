"use client";

import type { MouseEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { mvpPipelineSteps, type PipelineStepId } from "./shared";

function isCuradorPath(pathname: string) {
  return (
    pathname === "/curador" ||
    pathname.startsWith("/curador/") ||
    pathname === "/curador-v1" ||
    pathname.startsWith("/curador-v1/") ||
    pathname === "/curador-v2" ||
    pathname.startsWith("/curador-v2/")
  );
}

function isStepActive(pathname: string, stepId: PipelineStepId, href: string | null) {
  if (stepId === "curador") {
    return isCuradorPath(pathname);
  }
  if (!href) {
    return false;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export const HEYGEN_DEV_SECRET_PIPELINE_STEP_ID = "distribuidor" as const;

type WorkflowPipelineBarProps = {
  /** Triplo clique no número da etapa Distribuidor (comando oculto HeyGen). */
  onDistribuidorSecretClick?: () => void;
};

export function WorkflowPipelineBar({
  onDistribuidorSecretClick,
}: WorkflowPipelineBarProps = {}) {
  const pathname = usePathname();

  function handleStepNumClick(stepId: string, event: MouseEvent) {
    if (stepId !== HEYGEN_DEV_SECRET_PIPELINE_STEP_ID || !onDistribuidorSecretClick) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    onDistribuidorSecretClick();
  }

  return (
    <nav className="workflow-pipeline" aria-label="Etapas do mandato digital">
      <ol className="workflow-pipeline-list">
        {mvpPipelineSteps.map((step, index) => {
          const active = step.enabled && isStepActive(pathname, step.id, step.href);
          const isLast = index === mvpPipelineSteps.length - 1;

          const isHeygenSecretStep = step.id === HEYGEN_DEV_SECRET_PIPELINE_STEP_ID;
          const inner = (
            <>
              <span
                className={[
                  "workflow-pipeline-step-num",
                  isHeygenSecretStep && onDistribuidorSecretClick
                    ? "is-secret-trigger"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-hidden={!isHeygenSecretStep}
                role={isHeygenSecretStep && onDistribuidorSecretClick ? "button" : undefined}
                tabIndex={isHeygenSecretStep && onDistribuidorSecretClick ? 0 : undefined}
                onClick={
                  isHeygenSecretStep && onDistribuidorSecretClick
                    ? (event) => handleStepNumClick(step.id, event)
                    : undefined
                }
                onKeyDown={
                  isHeygenSecretStep && onDistribuidorSecretClick
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onDistribuidorSecretClick();
                        }
                      }
                    : undefined
                }
              >
                {index + 1}
              </span>
              <span className="workflow-pipeline-step-label">{step.label}</span>
            </>
          );

          return (
            <li
              key={step.id}
              className={[
                "workflow-pipeline-item",
                active ? "is-active" : "",
                step.enabled ? "is-enabled" : "is-locked",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {step.enabled && step.href ? (
                <Link
                  href={step.href}
                  className="workflow-pipeline-step"
                  aria-current={active ? "step" : undefined}
                >
                  {inner}
                </Link>
              ) : (
                <span className="workflow-pipeline-step" aria-disabled="true">
                  {inner}
                </span>
              )}
              {!isLast ? <span className="workflow-pipeline-connector" aria-hidden="true" /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
