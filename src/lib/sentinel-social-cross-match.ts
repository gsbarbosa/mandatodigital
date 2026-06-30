import type { MockSentinelSuggestion, SentinelNewsArticle } from "@/lib/sentinel-mock-suggestions";
import { attachEditorial } from "@/lib/sentinel-editorial-gate";
import { normalizeSentinelText } from "@/lib/sentinel-text";

const MIN_OVERLAP_WORDS = 2;
const MIN_OVERLAP_RATIO = 0.18;

function significantWords(text: string) {
  return normalizeSentinelText(text)
    .split(" ")
    .filter((word) => word.length >= 5);
}

export function correlationScore(left: string, right: string) {
  const leftWords = significantWords(left);
  const rightSet = new Set(significantWords(right));

  if (leftWords.length === 0 || rightSet.size === 0) {
    return 0;
  }

  let overlap = 0;
  for (const word of leftWords) {
    if (rightSet.has(word)) {
      overlap += 1;
    }
  }

  return overlap / Math.min(leftWords.length, rightSet.size);
}

function dedupeArticles(articles: SentinelNewsArticle[]) {
  const seen = new Set<string>();
  const result: SentinelNewsArticle[] = [];

  for (const article of articles) {
    const key = article.url.trim().toLowerCase();
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(article);
  }

  return result;
}

function countDistinctOutlets(articles: SentinelNewsArticle[]) {
  const hosts = new Set<string>();

  for (const article of articles) {
    const label = (article.sourceName ?? "").trim().toLowerCase();
    if (label && label !== "instagram") {
      hosts.add(label);
    }
  }

  return hosts.size;
}

export function correlateSocialSuggestionsWithRss(
  socialSuggestions: MockSentinelSuggestion[],
  rssSuggestions: MockSentinelSuggestion[],
) {
  const pressArticles = rssSuggestions.flatMap(
    (suggestion) => suggestion.evidence.articles ?? [],
  );

  if (pressArticles.length === 0) {
    return socialSuggestions;
  }

  return socialSuggestions.map((social) => {
    const socialText =
      social.evidence.articles?.[0]?.title?.trim() ||
      social.topic.replace(/^[^:]+:\s*/, "").trim();

    const correlated = pressArticles.filter((article) => {
      const score = correlationScore(socialText, article.title);
      const overlapWords = significantWords(socialText).filter((word) =>
        significantWords(article.title).includes(word),
      ).length;

      return score >= MIN_OVERLAP_RATIO || overlapWords >= MIN_OVERLAP_WORDS;
    });

    if (correlated.length === 0) {
      return social;
    }

    const mergedArticles = dedupeArticles([
      ...(social.evidence.articles ?? []),
      ...correlated,
    ]);
    const outletCount = Math.max(
      social.evidence.outletCount ?? 0,
      countDistinctOutlets(mergedArticles),
    );

    const boosted = attachEditorial(
      {
        ...social,
        evidence: {
          ...social.evidence,
          articles: mergedArticles,
          outletCount,
        },
      },
      {
        themeConfidence: 0.82,
        editorialRelevanceScore: Math.min(88, Math.max(social.relevanceScore, 65)),
        creativeWorthy: true,
        signalKind: "social_promoted",
        viralScore: social.editorial?.viralScore ?? social.relevanceScore,
        factualSummary: `Narrativa social correlacionada com ${outletCount} veículo(s) de imprensa.`,
        suggestedAngle:
          "Cruzar post viral com matérias da imprensa antes de montar resposta pública.",
        enrichedBy: "heuristic",
        enrichedAt: new Date().toISOString(),
      },
    );

    return boosted;
  });
}
