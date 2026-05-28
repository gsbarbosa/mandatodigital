"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { mvpPipelineSteps, type PipelineStepId } from "./shared";

function isCuradorPath(pathname: string) {
  return pathname === "/curador" || pathname.startsWith("/curador/");
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

export function WorkflowPipelineBar({ showMvpHint = false }: { showMvpHint?: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="workflow-pipeline" aria-label="Etapas do mandato digital">
      <ol className="workflow-pipeline-list">
        {mvpPipelineSteps.map((step, index) => {
          const active = step.enabled && isStepActive(pathname, step.id, step.href);
          const isLast = index === mvpPipelineSteps.length - 1;

          const inner = (
            <>
              <span className="workflow-pipeline-step-num" aria-hidden="true">
                {index + 1}
              </span>
              <span className="workflow-pipeline-step-label">{step.label}</span>
              {!step.enabled ? (
                <span className="workflow-pipeline-step-badge">Em breve</span>
              ) : null}
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
      {showMvpHint ? (
        <p className="workflow-pipeline-hint">MVP: somente a etapa Curador esta liberada.</p>
      ) : null}
    </nav>
  );
}
