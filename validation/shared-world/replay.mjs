/**
 * Offline simulation replay, NOT restoration of player/admission/receipt tables.
 * Node >=22.18: node validation/shared-world/replay.mjs <archive.jsonl> <NEW-report.json>
 * Reads only; never constructs ArchiveJournal (which opens a writer and lock).
 * Reports hashes/counts, never private world data, commands or credentials.
 */
import { createHash } from "node:crypto";
import { closeSync, fstatSync, openSync, readSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { apply } from "../../packages/core/src/matter/apply.ts";
import { Rng } from "../../packages/core/src/rng.ts";

export const LIMITS = Object.freeze({
  bytes: 1024 * 1024 * 1024,
  lineBytes: 1024 * 1024,
  events: 1_000_000,
  stateBytes: 16 * 1024 * 1024,
  depth: 64,
  milliseconds: 60_000,
});
class VerificationError extends Error {}
const check = (ok, code) => {
  if (!ok) throw new VerificationError(code);
};
const object = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const integer = (v) => Number.isSafeInteger(v) && v >= 0;
const text = (v) => typeof v === "string";
const strings = (v) => Array.isArray(v) && v.every(text);
const tile = (v) => Array.isArray(v) && v.length === 2 && v.every(Number.isSafeInteger);
const own = (map, id) => text(id) && Object.hasOwn(map, id);
const keys = (v, required, optional = []) => {
  check(object(v), "invalid-object");
  check(
    required.every((k) => Object.hasOwn(v, k)),
    "missing-field",
  );
  check(
    Object.keys(v).every((k) => [...required, ...optional].includes(k)),
    "unknown-field",
  );
};
const equal = (a, b, code) => check(isDeepStrictEqual(a, b), code);
const digest = (v) => createHash("sha256").update(JSON.stringify(v)).digest("hex");

// Reject non-finite numbers, prototype-shaped keys and pathological nesting even
// in parts of the vocabulary that apply does not inspect.
function safeJSON(value, depth = 0) {
  check(depth <= LIMITS.depth, "json-depth-limit");
  if (typeof value === "number") check(Number.isFinite(value), "nonfinite-number");
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      check(!["__proto__", "constructor", "prototype"].includes(key), "unsafe-key");
      safeJSON(child, depth + 1);
    }
  }
}
function parse(text) {
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new VerificationError("invalid-json");
  }
  safeJSON(value);
  return value;
}
function rngState(rng) {
  check(
    Array.isArray(rng) &&
      rng.length === 4 &&
      rng.every((n) => Number.isInteger(n) && n >= -0x80000000 && n <= 0x7fffffff),
    "invalid-rng",
  );
}
const stateNumbers = [
  "temperature",
  "wetness",
  "surfaceAbove",
  "integrity",
  "edge",
  "contamination",
  "corrosion",
  "taint",
  "amount",
  "flaw",
  "temper",
];
function thingState(state, partial = false) {
  const fields = [...stateNumbers, "wetWith", "burning", "coating", "set"];
  keys(state, partial ? [] : fields, partial ? fields : []);
  for (const field of stateNumbers)
    if (field in state) check(Number.isFinite(state[field]), "invalid-thing-state");
  if ("set" in state) check(typeof state.set === "boolean", "invalid-thing-state");
  if ("wetWith" in state)
    check(state.wetWith === null || text(state.wetWith), "invalid-thing-state");
  for (const field of ["burning", "coating"])
    if (field in state) check(state[field] === null || object(state[field]), "invalid-thing-state");
}
function wound(value, partial = false) {
  keys(
    value,
    partial ? [] : ["depth", "bleeding", "burned"],
    partial ? ["depth", "bleeding", "burned"] : [],
  );
  check(Object.values(value).every(Number.isFinite), "invalid-wound");
}
function body(value, partial = false) {
  const required = ["id", "place", "needs", "health", "wounds", "sickness", "sickensIn"];
  const optional = [
    "where",
    "element",
    "attention",
    "aware",
    "wetness",
    "wears",
    "tolerates",
    "home",
    "holds",
    "feels",
    "rank",
    "doing",
  ];
  keys(
    value,
    partial ? [] : required,
    partial ? [...required.filter((k) => !["id", "wounds"].includes(k)), ...optional] : optional,
  );
  for (const field of ["health", "sickness", "sickensIn", "wetness", "tolerates", "rank"])
    if (field in value) check(Number.isFinite(value[field]), "invalid-body-number");
  for (const field of ["id", "place", "element", "doing"])
    if (field in value) check(text(value[field]), "invalid-body-string");
  if ("where" in value) check(tile(value.where), "invalid-tile");
  for (const field of ["holds", "wears"])
    if (field in value) check(strings(value[field]), "invalid-body-items");
  if ("needs" in value)
    check(
      object(value.needs) && Object.values(value.needs).every(Number.isFinite),
      "invalid-needs",
    );
  if ("wounds" in value) {
    check(Array.isArray(value.wounds), "invalid-wounds");
    for (const valueWound of value.wounds) wound(valueWound);
  }
  if ("attention" in value)
    check(["alert", "distracted", "asleep"].includes(value.attention), "invalid-attention");
  if ("aware" in value) check(object(value.aware), "invalid-percepts");
}
function thing(value, world) {
  keys(value, ["id", "element", "place", "state"], ["where"]);
  check(
    text(value.id) && own(world.elements, value.element) && own(world.places, value.place),
    "invalid-thing-reference",
  );
  if ("where" in value) check(tile(value.where), "invalid-tile");
  thingState(value.state);
}
function validateState(state) {
  keys(state, ["version", "world", "rng", "tick"]);
  check(state.version === 1 && integer(state.tick), "invalid-state");
  rngState(state.rng);
  const world = state.world;
  keys(world, ["elements", "things", "bodies", "places", "next"], ["bonds"]);
  check(integer(world.next), "invalid-world-counter");
  for (const field of ["elements", "things", "bodies", "places"])
    check(object(world[field]), "invalid-world-map");
  for (const field of ["elements", "things", "bodies", "places"])
    for (const [id, row] of Object.entries(world[field]))
      check(object(row) && row.id === id, "invalid-world-id");
  for (const value of Object.values(world.things)) thing(value, world);
  for (const value of Object.values(world.bodies)) {
    body(value);
    check(own(world.places, value.place), "invalid-body-place");
    if (value.element !== undefined)
      check(own(world.elements, value.element), "invalid-body-element");
    for (const id of value.holds ?? []) check(own(world.things, id), "missing-held-thing");
  }
  for (const place of Object.values(world.places)) {
    check(object(place.abundance) && object(place.searched), "invalid-place");
    for (const value of Object.values(place.searched))
      check(
        object(value) && Number.isFinite(value.minutes) && integer(value.found),
        "invalid-search",
      );
  }
  check(Buffer.byteLength(JSON.stringify(state)) <= LIMITS.stateBytes, "state-size-limit");
}
const changeFields = {
  state: ["thing", "set"],
  body: ["body", "set"],
  wound: ["body", "wound"],
  treat: ["body", "index", "set"],
  create: ["thing"],
  consume: ["thing", "amount"],
  carried: ["thing", "where"],
  signal: ["place", "channel", "strength"],
  percept: ["body", "aware"],
  settle: ["place", "element", "minutes", "found"],
  nothing: [],
};
function validateChange(c, world) {
  check(object(c) && Object.hasOwn(changeFields, c.kind), "invalid-change-kind");
  keys(
    c,
    ["kind", "because", "note", ...changeFields[c.kind]],
    c.kind === "signal" ? ["quiet", "source"] : ["quiet"],
  );
  check(
    strings(c.because) && text(c.note) && (!("quiet" in c) || c.quiet === true),
    "invalid-change-metadata",
  );
  if ("body" in c) check(own(world.bodies, c.body), "missing-change-body");
  if (["state", "consume", "carried"].includes(c.kind))
    check(own(world.things, c.thing), "missing-change-thing");
  if ("place" in c) check(own(world.places, c.place), "missing-change-place");
  switch (c.kind) {
    case "state":
      thingState(c.set, true);
      break;
    case "body":
      body(c.set, true);
      break;
    case "wound":
      wound(c.wound);
      break;
    case "treat":
      check(
        integer(c.index) && c.index < world.bodies[c.body].wounds.length,
        "invalid-wound-index",
      );
      wound(c.set, true);
      break;
    case "create":
      thing(c.thing, world);
      break;
    case "consume":
      check(Number.isFinite(c.amount) && c.amount > 0, "invalid-consumption");
      break;
    case "carried":
      check(tile(c.where), "invalid-tile");
      break;
    case "signal":
      check(
        ["light", "sound", "scent", "smoke", "sight"].includes(c.channel) &&
          Number.isFinite(c.strength),
        "invalid-signal",
      );
      if ("source" in c) check(text(c.source), "invalid-signal-source");
      break;
    case "percept":
      check(object(c.aware), "invalid-percepts");
      break;
    case "settle":
      check(
        own(world.elements, c.element) &&
          Number.isFinite(c.minutes) &&
          c.minutes >= 0 &&
          integer(c.found),
        "invalid-settle",
      );
      break;
  }
}

// State patches do not change entity membership. Validate each patch's shape
// and target against the same world, then preserve their order in one apply.
// Flush before every other kind so creation, consumption and wound indices
// still validate against the exact preceding result.
function replayChanges(world, changes, started) {
  let current = world;
  let patches = [];
  for (const change of changes) {
    check(Date.now() - started <= LIMITS.milliseconds, "time-limit");
    if (change?.kind !== "state" && patches.length > 0) {
      current = apply(current, patches);
      patches = [];
    }
    validateChange(change, current);
    if (change.kind === "state") patches.push(change);
    else current = apply(current, [change]);
  }
  return patches.length > 0 ? apply(current, patches) : current;
}

function replayStep(state, event, revision, started) {
  keys(event, ["version", "revision", "kind", "command", "changes", "draws", "rng", "tick"]);
  check(["join", "command", "tick"].includes(event.kind), "invalid-event-kind");
  check(event.revision === revision + 1 && event.revision <= 0xffffffff, "revision-gap-or-order");
  check(text(event.command), "invalid-command-metadata");
  check(Array.isArray(event.changes) && Array.isArray(event.draws), "invalid-event-arrays");
  check(event.tick === state.tick + (event.kind === "tick" ? 1 : 0), "tick-mismatch");
  rngState(event.rng);
  const rng = Rng.fromState(state.rng);
  for (const draw of event.draws)
    check(
      Number.isFinite(draw) && draw >= 0 && draw < 1 && draw === rng.next(),
      "rng-draw-mismatch",
    );
  equal(rng.state, event.rng, "rng-state-mismatch");
  if (event.kind !== "command") check(event.draws.length === 0, "unexpected-draws");
  if (event.kind === "tick") check(event.command === "", "unexpected-tick-command");
  const world = replayChanges(state.world, event.changes, started);
  const next = { ...state, world, rng: event.rng, tick: event.tick };
  validateState(next);
  return next;
}

export function verifyArchive(file) {
  const started = Date.now();
  const fd = openSync(file, "r");
  let state,
    generation,
    firstSequence,
    sequence = 0n,
    revision = 0,
    events = 0;
  const counts = { initial: 0, join: 0, command: 0, tick: 0 };
  const hash = createHash("sha256");
  try {
    const before = fstatSync(fd);
    check(before.isFile() && before.size > 0 && before.size <= LIMITS.bytes, "archive-size-limit");
    const chunk = Buffer.alloc(64 * 1024);
    const line = Buffer.alloc(LIMITS.lineBytes);
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let position = 0,
      length = 0;
    function record(bytes) {
      check(++events <= LIMITS.events, "event-count-limit");
      check(Date.now() - started <= LIMITS.milliseconds, "time-limit");
      let decoded;
      try {
        decoded = decoder.decode(bytes);
      } catch {
        throw new VerificationError("invalid-utf8");
      }
      const row = parse(decoded);
      keys(row, ["generation", "seq", "payload"]);
      check(text(row.generation) && /^[0-9a-f]{64}$/.test(row.generation), "invalid-generation");
      generation ??= row.generation;
      check(row.generation === generation, "mixed-generations");
      check(text(row.seq) && /^(0|[1-9]\d{0,19})$/.test(row.seq), "invalid-sequence");
      // SpacetimeDB reserves auto-increment ID blocks across restart. Physical
      // IDs must increase; the event revision below is the contiguous commit
      // frontier that proves no committed transition was omitted.
      check(BigInt(row.seq) > sequence && BigInt(row.seq) <= 0xffffffffffffffffn, "sequence-order");
      sequence = BigInt(row.seq);
      check(text(row.payload), "invalid-payload");
      const event = parse(row.payload);
      check(event.version === 1, "unsupported-event-version");
      if (state) {
        state = replayStep(state, event, revision, started);
        revision = event.revision;
      } else {
        keys(event, ["version", "kind", "state"]);
        check(event.kind === "initial", "missing-initial");
        validateState(event.state);
        check(event.state.tick === 0, "invalid-initial-tick");
        state = event.state;
        firstSequence = row.seq;
      }
      counts[event.kind]++;
    }
    while (position < before.size) {
      const count = readSync(
        fd,
        chunk,
        0,
        Math.min(chunk.length, before.size - position),
        position,
      );
      check(count > 0, "archive-truncated");
      position += count;
      hash.update(chunk.subarray(0, count));
      for (let i = 0; i < count; i++) {
        if (chunk[i] === 10) {
          record(line.subarray(0, length));
          length = 0;
        } else {
          check(length < LIMITS.lineBytes, "line-size-limit");
          line[length++] = chunk[i];
        }
      }
    }
    check(length === 0, "incomplete-tail");
    const after = fstatSync(fd);
    // The single-writer journal may append while we read. Verify exactly the
    // byte frontier captured above; a frontier inside a line fails closed.
    check(after.size >= before.size, "archive-truncated");
    if (after.size === before.size)
      check(before.mtimeMs === after.mtimeMs, "archive-changed-during-read");
    check(!!state, "missing-initial");
    return {
      version: 1,
      ok: true,
      scope: "simulation-replay-only",
      generation,
      bytes: before.size,
      appendedDuringRead: after.size > before.size,
      archiveSha256: hash.digest("hex"),
      events,
      counts,
      firstSequence,
      lastSequence: sequence.toString(),
      revision,
      tick: state.tick,
      rng: state.rng,
      stateSha256: digest(state),
      limits: LIMITS,
      checks: [
        "initial-structure",
        "increasing-sequence-and-contiguous-revision",
        "change-application",
        "world-references",
        "recorded-rng-draws",
        "tick-progression",
      ],
      limitations: [
        "The initial snapshot is structurally checked, not authenticated against a trusted seed.",
        "Current events contain no later snapshots or state hashes to compare against replay.",
        "Does not rerun infer, resolve, sensing, terrain legality or command authorization.",
        "Does not restore admission, identity, private command receipts, timers or archive acknowledgements.",
        "A complete contiguous prefix does not prove the archive includes the host's latest event.",
      ],
    };
  } finally {
    closeSync(fd);
  }
}

function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2) {
    console.error("Usage: replay.mjs <archive.jsonl> <NEW-report.json>");
    process.exitCode = 1;
    return;
  }
  // Reserve exclusively before reading; never overwrite an archive or prior report.
  let fd;
  try {
    check(resolve(args[0]) !== resolve(args[1]), "same-input-and-output");
    fd = openSync(args[1], "wx", 0o600);
    let report;
    try {
      report = verifyArchive(args[0]);
    } catch (error) {
      // Error messages from filesystem/JSON/apply may include private data.
      report = {
        version: 1,
        ok: false,
        scope: "simulation-replay-only",
        failure: error instanceof VerificationError ? error.message : "archive-verification-failed",
      };
      process.exitCode = 1;
    }
    writeFileSync(fd, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({ ok: report.ok, scope: report.scope }));
  } catch {
    console.error("Replay could not create a new report or complete verification.");
    process.exitCode = 1;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
