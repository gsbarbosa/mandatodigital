export function computePostEngagement(likes: number, comments: number, shares: number) {
  return Math.max(0, likes + comments * 2 + shares * 3);
}

export type EngagementSample = {
  timestamp: Date | null;
  engagement: number;
};

/**
 * Compara engajamento dos posts das últimas 24h vs. janela anterior (24–48h).
 * Se não houver posts suficientes, usa o post mais recente vs. média dos 4 seguintes.
 */
export function computeEngagementGrowthPercent(samples: EngagementSample[]) {
  const dated = samples
    .filter((sample) => sample.timestamp && Number.isFinite(sample.timestamp.getTime()))
    .sort((left, right) => (right.timestamp?.getTime() ?? 0) - (left.timestamp?.getTime() ?? 0));

  if (dated.length === 0) {
    return 0;
  }

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const currentWindow = dated.filter(
    (sample) => now - (sample.timestamp?.getTime() ?? 0) <= dayMs,
  );
  const previousWindow = dated.filter((sample) => {
    const age = now - (sample.timestamp?.getTime() ?? 0);
    return age > dayMs && age <= dayMs * 2;
  });

  const currentEng = currentWindow.reduce((sum, row) => sum + row.engagement, 0);
  const previousEng = previousWindow.reduce((sum, row) => sum + row.engagement, 0);

  if (currentWindow.length > 0 && previousWindow.length > 0) {
    return growthFromValues(currentEng, previousEng);
  }

  if (dated.length >= 2) {
    const latest = dated[0]?.engagement ?? 0;
    const baseline =
      dated.slice(1, 5).reduce((sum, row) => sum + row.engagement, 0) /
      Math.max(1, Math.min(4, dated.length - 1));
    return growthFromValues(latest, baseline);
  }

  return 0;
}

function growthFromValues(current: number, previous: number) {
  if (previous <= 0) {
    return current > 0 ? 100 : 0;
  }

  return Math.round(((current - previous) / previous) * 100);
}

export function scoreSocialRelevance(input: {
  baseEngagement: number;
  growthPercent: number;
  sourceList: "interest" | "opposition";
  matchedThemeCount: number;
}) {
  let score = 20 + Math.min(40, Math.round(input.baseEngagement / 25));
  score += Math.min(25, Math.max(0, input.growthPercent / 4));
  score += input.matchedThemeCount * 8;

  if (input.sourceList === "opposition") {
    score += 10;
  }

  return Math.min(99, Math.max(12, score));
}
