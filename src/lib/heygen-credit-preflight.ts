import { heygenGetUserMe } from "@/lib/heygen";

export const HEYGEN_PHOTO_IMAGE_VIDEO_RATE_PER_SECOND = 0.05;
export const HEYGEN_DIGITAL_TWIN_VIDEO_RATE_PER_SECOND = 0.0667;

export function countTranscriptWords(text: string) {
  return text
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function estimateSpeechSecondsFromWords(words: number) {
  return words / 2.5;
}

export function estimateHeyGenVideoCostUsd(input: {
  transcript: string;
  ratePerSecond: number;
}) {
  const words = countTranscriptWords(input.transcript);
  const seconds = estimateSpeechSecondsFromWords(words);
  return {
    words,
    seconds,
    estimatedCostUsd: seconds * input.ratePerSecond,
  };
}

export function buildHeyGenInsufficientCreditMessage(input: {
  remainingBalanceUsd: number;
  words: number;
  seconds: number;
  estimatedCostUsd: number;
  modeLabel: string;
}) {
  const balance = `US$ ${input.remainingBalanceUsd.toFixed(2)}`;
  const estimate = `US$ ${input.estimatedCostUsd.toFixed(2)}`;
  const duration = Math.ceil(input.seconds);

  return (
    `Saldo insuficiente na carteira da API (${balance}). ` +
    `Este roteiro tem ~${input.words} palavras (~${duration}s de fala) e o modo ${input.modeLabel} ` +
    `custa cerca de ${estimate}. ` +
    `Os créditos do plano web do HeyGen (ex.: US$ 8 no painel principal) não são usados pela API — ` +
    `recarregue em app.heygen.com → Settings → API → Add credits (pay-as-you-go), ` +
    `ou encurte o roteiro para ~${Math.max(
      1,
      Math.floor((input.remainingBalanceUsd / (input.estimatedCostUsd / Math.max(input.words, 1))) * input.words),
    )} palavras.`
  );
}

export async function checkHeyGenWalletForVideo(input: {
  transcript: string;
  ratePerSecond: number;
  modeLabel: string;
}) {
  const estimate = estimateHeyGenVideoCostUsd({
    transcript: input.transcript,
    ratePerSecond: input.ratePerSecond,
  });

  try {
    const me = await heygenGetUserMe();
    const remaining = Number(me.data?.wallet?.remaining_balance ?? 0);

    if (remaining > 0 && estimate.estimatedCostUsd > remaining) {
      return {
        ok: false as const,
        remainingBalanceUsd: remaining,
        estimate,
        message: buildHeyGenInsufficientCreditMessage({
          remainingBalanceUsd: remaining,
          words: estimate.words,
          seconds: estimate.seconds,
          estimatedCostUsd: estimate.estimatedCostUsd,
          modeLabel: input.modeLabel,
        }),
      };
    }

    if (remaining <= 0) {
      return {
        ok: false as const,
        remainingBalanceUsd: remaining,
        estimate,
        message: buildHeyGenInsufficientCreditMessage({
          remainingBalanceUsd: remaining,
          words: estimate.words,
          seconds: estimate.seconds,
          estimatedCostUsd: estimate.estimatedCostUsd,
          modeLabel: input.modeLabel,
        }),
      };
    }

    return {
      ok: true as const,
      remainingBalanceUsd: remaining,
      estimate,
    };
  } catch {
    return { ok: true as const, estimate };
  }
}
