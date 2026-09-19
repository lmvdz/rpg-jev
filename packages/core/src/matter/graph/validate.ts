/**
 * Rules as data, part four: checking a row without running it. A row that a model proposed is
 * untrusted. Before it is ever made ready it has to be plain data, name only quantities that
 * exist, write only to a state or a scratch pad, keep every level it writes between its bounds,
 * and leave alone the states that only the engine may move (how much of a thing there is, and
 * whether it burns). What this cannot see (whether the rule is true, whether it conserves) is
 * for the judge and for the invariant tests.
 */
import { FORMS, FRESH, PROPERTY_KEYS } from "../types.ts";
import { type Expr, OPS, ROOTS } from "./expr.ts";
import type { Rule } from "./rules.ts";

const PROPS: ReadonlySet<string> = new Set(PROPERTY_KEYS);
const FORM_SET: ReadonlySet<string> = new Set(FORMS);
const STATES: ReadonlySet<string> = new Set(Object.keys(FRESH));
const INNER: Record<string, ReadonlySet<string>> = {
  burning: new Set(["of", "fuel"]),
  coating: new Set(["element", "amount", "coverage", "bond"]),
};
const PLACE: ReadonlySet<string> = new Set([
  "temperature",
  "moisture",
  "wind",
  "air",
  "light",
  "noise",
  "cover",
]);
/** States that are levels, 0 to 5: whatever writes one must say so. */
const LEVELS: ReadonlySet<string> = new Set([
  "temperature",
  "wetness",
  "integrity",
  "edge",
  "contamination",
  "corrosion",
  "taint",
  "flaw",
]);
/** States a proposed row may not write: only the engine makes matter, fire and coats. */
const KEPT: ReadonlySet<string> = new Set(["amount", "burning", "coating", "wetWith"]);

/**
 * What a proposed row may still do to a kept state: put a fire out (never light one), and move
 * how well a coat is bonded or how much of the surface it covers (never what it is or how much).
 * Using a thing up is its own kind of effect, `use`, and it can only lessen.
 */
function mayWrite(key: string, inner: string, effect: Record<string, unknown>): boolean {
  if (key === "burning") return inner === "" && effect.kind === "put" && effect.value === null;
  return key === "coating" && (inner === "bond" || inner === "coverage");
}

export interface Allowed {
  /** The engine's own rows may move what a proposed row may not. */
  engine?: true;
  parties: readonly string[];
  act: readonly string[];
  derived: Readonly<Record<string, Expr>>;
}

function rowPath(rest: readonly string[]): boolean {
  const [kind = "", key = ""] = rest;
  if (kind === "p") return PROPS.has(key);
  if (kind === "is") return FORM_SET.has(key);
  return (kind === "moist" || kind === "id") && rest.length === 1;
}

const statePath = ([key = "", inner]: readonly string[]) =>
  STATES.has(key) && (inner === undefined || (INNER[key]?.has(inner) ?? false));

/** Whether what follows each root names something that exists. */
const KNOWN: Record<string, (rest: readonly string[], allowed: Allowed) => boolean> = {
  p: ([key = ""]) => PROPS.has(key),
  now: ([kind, key = ""]) => kind === "p" && PROPS.has(key),
  s: statePath,
  was: statePath,
  x: ([key = ""]) => /^[a-z][A-Za-z]*$/.test(key),
  b: ([key = ""]) => /^[a-z][A-Za-z]*$/.test(key),
  place: ([key = ""]) => PLACE.has(key),
  row: rowPath,
  coat: rowPath,
  wetWith: rowPath,
  act: ([key = ""], allowed) => allowed.act.includes(key),
  t: (rest) => rest.length === 0,
  d: ([key = ""], allowed) => key in allowed.derived,
};

function split(path: string, allowed: Allowed) {
  const segments = path.split(".");
  const named = !(ROOTS as readonly string[]).includes(segments[0] ?? "");
  const party = named ? segments.shift() : undefined;
  const [root = "", ...rest] = segments;
  const partyOk = party === undefined || allowed.parties.includes(party);
  return { root, rest, ok: partyOk && (KNOWN[root]?.(rest, allowed) ?? false) };
}

const MADE = ["emit", "split", "wound", "seal", "use"];
const CHANNELS = ["light", "sound", "scent", "smoke", "sight"];
const COND_KEYS = ["a", "is", "b", "has", "lacks", "ref", "equals", "same", "all", "any"];

class Checker {
  readonly problems: string[] = [];
  private readonly allowed: Allowed;
  private readonly where: string;

  constructor(allowed: Allowed, where: string) {
    this.allowed = allowed;
    this.where = where;
  }

  say(problem: string): undefined {
    this.problems.push(`${this.where}: ${problem}`);
  }

  path(path: unknown): undefined {
    if (typeof path !== "string" || !split(path, this.allowed).ok)
      this.say(`unknown quantity ${JSON.stringify(path)}`);
  }

  expr(e: unknown): undefined {
    if (typeof e === "number") {
      if (!Number.isFinite(e)) this.say("a number that is not finite");
      return;
    }
    if (typeof e === "string") return this.path(e);
    if (typeof e !== "object" || e === null)
      return this.say(`not an expression: ${JSON.stringify(e)}`);
    const node = e as Record<string, unknown>;
    if ("if" in node) {
      this.cond(node.if);
      this.expr(node.then);
      return this.expr(node.else);
    }
    if (typeof node.op !== "string" || !(node.op in OPS))
      return this.say(`unknown operator ${JSON.stringify(node.op)}`);
    if (!Array.isArray(node.of) || node.of.length === 0) return this.say(`${node.op} of nothing`);
    for (const arg of node.of) this.expr(arg);
  }

  cond(c: unknown): undefined {
    if (typeof c !== "object" || c === null)
      return this.say(`not a condition: ${JSON.stringify(c)}`);
    const node = c as Record<string, unknown>;
    const strange = Object.keys(node).filter((k) => !COND_KEYS.includes(k));
    if (strange.length > 0) return this.say(`a condition with ${strange.join(", ")}`);
    for (const key of ["all", "any"] as const) {
      if (!(key in node)) continue;
      if (!Array.isArray(node[key])) return this.say(`${key} of nothing`);
      for (const inner of node[key] as unknown[]) this.cond(inner);
      return;
    }
    for (const key of ["has", "lacks", "ref"] as const)
      if (key in node) return this.path(node[key]);
    if ("same" in node) {
      for (const path of Array.isArray(node.same) ? node.same : [null]) this.path(path);
      return;
    }
    if (!["<", "<=", ">", ">="].includes(node.is as string))
      return this.say(`unknown comparison ${JSON.stringify(node.is)}`);
    this.expr(node.a);
    this.expr(node.b);
  }

  /** What an effect writes: a scratch quantity, or a state it is allowed to move, within bounds. */
  target(effect: Record<string, unknown>): undefined {
    const q = effect.q;
    if (typeof q !== "string") return this.say("an effect on nothing");
    const { root, rest, ok } = split(q, this.allowed);
    if (!ok || (root !== "s" && root !== "x"))
      return this.say(`writes to ${JSON.stringify(q)}, which is not a state`);
    const [key = "", inner = ""] = rest;
    if (root === "s" && KEPT.has(key) && !this.allowed.engine && !mayWrite(key, inner, effect))
      this.say(`writes ${key}, which only the engine may`);
    // A coat's bond and its coverage are levels too; what it is and how much are not.
    const coat = key === "coating" && (inner === "bond" || inner === "coverage");
    const moves = effect.kind !== "put" && effect.kind !== "copy";
    const level = root === "s" && (LEVELS.has(key) || coat) && moves;
    if (level && !(effect.lo !== undefined && effect.hi !== undefined))
      this.say(`moves the level ${key} without bounds`);
  }

  /** The kinds that make something besides moving a state: each says what it rests on. */
  made(node: Record<string, unknown>): undefined {
    const party = node.kind === "wound" || node.kind === "seal" ? node.on : node.from;
    if (typeof party !== "string" || !this.allowed.parties.includes(party))
      this.say(`${String(node.kind)} names ${JSON.stringify(party)}, who is not there`);
    // Only the engine wounds a body: a proposed row may give something off, split a thing, or
    // use some of it up. None of those makes anything from nothing.
    if (["wound", "seal"].includes(node.kind as string) && !this.allowed.engine)
      this.say(`${node.kind}s a body, which only the engine may`);
    for (const key of ["strength", "amount", "depth", "bleeding", "burned"])
      if (node[key] !== undefined) this.expr(node[key]);
    if (typeof node.note !== "string" || !Array.isArray(node.because) || node.because.length === 0)
      this.say(`${String(node.kind)} does not say what it rests on`);
    if (node.kind === "emit" && !CHANNELS.includes(node.channel as string))
      this.say(`emits on ${JSON.stringify(node.channel)}, which is no channel`);
    if (node.kind !== "split") return;
    for (const [key, to] of Object.entries((node.state as Record<string, unknown>) ?? {})) {
      if (!STATES.has(key) || key === "amount") this.say(`a piece with ${key}`);
      if (typeof to !== "object" || to === null || !("value" in to)) this.expr(to);
    }
  }

  effect(e: unknown): undefined {
    if (typeof e !== "object" || e === null) return this.say("an effect that is not a record");
    const node = e as Record<string, unknown>;
    if (node.when !== undefined) this.cond(node.when);
    if (MADE.includes(node.kind as string)) return this.made(node);
    if (node.kind === "copy") this.path(node.of);
    if (!["approach", "accrue", "set", "put", "copy"].includes(node.kind as string))
      return this.say(`unknown kind of effect ${JSON.stringify(node.kind)}`);
    this.target(node);
    for (const key of ["toward", "rate", "to", "lo", "hi", "over"])
      if (node[key] !== undefined) this.expr(node[key]);
    const record = node.kind === "put" && typeof node.value === "object" && node.value !== null;
    if (record && !this.allowed.engine) this.say("puts a record, which only the engine may");
    if (Array.isArray(node.atLo)) for (const then of node.atLo) this.effect(then);
  }
}

/** What is wrong with a proposed rule, in words. Nothing: it may be made ready and tried. */
export function validate(rule: unknown, allowed: Allowed): string[] {
  const id = typeof (rule as Rule | null)?.id === "string" ? (rule as Rule).id : "a rule";
  const check = new Checker(allowed, id);
  try {
    if (JSON.stringify(JSON.parse(JSON.stringify(rule))) !== JSON.stringify(rule))
      check.say("does not survive JSON");
  } catch {
    check.say("is not data");
  }
  const r = rule as Partial<Rule> | null;
  if (!r || typeof r.says !== "string" || r.says.length < 10)
    check.say("does not say what it claims");
  if (r?.about !== undefined && !allowed.parties.includes(r.about))
    check.say(`is about ${r.about}, who is not there`);
  if (!Array.isArray(r?.first) || r.first.length === 0)
    return [...check.problems, `${id}: has no alternatives`];
  for (const alt of r.first) {
    if (alt.when !== undefined) check.cond(alt.when);
    if (Array.isArray(alt.effects)) for (const e of alt.effects) check.effect(e);
    else check.say("an alternative without effects");
    const cites =
      Array.isArray(alt.because) &&
      alt.because.every((b: string) => /^[A-Z]\d+$/.test(b) || FORM_SET.has(b));
    if (!cites) check.say("cites something that is not a vocabulary id");
    const moves =
      Array.isArray(alt.effects) &&
      alt.effects.some((e: { kind: string }) => !MADE.includes(e.kind));
    if (moves && (alt.because?.length ?? 0) === 0) check.say("acts and cites nothing");
  }
  return check.problems;
}

/** A factor is an expression laid on a quantity the base rows already name. */
export function validateFactor(
  name: string,
  expr: unknown,
  allowed: Allowed,
  base: object,
): string[] {
  const check = new Checker(allowed, `factor on d.${name}`);
  if (!(name in base)) check.say("is on a quantity the base rows do not name");
  check.expr(expr);
  return check.problems;
}

/** A derived quantity is checked as an expression over what is allowed. */
export function validateDerived(name: string, expr: unknown, allowed: Allowed): string[] {
  const check = new Checker(allowed, `d.${name}`);
  if (!/^[a-z][A-Za-z]*$/.test(name)) check.say("is not a name");
  check.expr(expr);
  return check.problems;
}
