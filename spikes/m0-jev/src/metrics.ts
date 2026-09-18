import type { AnswerJson } from "./probe.ts";

export type Distribution = Record<string, number>;

/** A Noul becomes a two-outcome distribution so every answer is handled alike. */
export function distributionOf(answer: AnswerJson): Distribution {
  if (answer.type === "noul") return { yes: answer.noul, no: 1 - answer.noul };
  return answer.probabilities;
}

/** Shannon entropy divided by its maximum, so 0 is one peak and 1 is flat. */
export function spread(distribution: Distribution): number {
  const values = Object.values(distribution);
  if (values.length < 2) return 0;
  let entropy = 0;
  for (const p of values) if (p > 0) entropy -= p * Math.log(p);
  return entropy / Math.log(values.length);
}

/** Total variation distance: half the summed absolute difference, in [0, 1]. */
export function totalVariation(a: Distribution, b: Distribution): number {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let sum = 0;
  for (const key of keys) sum += Math.abs((a[key] ?? 0) - (b[key] ?? 0));
  return sum / 2;
}

export function meanDistribution(distributions: readonly Distribution[]): Distribution {
  const out: Distribution = {};
  for (const d of distributions) {
    for (const [key, p] of Object.entries(d)) out[key] = (out[key] ?? 0) + p / distributions.length;
  }
  return out;
}

export function topLabel(distribution: Distribution): string {
  let best = "";
  let bestP = Number.NEGATIVE_INFINITY;
  for (const key of Object.keys(distribution).sort()) {
    const p = distribution[key] ?? 0;
    if (p > bestP) {
      best = key;
      bestP = p;
    }
  }
  return best;
}

export function mean(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function std(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((a, v) => a + (v - m) ** 2, 0) / (values.length - 1));
}

export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index] as number;
}

/**
 * Probability that a random "positive" value exceeds a random "negative" one.
 * 1.0 means the two groups separate perfectly; 0.5 means no separation.
 */
export function auc(positives: readonly number[], negatives: readonly number[]): number {
  if (positives.length === 0 || negatives.length === 0) return Number.NaN;
  let wins = 0;
  for (const p of positives) {
    for (const n of negatives) {
      if (p > n) wins += 1;
      else if (p === n) wins += 0.5;
    }
  }
  return wins / (positives.length * negatives.length);
}

function ranks(values: readonly number[]): number[] {
  const order = values.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
  const out = new Array<number>(values.length).fill(0);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && order[j + 1]?.[0] === order[i]?.[0]) j++;
    // Tied values share the average of the ranks they span.
    for (let k = i; k <= j; k++) out[order[k]?.[1] as number] = (i + j) / 2 + 1;
    i = j + 1;
  }
  return out;
}

/** Spearman rank correlation, with tied values sharing a rank. */
export function spearman(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length || a.length < 3) return Number.NaN;
  const ra = ranks(a);
  const rb = ranks(b);
  const ma = mean(ra);
  const mb = mean(rb);
  let cov = 0;
  let va = 0;
  let vb = 0;
  for (let i = 0; i < ra.length; i++) {
    const da = (ra[i] as number) - ma;
    const db = (rb[i] as number) - mb;
    cov += da * db;
    va += da * da;
    vb += db * db;
  }
  return va > 0 && vb > 0 ? cov / Math.sqrt(va * vb) : Number.NaN;
}

/**
 * Sharpens a distribution before sampling: drop options under `cutoff`, raise
 * the rest to `power`, renormalise. The top option always survives.
 */
export function sharpen(distribution: Distribution, power: number, cutoff: number): Distribution {
  const top = topLabel(distribution);
  const kept = Object.entries(distribution).map(
    ([key, p]) => [key, key === top || p >= cutoff ? p ** power : 0] as const,
  );
  const total = kept.reduce((a, [, p]) => a + p, 0);
  return Object.fromEntries(kept.map(([key, p]) => [key, p / total]));
}

/** Mean, over outcomes, of the std of that outcome's probability across repeats. */
export function meanProbabilityStd(distributions: readonly Distribution[]): number {
  const keys = new Set(distributions.flatMap((d) => Object.keys(d)));
  const stds = [...keys].map((key) => std(distributions.map((d) => d[key] ?? 0)));
  return mean(stds);
}
