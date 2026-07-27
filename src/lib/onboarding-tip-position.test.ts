import { describe, expect, it } from "vitest";

import { boxesOverlap, placeOnboardingTip, type TipBox } from "./onboarding-tip-position";

const VIEWPORT = { width: 1440, height: 900 };
const TIP_WIDTH = 320;
const TIP_HEIGHT = 220;

/** Card central típico da página de temas (max-w-5xl dentro da área de conteúdo). */
const CARD: TipBox = { top: 200, left: 336, width: 1024, height: 420 };

function place(overrides: Partial<Parameters<typeof placeOnboardingTip>[0]> = {}) {
  return placeOnboardingTip({
    rect: CARD,
    placement: "auto",
    tipWidth: TIP_WIDTH,
    tipHeight: TIP_HEIGHT,
    viewport: VIEWPORT,
    ...overrides,
  });
}

function tipBox(point: { top: number; left: number }): TipBox {
  return { ...point, width: TIP_WIDTH, height: TIP_HEIGHT };
}

describe("placeOnboardingTip — laterais fixas", () => {
  it("esquerda encosta logo depois do menu lateral", () => {
    const point = place({ placement: "left" });
    // Menu w-64 (256px) + 16px de respiro.
    expect(point.left).toBe(272);
  });

  it("direita encosta na borda oposta", () => {
    const point = place({ placement: "right" });
    expect(point.left).toBe(VIEWPORT.width - 16 - TIP_WIDTH);
  });

  it("lateral alinha verticalmente com o alvo", () => {
    expect(place({ placement: "left" }).top).toBe(CARD.top);
    expect(place({ placement: "right" }).top).toBe(CARD.top);
  });

  it("lateral direita desvia da nota fixa de limites do plano", () => {
    // Nota de limites: right-6, centralizada verticalmente, ~240x120.
    const planNote: TipBox = { top: 390, left: 1176, width: 240, height: 120 };
    const point = place({ placement: "right", obstacles: [planNote] });
    expect(boxesOverlap(tipBox(point), planNote)).toBe(false);
  });

  it("lateral direita não invade o checklist do canto inferior", () => {
    const lowCard: TipBox = { top: 700, left: 336, width: 1024, height: 120 };
    const point = place({ placement: "right", rect: lowCard });
    const checklist: TipBox = { top: 620, left: 1060, width: 380, height: 280 };
    expect(boxesOverlap(tipBox(point), checklist)).toBe(false);
  });

  it("lateral sempre cabe na viewport", () => {
    for (const placement of ["left", "right"] as const) {
      for (const top of [-400, 0, 500, 2000]) {
        const point = place({ placement, rect: { ...CARD, top } });
        expect(point.top).toBeGreaterThanOrEqual(16);
        expect(point.top + TIP_HEIGHT).toBeLessThanOrEqual(VIEWPORT.height - 16);
        expect(point.left).toBeGreaterThanOrEqual(16);
        expect(point.left + TIP_WIDTH).toBeLessThanOrEqual(VIEWPORT.width - 16);
      }
    }
  });

  it("sem alvo na tela a lateral ainda é respeitada", () => {
    expect(place({ placement: "left", rect: null }).left).toBe(272);
    expect(place({ placement: "right", rect: null }).left).toBe(
      VIEWPORT.width - 16 - TIP_WIDTH,
    );
  });
});

describe("placeOnboardingTip — não cobre o conteúdo com a calha do shell", () => {
  // O ProductShell reserva 22rem (352px) do lado do tip em telas >= xl, então o
  // card da página encolhe e sobra espaço livre para o tip.
  const GUTTER = 352;
  const SIDEBAR = 256;

  it("esquerda: tip fica inteiro fora do card", () => {
    const cardLeft = SIDEBAR + GUTTER;
    const card: TipBox = {
      top: 200,
      left: cardLeft,
      width: VIEWPORT.width - cardLeft - 16,
      height: 420,
    };
    const point = place({ placement: "left", rect: card });
    expect(point.left + TIP_WIDTH).toBeLessThanOrEqual(card.left);
  });

  it("direita: tip fica inteiro fora do card", () => {
    const cardRight = VIEWPORT.width - GUTTER;
    const card: TipBox = {
      top: 200,
      left: SIDEBAR + 16,
      width: cardRight - SIDEBAR - 16,
      height: 420,
    };
    const point = place({ placement: "right", rect: card });
    expect(point.left).toBeGreaterThanOrEqual(card.left + card.width);
  });
});

describe("placeOnboardingTip — automático", () => {
  it("prefere ficar abaixo do alvo sem cobri-lo", () => {
    const shortCard: TipBox = { top: 120, left: 336, width: 1024, height: 200 };
    const point = place({ rect: shortCard });
    expect(point.top).toBe(shortCard.top + shortCard.height + 12);
    expect(boxesOverlap(tipBox(point), shortCard)).toBe(false);
  });

  it("respeita painéis fixos marcados na página", () => {
    const shortCard: TipBox = { top: 120, left: 336, width: 1024, height: 200 };
    const blocker: TipBox = { top: 300, left: 300, width: 500, height: 300 };
    const point = place({ rect: shortCard, obstacles: [blocker] });
    expect(boxesOverlap(tipBox(point), blocker)).toBe(false);
  });
});
