/**
 * Escolha do lote de disparo: embaralha e espalha UF para o envio não parecer
 * rajada para um mesmo estado (padrão que a Meta interpreta como spam).
 */

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let next = state;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash estável o bastante para seed (não é cripto). */
export function seedFromString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function shuffleInPlace<T>(items: T[], random: () => number): T[] {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    const current = items[index];
    const other = items[swap];
    if (current === undefined || other === undefined) continue;
    items[index] = other;
    items[swap] = current;
  }
  return items;
}

/**
 * Tira `size` itens do pool já embaralhado privilegiando UF ainda pouco
 * representada no lote. Se o pool é de um estado só, vira recorte simples.
 */
export function diversifyByUf<T extends { uf: string }>(pool: T[], size: number): T[] {
  const take = Math.min(Math.max(size, 0), pool.length);
  if (take === 0) return [];

  const remaining = [...pool];
  const picked: T[] = [];
  const counts = new Map<string, number>();

  while (picked.length < take && remaining.length > 0) {
    let bestIndex = 0;
    let bestCount = Number.POSITIVE_INFINITY;
    for (let index = 0; index < remaining.length; index += 1) {
      const uf = remaining[index]?.uf || "_";
      const count = counts.get(uf) ?? 0;
      if (count < bestCount) {
        bestCount = count;
        bestIndex = index;
        if (count === 0) break;
      }
    }
    const [next] = remaining.splice(bestIndex, 1);
    if (!next) break;
    picked.push(next);
    counts.set(next.uf || "_", (counts.get(next.uf || "_") ?? 0) + 1);
  }

  return picked;
}

export function pickDispatchBatch<T extends { uf: string }>(
  recipients: T[],
  size: number,
  seed: string,
): T[] {
  const shuffled = shuffleInPlace([...recipients], mulberry32(seedFromString(seed)));
  return diversifyByUf(shuffled, size);
}
