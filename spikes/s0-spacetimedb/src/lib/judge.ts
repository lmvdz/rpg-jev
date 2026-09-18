// A fake judge. Never calls TypeSafe. Latency is lognormal, fitted to the two numbers
// M0 measured against jev-1.13.0: p50 163 ms and p99 462 ms.

const P50_MS = 163;
const P99_MS = 462;
const Z99 = 2.3263478740408408;
const MU = Math.log(P50_MS);
const SIGMA = Math.log(P99_MS / P50_MS) / Z99;

export type Rng = () => number;

/** mulberry32: small, seeded, good enough for a latency draw. */
export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function gaussian(rng: Rng): number {
  const u = Math.max(rng(), Number.MIN_VALUE);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function judgeLatencyMs(rng: Rng): number {
  return Math.exp(MU + SIGMA * gaussian(rng));
}

const OPTIONS = ["greet", "ignore", "none_of_these"] as const;

export type Judgment = { choice: string; judgeMs: number };

/** Resolves after a drawn latency. `judgeMs` is the time that really passed, timer lateness included. */
export function fakeJudge(rng: Rng): Promise<Judgment> {
  const drawn = judgeLatencyMs(rng);
  const started = performance.now();
  const choice = OPTIONS[Math.floor(rng() * OPTIONS.length)] ?? "none_of_these";
  return new Promise((resolve) => {
    setTimeout(() => resolve({ choice, judgeMs: performance.now() - started }), drawn);
  });
}
