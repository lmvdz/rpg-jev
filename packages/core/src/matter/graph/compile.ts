/**
 * Rules as data, part three: making rows fast. `rules.ts` reads a row afresh every time, which
 * is the plain meaning of a row and forty times slower than the function it replaced. Here a
 * row is turned, once, into closures that do the same thing: paths are split once, operators
 * are looked up once, and a derived quantity is worked out once for each state it is read
 * against. The row stays the source of truth; a test holds this equal to `run`.
 */
import type { ThingState } from "../types.ts";
import { type Cond, type Env, type Expr, look, OPS } from "./expr.ts";
import type { Alternative, Effect, Ran, Rule } from "./rules.ts";

type Num = (env: Env) => number;
type Test = (env: Env) => boolean;

/**
 * Derived quantities worked out for one thing in one state. The memo rides on the env, which
 * is one thing's, and is dropped as soon as the state it was worked out against is replaced.
 */
function memoOf(env: Env): Map<string, number> {
  if (env.memo?.state !== env.s) env.memo = { state: env.s, values: new Map() };
  return env.memo.values;
}

const numberOf = (v: unknown): number => {
  if (typeof v === "number") return v;
  return v === true ? 1 : 0;
};

const COMPARE = {
  "<": (a: number, b: number) => a < b,
  "<=": (a: number, b: number) => a <= b,
  ">": (a: number, b: number) => a > b,
  ">=": (a: number, b: number) => a >= b,
} as const;

/** The operators over exactly two quantities, without an array between. Same answers as `OPS`. */
const PAIRS: Partial<Record<keyof typeof OPS, (a: number, b: number) => number>> = {
  add: (a, b) => a + b,
  mul: (a, b) => a * b,
  sub: (a, b) => a - b,
  div: (a, b) => a / b,
  min: (a, b) => Math.min(a, b),
  max: (a, b) => Math.max(a, b),
  pow: (a, b) => a ** b,
};

/** Paths that are read straight off the state or the effective properties, without a walk. */
function direct(path: string): ((env: Env) => unknown) | null {
  const [root, key = "", inner] = path.split(".");
  if (root === "t") return (env) => env.minutes;
  if (root === "p") return (env) => (env.p as unknown as Record<string, number>)[key] ?? 0;
  if (root !== "s") return null;
  if (inner === undefined) return (env) => (env.s as unknown as Record<string, unknown>)[key];
  return (env) => {
    const held = (env.s as unknown as Record<string, unknown>)[key];
    return typeof held === "object" && held !== null
      ? (held as Record<string, unknown>)[inner]
      : undefined;
  };
}

const PLACE_DEFAULTS: Record<string, number> = { air: 5, temperature: 2, moisture: 2, wind: 0 };

/** Which element a path is about, for the roots that read a row. */
const ROW_OF: Record<string, (env: Env) => string | null | undefined> = {
  row: (env) => env.thing.element,
  coat: (env) => env.s.coating?.element,
  wetWith: (env) => env.s.wetWith,
};

/** The roots that are not the state or the properties: the place, and rows. Split once. */
function elsewhere(path: string): (env: Env) => unknown {
  const [root = "", kind = "", key = ""] = path.split(".");
  if (root === "place") {
    const fallback = PLACE_DEFAULTS[kind] ?? 0;
    return (env) =>
      (env.place as unknown as Record<string, unknown> | undefined)?.[kind] ?? fallback;
  }
  const which = ROW_OF[root];
  if (!which) return (env) => look(env, path);
  if (kind === "p")
    return (env) =>
      (env.world.elements[which(env) ?? ""]?.props as Record<string, number> | undefined)?.[key] ??
      0;
  if (kind === "is")
    return (env) =>
      (env.world.elements[which(env) ?? ""]?.forms as readonly string[] | undefined)?.includes(
        key,
      ) ?? false;
  return (env) =>
    (env.world.elements[which(env) ?? ""] as unknown as Record<string, unknown> | undefined)?.[
      kind
    ] ?? 0;
}

export class Compiler {
  private readonly derived: Readonly<Record<string, Expr>>;
  private readonly made = new Map<string, Num>();

  constructor(derived: Readonly<Record<string, Expr>>) {
    this.derived = derived;
  }

  read(path: string): (env: Env) => unknown {
    if (path.startsWith("d.")) return this.node(path.slice(2));
    return direct(path) ?? elsewhere(path);
  }

  /** A derived quantity: compiled when first read, and worked out once per state. */
  private node(name: string): Num {
    return (env) => {
      const memo = memoOf(env);
      const known = memo.get(name);
      if (known !== undefined) return known;
      let fn = this.made.get(name);
      if (!fn) {
        fn = this.num(this.derived[name] ?? 0);
        this.made.set(name, fn);
      }
      const value = fn(env);
      memo.set(name, value);
      return value;
    };
  }

  num(expr: Expr): Num {
    if (typeof expr === "number") return () => expr;
    if (typeof expr === "string") {
      const get = this.read(expr);
      return (env) => numberOf(get(env));
    }
    if ("if" in expr) {
      const [test, then, otherwise] = [
        this.test(expr.if),
        this.num(expr.then),
        this.num(expr.else),
      ];
      return (env) => (test(env) ? then(env) : otherwise(env));
    }
    const args = expr.of.map((e) => this.num(e));
    const pair = PAIRS[expr.op];
    const [a, b] = args;
    if (pair && a && b && args.length === 2) return (env) => pair(a(env), b(env));
    const fn = OPS[expr.op];
    return (env) => fn(args.map((arg) => arg(env)));
  }

  test(cond: Cond): Test {
    if ("all" in cond) {
      const tests = cond.all.map((c) => this.test(c));
      return (env) => tests.every((t) => t(env));
    }
    if ("any" in cond) {
      const tests = cond.any.map((c) => this.test(c));
      return (env) => tests.some((t) => t(env));
    }
    if ("has" in cond || "lacks" in cond) {
      const get = this.read("has" in cond ? cond.has : cond.lacks);
      const wanted = "has" in cond;
      return (env) => {
        const v = get(env);
        return (v !== null && v !== undefined && v !== false) === wanted;
      };
    }
    if ("ref" in cond) {
      const get = this.read(cond.ref);
      return (env) => get(env) === cond.equals;
    }
    const [a, b, compare] = [this.num(cond.a), this.num(cond.b), COMPARE[cond.is]];
    return (env) => compare(a(env), b(env));
  }
}

interface Working {
  env: Env;
  spent: boolean;
}
type Step = (w: Working) => void;

function writer(path: string): (state: ThingState, value: unknown) => ThingState {
  const [, key = "", inner] = path.split(".");
  if (inner === undefined)
    return (state, value) => ({ ...state, [key]: value }) as unknown as ThingState;
  return (state, value) => {
    const held = (state as unknown as Record<string, unknown>)[key];
    if (typeof held !== "object" || held === null) return state;
    return { ...state, [key]: { ...held, [inner]: value } } as unknown as ThingState;
  };
}

function bounds(c: Compiler, e: Effect): (env: Env, value: number) => number {
  const lo = e.lo === undefined ? null : c.num(e.lo);
  const hi = e.hi === undefined ? null : c.num(e.hi);
  return (env, value) => {
    const floored = lo ? Math.max(lo(env), value) : value;
    return hi ? Math.min(hi(env), floored) : floored;
  };
}

type Build<K extends Effect["kind"]> = (c: Compiler, e: Extract<Effect, { kind: K }>) => Step;

/** The same closed set of kinds as `rules.ts`, each built once. */
const BUILD: { [K in Effect["kind"]]: Build<K> } = {
  approach: (c, e) => {
    const [from, to, rate, fit, put] = [
      c.num(e.q),
      c.num(e.toward),
      c.num(e.rate),
      bounds(c, e),
      writer(e.q),
    ];
    return (w) => {
      const was = from(w.env);
      const gone = 1 - Math.exp(-rate(w.env) * w.env.minutes);
      w.env.s = put(w.env.s, fit(w.env, was + (to(w.env) - was) * gone));
    };
  },
  accrue: (c, e) => {
    const [from, rate, fit, put] = [c.num(e.q), c.num(e.rate), bounds(c, e), writer(e.q)];
    const lo = e.lo === undefined ? null : c.num(e.lo);
    const atLo = e.atLo?.map((then) => step(c, then));
    return (w) => {
      const next = from(w.env) + rate(w.env) * w.env.minutes;
      const floor = lo ? lo(w.env) : Number.NEGATIVE_INFINITY;
      if (atLo && next <= floor + (e.eps ?? 0)) {
        for (const then of atLo) then(w);
        w.spent ||= e.spends === true;
        return;
      }
      w.env.s = put(w.env.s, fit(w.env, next));
    };
  },
  set: (c, e) => {
    const [to, fit, put] = [c.num(e.to), bounds(c, e), writer(e.q)];
    return (w) => {
      w.env.s = put(w.env.s, fit(w.env, to(w.env)));
    };
  },
  put: (_c, e) => {
    const put = writer(e.q);
    return (w) => {
      w.env.s = put(w.env.s, e.value);
    };
  },
};

function step(c: Compiler, effect: Effect): Step {
  const act = (BUILD[effect.kind] as Build<typeof effect.kind>)(c, effect);
  if (!effect.when) return act;
  const test = c.test(effect.when);
  return (w) => {
    if (test(w.env)) act(w);
  };
}

function alternative(c: Compiler, alt: Alternative) {
  return {
    when: alt.when ? c.test(alt.when) : null,
    steps: alt.effects.map((e) => step(c, e)),
    because: alt.because,
  };
}

/** One rule, ready to run: the same answer as `run(rule, env)`, without reading the row again. */
export function compileRule(c: Compiler, rule: Rule): (env: Env) => Ran {
  const alts = rule.first.map((a) => alternative(c, a));
  return (env) => {
    const alt = alts.find((a) => !a.when || a.when(env));
    if (!alt) return { set: {}, because: [] };
    const before = env.s as unknown as Record<string, unknown>;
    const w: Working = { env: { ...env }, spent: false };
    for (const s of alt.steps) s(w);
    const set: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(w.env.s)) if (value !== before[key]) set[key] = value;
    return {
      set: set as Partial<ThingState>,
      because: [...alt.because],
      ...(w.spent ? { spent: true } : {}),
    };
  };
}

export function compileRules(rules: readonly Rule[], derived: Readonly<Record<string, Expr>>) {
  const c = new Compiler(derived);
  return rules.map((rule) => compileRule(c, rule));
}
