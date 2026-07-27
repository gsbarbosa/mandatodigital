/**
 * Geometria do tip do onboarding guiado — pura, sem DOM, para ser testável.
 *
 * O coachmark mede o alvo e os painéis fixos da tela e delega a decisão aqui.
 * Passos com `placement: "left" | "right"` ficam grudados na lateral pedida
 * (a esquerda começa depois do menu); "auto" tenta abaixo → acima → direita
 * do alvo. O tip nunca fica à esquerda do alvo em modo "auto" — todo pop-up
 * do onboarding deve aparecer no lado direito da tela.
 */

import type { OnboardingTipPlacement } from "@/lib/onboarding";

export type TipBox = { top: number; left: number; width: number; height: number };
export type TipPoint = { top: number; left: number };

export type TipViewport = { width: number; height: number };

export type TipPositionInput = {
  /** Retângulo do alvo destacado, ou null quando o anchor não está na tela. */
  rect: TipBox | null;
  placement: OnboardingTipPlacement;
  tipWidth: number;
  tipHeight: number;
  viewport: TipViewport;
  /** Painéis fixos que não devem ser cobertos (data-onboarding-avoid). */
  obstacles?: TipBox[];
};

/** Largura do menu lateral (w-64) — a lateral esquerda começa depois dele. */
const SIDEBAR_WIDTH = 16 * 16;
const EDGE = 16;
const GAP = 12;
/** Reserva do checklist flutuante (canto inferior direito). */
const CHECKLIST_WIDTH = 380;
const CHECKLIST_HEIGHT = 280;

export function boxesOverlap(a: TipBox, b: TipBox): boolean {
  return (
    a.left < b.left + b.width &&
    a.left + a.width > b.left &&
    a.top < b.top + b.height &&
    a.top + a.height > b.top
  );
}

type Frame = {
  safeLeft: number;
  safeRight: number;
  safeTop: number;
  safeBottom: number;
};

function readFrame(viewport: TipViewport): Frame {
  return {
    safeLeft: Math.max(EDGE, SIDEBAR_WIDTH + EDGE),
    safeRight: viewport.width - EDGE,
    safeTop: EDGE,
    safeBottom: viewport.height - EDGE,
  };
}

function checklistBox(viewport: TipViewport): TipBox {
  return {
    top: viewport.height - CHECKLIST_HEIGHT,
    left: viewport.width - CHECKLIST_WIDTH,
    width: CHECKLIST_WIDTH,
    height: CHECKLIST_HEIGHT,
  };
}

/**
 * Fixa o tip na lateral pedida, escolhendo a faixa vertical livre mais próxima
 * do alvo (topo do alvo → centro do alvo → acima → abaixo → topo da tela).
 */
function placeOnSide(input: TipPositionInput, side: "left" | "right"): TipPoint {
  const { rect, tipWidth, tipHeight, viewport } = input;
  const frame = readFrame(viewport);

  const left =
    side === "left"
      ? frame.safeLeft
      : Math.max(frame.safeLeft, frame.safeRight - tipWidth);

  const maxTop = Math.max(frame.safeTop, frame.safeBottom - tipHeight);
  const clampTop = (top: number) => Math.min(Math.max(top, frame.safeTop), maxTop);

  const verticals = rect
    ? [
        rect.top,
        rect.top + rect.height / 2 - tipHeight / 2,
        rect.top - tipHeight - GAP,
        rect.top + rect.height + GAP,
        frame.safeTop,
      ]
    : [frame.safeTop];

  const blockers = [...(input.obstacles ?? [])];
  if (side === "right") {
    blockers.push(checklistBox(viewport));
  }

  const candidates = verticals.map(clampTop);
  for (const top of candidates) {
    const box: TipBox = { top, left, width: tipWidth, height: tipHeight };
    if (!blockers.some((blocker) => boxesOverlap(box, blocker))) {
      return { top, left };
    }
  }

  return { top: candidates[0], left };
}

/** Comportamento antigo: primeiro lugar livre fora do retângulo do alvo. */
function placeAwayFromTarget(input: TipPositionInput): TipPoint {
  const { rect, tipWidth, tipHeight, viewport, obstacles = [] } = input;
  const frame = readFrame(viewport);

  const dockFallback = {
    top: Math.max(EDGE, viewport.height - tipHeight - 24),
    left: Math.max(frame.safeLeft, frame.safeRight - tipWidth),
  };

  if (!rect) {
    return dockFallback;
  }

  const clampLeft = (left: number) =>
    Math.min(Math.max(left, frame.safeLeft), frame.safeRight - tipWidth);
  const clampTop = (top: number) =>
    Math.min(Math.max(top, EDGE), frame.safeBottom - tipHeight);

  const candidates = [
    // Abaixo do alvo
    { top: rect.top + rect.height + GAP, left: rect.left, score: 3 },
    // Acima do alvo
    { top: rect.top - tipHeight - GAP, left: rect.left, score: 2 },
    // À direita — nunca à esquerda: o tip só pode ficar do lado direito da tela.
    { top: rect.top, left: rect.left + rect.width + GAP, score: 1 },
  ];

  const fits = candidates
    .map((candidate) => ({
      score: candidate.score,
      top: clampTop(candidate.top),
      left: clampLeft(candidate.left),
    }))
    .filter((candidate) => {
      const box: TipBox = {
        top: candidate.top,
        left: candidate.left,
        width: tipWidth,
        height: tipHeight,
      };
      // Cabe na viewport
      if (
        box.top < 8 ||
        box.top + box.height > viewport.height - 8 ||
        box.left < 8 ||
        box.left + box.width > viewport.width - 8
      ) {
        return false;
      }
      // Não cobre o alvo nem os painéis fixos
      if (boxesOverlap(box, rect)) {
        return false;
      }
      if (boxesOverlap(box, checklistBox(viewport))) {
        return false;
      }
      return !obstacles.some((obstacle) => boxesOverlap(box, obstacle));
    })
    .sort((a, b) => b.score - a.score);

  return fits[0] ? { top: fits[0].top, left: fits[0].left } : dockFallback;
}

export function placeOnboardingTip(input: TipPositionInput): TipPoint {
  if (input.placement === "left" || input.placement === "right") {
    return placeOnSide(input, input.placement);
  }
  return placeAwayFromTarget(input);
}
