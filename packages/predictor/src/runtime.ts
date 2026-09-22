/**
 * The world model at play time (milestone J): a frozen checkpoint as JSON weights, run in
 * TypeScript inside the server tick. No Python, no GPU, no I/O. It returns, per observation,
 * each channel's probabilities over its classes; the commit masks them to the envelope.
 *
 * A scorer has a deadline: past it, it returns null and the tick takes the code engine's
 * outcome (SPEC rule 2). It remembers the answer for an observation it has already scored,
 * keyed by the observation's exact bits, so a thing whose world has not changed costs a lookup.
 */
import * as jepa from "@rpg-jev/core/jepa";

export const RUNTIME_VERSION = "jepa-runtime-v1";

const THING = jepa.THING_FEATURES.length;
const PLACE = jepa.PLACE_FEATURES.length;
const ACT = jepa.ACT_FEATURES.length;
const HEAD = THING + PLACE + ACT;
const NB = jepa.NEIGHBOUR_FEATURES.length;
const CLASSES = jepa.CLASS_NAMES.length;

interface Dense {
  w: Float64Array;
  b: Float64Array;
  rows: number;
  cols: number;
}

export interface RuntimeModel {
  id: string;
  arm: "supervised" | "jepa";
  provenance: Record<string, unknown>;
  latent: number;
  self1: Dense;
  self2: Dense;
  neighbour: Dense;
  combine1: Dense;
  combine2: Dense;
  trunk?: [Dense, Dense];
  heads?: [Dense, Dense][];
  readout: Dense;
}

type Json = Record<string, unknown>;

function dense(input: unknown, rows: number, cols: number): Dense {
  const json = input as { weight?: unknown; bias?: unknown };
  const weight = json?.weight;
  const bias = json?.bias;
  if (
    !(Array.isArray(weight) && Array.isArray(bias)) ||
    weight.length !== rows ||
    bias.length !== rows
  )
    throw new Error("invalid layer shape");
  const w = new Float64Array(rows * cols);
  weight.forEach((row: unknown, r) => {
    if (!Array.isArray(row) || row.length !== cols) throw new Error("invalid layer row");
    row.forEach((v: unknown, c) => {
      if (typeof v !== "number" || !Number.isFinite(v)) throw new Error("invalid weight");
      w[r * cols + c] = v;
    });
  });
  const b = Float64Array.from(bias as number[]);
  if (b.some((v) => !Number.isFinite(v))) throw new Error("invalid bias");
  return { w, b, rows, cols };
}

/** Validate an exported checkpoint against the observation and outcome layouts in use. */
export function parseModel(input: unknown): RuntimeModel {
  const m = input as Json;
  if (m.version !== RUNTIME_VERSION) throw new Error("incompatible runtime version");
  if (m.observation !== jepa.OBSERVATION_VERSION || m.outcomes !== jepa.OUTCOMES_VERSION)
    throw new Error("checkpoint trained on another observation or outcome layout");
  const dims = m.dims as { latent: number; hidden: number; factors: number; factorDim: number };
  const l = m.layers as Json;
  const d = dims.latent;
  const model: RuntimeModel = {
    id: String(m.id),
    arm: m.arm === "jepa" ? "jepa" : "supervised",
    provenance: (m.provenance as Json) ?? {},
    latent: d,
    self1: dense(l.self1, dims.hidden, HEAD),
    self2: dense(l.self2, d, dims.hidden),
    neighbour: dense(l.neighbour, d, NB),
    combine1: dense(l.combine1, d, 2 * d),
    combine2: dense(l.combine2, d, d),
    readout: dense(l.readout, CLASSES, d),
  };
  if (model.arm === "jepa") {
    const h1 = l.heads1 as unknown[];
    const h2 = l.heads2 as unknown[];
    const hidden = (h1[0] as { bias: unknown[] }).bias.length;
    model.heads = h1.map((h, k) => [
      dense(h, hidden, d + ACT),
      dense(h2[k], dims.factorDim, hidden),
    ]);
  } else {
    const t1 = l.trunk1 as { bias: unknown[] };
    model.trunk = [dense(t1, t1.bias.length, d + ACT), dense(l.trunk2, d, t1.bias.length)];
  }
  return model;
}

/** out[r] = b[r] + sum_c w[r][c] * x[at + c]; relu when asked. */
function affine(l: Dense, x: Float64Array, at: number, out: Float64Array, relu: boolean): void {
  for (let r = 0; r < l.rows; r++) {
    let s = l.b[r] as number;
    const base = r * l.cols;
    for (let c = 0; c < l.cols; c++) s += (l.w[base + c] as number) * (x[at + c] as number);
    out[r] = relu && s < 0 ? 0 : s;
  }
}

interface Scratch {
  hidden: Float64Array;
  self: Float64Array;
  nb: Float64Array;
  pooled: Float64Array;
  both: Float64Array;
  z1: Float64Array;
  z: Float64Array;
  za: Float64Array;
  h: Float64Array;
  f: Float64Array;
  state: Float64Array;
  logits: Float64Array;
  /** A neighbour's own row, projected, by its quantised values: shared by every observer. */
  rows?: Map<string, Float64Array>;
  /** A thing's own row through the self layer, by its quantised values. */
  selves?: Map<string, Float64Array>;
}

/** Where a neighbour's own row starts inside its block (after present, relation, distance, role). */
const NB_HEAD = NB - THING;

function rowKey(x: Float64Array, at: number): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < THING; i++) {
    const q = Math.round((x[at + i] as number) * 1024);
    h1 = Math.imul(h1 ^ q, 16777619);
    h2 = Math.imul(h2 ^ (q + i * 2654435761), 2246822519);
  }
  return `${(h1 >>> 0).toString(36)}.${(h2 >>> 0).toString(36)}`;
}

/** The neighbour layer on one block, reusing the projection of the neighbour's own row. */
function neighbourBlock(m: RuntimeModel, x: Float64Array, at: number, s: Scratch): void {
  const l = m.neighbour;
  let row: Float64Array | undefined;
  if (s.rows) {
    const key = rowKey(x, at + NB_HEAD);
    row = s.rows.get(key);
    if (!row) {
      row = new Float64Array(l.rows);
      for (let r = 0; r < l.rows; r++) {
        let sum = 0;
        for (let c = NB_HEAD; c < l.cols; c++)
          sum += (l.w[r * l.cols + c] as number) * (x[at + c] as number);
        row[r] = sum;
      }
      if (s.rows.size > 50_000) s.rows.clear();
      s.rows.set(key, row);
    }
  }
  for (let r = 0; r < l.rows; r++) {
    let sum = l.b[r] as number;
    const base = r * l.cols;
    const cols = row ? NB_HEAD : l.cols;
    for (let c = 0; c < cols; c++) sum += (l.w[base + c] as number) * (x[at + c] as number);
    if (row) sum += row[r] as number;
    s.nb[r] = sum < 0 ? 0 : sum;
  }
}

function scratchFor(m: RuntimeModel): Scratch {
  const d = m.latent;
  const width = Math.max(m.self1.rows, m.trunk?.[0].rows ?? 0, m.heads?.[0]?.[0].rows ?? 0);
  return {
    hidden: new Float64Array(m.self1.rows),
    self: new Float64Array(d),
    nb: new Float64Array(d),
    pooled: new Float64Array(d),
    both: new Float64Array(2 * d),
    z1: new Float64Array(d),
    z: new Float64Array(d),
    za: new Float64Array(d + ACT),
    h: new Float64Array(width),
    f: new Float64Array(d),
    state: new Float64Array(d),
    logits: new Float64Array(CLASSES),
  };
}

/** The self layer, reusing the projection of the thing's own row (its first THING inputs). */
function selfLayer(m: RuntimeModel, x: Float64Array, s: Scratch): void {
  const l = m.self1;
  if (!s.selves) {
    affine(l, x, 0, s.hidden, true);
    return;
  }
  const key = rowKey(x, 0);
  let own = s.selves.get(key);
  if (!own) {
    own = new Float64Array(l.rows);
    for (let r = 0; r < l.rows; r++) {
      let sum = 0;
      for (let c = 0; c < THING; c++) sum += (l.w[r * l.cols + c] as number) * (x[c] as number);
      own[r] = sum;
    }
    if (s.selves.size > 50_000) s.selves.clear();
    s.selves.set(key, own);
  }
  for (let r = 0; r < l.rows; r++) {
    let sum = (l.b[r] as number) + (own[r] as number);
    const base = r * l.cols;
    for (let c = THING; c < l.cols; c++) sum += (l.w[base + c] as number) * (x[c] as number);
    s.hidden[r] = sum < 0 ? 0 : sum;
  }
}

function encode(m: RuntimeModel, x: Float64Array, s: Scratch): void {
  selfLayer(m, x, s);
  affine(m.self2, s.hidden, 0, s.self, false);
  s.pooled.fill(0);
  for (let i = 0; i < jepa.NEIGHBOURS; i++) {
    const at = HEAD + i * NB;
    if (x[at] !== 1) continue;
    neighbourBlock(m, x, at, s);
    for (let k = 0; k < m.latent; k++) s.pooled[k] = (s.pooled[k] as number) + (s.nb[k] as number);
  }
  s.both.set(s.self, 0);
  s.both.set(s.pooled, m.latent);
  affine(m.combine1, s.both, 0, s.z1, true);
  affine(m.combine2, s.z1, 0, s.z, false);
}

function head(m: RuntimeModel, x: Float64Array, s: Scratch): Float64Array {
  s.za.set(s.z, 0);
  s.za.set(x.subarray(THING + PLACE, HEAD), m.latent);
  if (m.trunk) {
    affine(m.trunk[0], s.za, 0, s.h, true);
    affine(m.trunk[1], s.h, 0, s.state, false);
    return s.state;
  }
  // JEPA: each factor's predictor, concatenated; the synthesis is folded into the readout.
  let at = 0;
  const part = new Float64Array(m.heads?.[0]?.[1].rows ?? 0);
  for (const [h1, h2] of m.heads ?? []) {
    affine(h1, s.za, 0, s.h, true);
    affine(h2, s.h, 0, part, false);
    s.f.set(part, at);
    at += part.length;
  }
  return s.f;
}

/** Each channel's probabilities over its classes, in `CLASS_NAMES` order. */
export function score(m: RuntimeModel, x: Float64Array, s: Scratch = scratchFor(m)): Float64Array {
  encode(m, x, s);
  affine(m.readout, head(m, x, s), 0, s.logits, false);
  const out = new Float64Array(CLASSES);
  jepa.CHANNELS.forEach((c, i) => {
    const o = jepa.CLASS_OFFSETS[i] ?? 0;
    let top = Number.NEGATIVE_INFINITY;
    for (let k = 0; k < c.classes.length; k++) top = Math.max(top, s.logits[o + k] as number);
    let sum = 0;
    for (let k = 0; k < c.classes.length; k++) {
      const e = Math.exp((s.logits[o + k] as number) - top);
      out[o + k] = e;
      sum += e;
    }
    for (let k = 0; k < c.classes.length; k++) out[o + k] = (out[o + k] as number) / sum;
  });
  return out;
}

/**
 * Observations are scored at the precision the model was trained at: its data was stored as half
 * floats, so a step of 1/1024 is below what it ever saw. Quantising first makes the score a pure
 * function of the quantised observation, and a thing drifting imperceptibly hits the memory.
 */
export const QUANTUM = 1024;

export function quantise(x: Float64Array, out = new Float64Array(x.length)): Float64Array {
  for (let i = 0; i < x.length; i++) out[i] = (((x[i] as number) * QUANTUM + 0.5) | 0) / QUANTUM;
  return out;
}

/**
 * The key of the quantised observation, without building it. Features are in [0, 1], so
 * adding a half and truncating rounds; the observation itself is quantised only on a miss.
 */
function quantisedKey(x: Float64Array): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < x.length; i++) {
    const q = ((x[i] as number) * QUANTUM + 0.5) | 0;
    h1 = Math.imul(h1 ^ q, 16777619);
    h2 = Math.imul(h2 + q, 2246822519) ^ i;
  }
  return `${(h1 >>> 0).toString(36)}.${(h2 >>> 0).toString(36)}`;
}

export interface ScorerStats {
  calls: number;
  scored: number;
  cached: number;
  late: number;
  lastMs: number;
}

export interface ScorerOptions {
  /** Past this many milliseconds a batch is abandoned and the tick falls back to code. */
  deadlineMs: number;
  /** A monotonic clock in milliseconds, from the host. */
  now: () => number;
  /** How many answers to remember. */
  cache?: number;
}

/** The model as the commit's `Scorer`, with a deadline and a memory of what it has seen. */
/** Whether `x` is bit for bit what the slot held last time; if not, the slot takes `x`. */
function sameAsBefore(x: Float64Array, slot: Float64Array): boolean {
  for (let i = 0; i < x.length; i++) {
    if (slot[i] !== x[i]) {
      slot.set(x);
      return false;
    }
  }
  return true;
}

export function scorerOf(
  m: RuntimeModel,
  options: ScorerOptions,
): jepa.Scorer & { stats: ScorerStats } {
  const scratch: Scratch = { ...scratchFor(m), rows: new Map(), selves: new Map() };
  const quantised = new Float64Array(jepa.OBSERVATION_WIDTH);
  const memory = new Map<string, Float64Array>();
  // The last observation and answer at each position: things come in the same order each tick.
  const slots: Float64Array[] = [];
  const answers: Float64Array[] = [];
  const limit = options.cache ?? 20_000;
  const stats: ScorerStats = { calls: 0, scored: 0, cached: 0, late: 0, lastMs: 0 };
  const lookup = (x: Float64Array): Float64Array => {
    const key = quantisedKey(x);
    let p = memory.get(key);
    if (p) stats.cached++;
    else {
      p = score(m, quantise(x, quantised), scratch);
      if (memory.size >= limit) memory.clear();
      memory.set(key, p);
      stats.scored++;
    }
    return p;
  };
  const run = (observations: readonly Float64Array[]) => {
    const started = options.now();
    stats.calls++;
    const out: Float64Array[] = [];
    for (let i = 0; i < observations.length; i++) {
      const x = observations[i] as Float64Array;
      let slot = slots[i];
      if (!slot) {
        slot = new Float64Array(x.length).fill(Number.NaN);
        slots[i] = slot;
      }
      const previous = answers[i];
      let p: Float64Array;
      if (sameAsBefore(x, slot) && previous) {
        p = previous;
        stats.cached++;
      } else p = lookup(x);
      answers[i] = p;
      out.push(p);
      if ((i & 31) === 31 && options.now() - started > options.deadlineMs) {
        stats.late++;
        stats.lastMs = options.now() - started;
        return null;
      }
    }
    stats.lastMs = options.now() - started;
    if (stats.lastMs > options.deadlineMs) {
      stats.late++;
      return null;
    }
    return out;
  };
  return Object.assign(run, { stats });
}
