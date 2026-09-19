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
/** States a proposed row may not write: only the engine makes and unmakes matter and fire. */
const KEPT: ReadonlySet<string> = new Set(["amount", "burning", "coating", "wetWith"]);

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
  return kind === "moist" && rest.length === 1;
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

const COND_KEYS = ["a", "is", "b", "has", "lacks", "ref", "equals", "all", "any"];

class Checker {
  readonly problems: string[] = [];
  private readonly allowed: Allowed;
  private readonly where: string;

  constructor(allowed: Allowed, where: string) {
    this.allowed = allowed;
    this.where = where;
  }

  say(problem: string) {
    this.problems.push(`${this.where}: ${problem}`);
  }

  path(path: unknown) {
    if (typeof path !== "string" || !split(path, this.allowed).ok)
      this.say(`unknown quantity ${JSON.stringify(path)}`);
  }

  expr(e: unknown): void {
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

  cond(c: unknown): void {
    if (typeof c !== "object" || c === null)
      return this.say(`not a condition: ${JSON.stringify(c)}`);
    const node = c as Record<string, unknown>;
    const strange = Object.keys(node).filter((k) => !COND_KEYS.includes(k));
    if (strange.length > 0) return this.say(`a condition with ${strange.join(", ")}`);
    for (const key of ["all", "any"] as const)
      if (key in node)
        return Array.isArray(node[key])
          ? (node[key] as unknown[]).forEach((x) => this.cond(x))
          : this.say(`${key} of nothing`);
    for (const key of ["has", "lacks", "ref"] as const)
      if (key in node) return this.path(node[key]);
    if (!["<", "<=", ">", ">="].includes(node.is as string))
      return this.say(`unknown comparison ${JSON.stringify(node.is)}`);
    this.expr(node.a);
    this.expr(node.b);
  }

  /** What an effect writes: a scratch quantity, or a state it is allowed to move, within bounds. */
  target(effect: Record<string, unknown>) {
    const q = effect.q;
    if (typeof q !== "string") return this.say("an effect on nothing");
    const { root, rest, ok } = split(q, this.allowed);
    if (!ok || (root !== "s" && root !== "x"))
      return this.say(`writes to ${JSON.stringify(q)}, which is not a state`);
    const [key = ""] = rest;
    if (root === "s" && KEPT.has(key) && !this.allowed.engine)
      this.say(`writes ${key}, which only the engine may`);
    const level = root === "s" && LEVELS.has(key) && effect.kind !== "put";
    if (level && !(effect.lo !== undefined && effect.hi !== undefined))
      this.say(`moves the level ${key} without bounds`);
  }

  effect(e: unknown): void {
    if (typeof e !== "object" || e === null) return this.say("an effect that is not a record");
    const node = e as Record<string, unknown>;
    if (!["approach", "accrue", "set", "put"].includes(node.kind as string))
      return this.say(`unknown kind of effect ${JSON.stringify(node.kind)}`);
    this.target(node);
    if (node.when !== undefined) this.cond(node.when);
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
      Array.isArray(alt.because) && alt.because.every((b: string) => /^[A-Z]\d+$/.test(b));
    if (!cites) check.say("cites something that is not a vocabulary id");
    if (Array.isArray(alt.effects) && alt.effects.length > 0 && (alt.because?.length ?? 0) === 0)
      check.say("acts and cites nothing");
  }
  return check.problems;
}

/** A derived quantity is checked as an expression over what is allowed. */
export function validateDerived(name: string, expr: unknown, allowed: Allowed): string[] {
  const check = new Checker(allowed, `d.${name}`);
  if (!/^[a-z][A-Za-z]*$/.test(name)) check.say("is not a name");
  check.expr(expr);
  return check.problems;
}
