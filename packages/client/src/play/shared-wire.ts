/** Lossless, self-contained public snapshots. No cross-message dictionary or stale state. */
import type { ThingView } from "../view/things.ts";
import type { SharedView } from "./shared-types.ts";

const MAX_JSON = 8 * 1024 * 1024;
const MAX_THINGS = 16384;
type ObjectRow = Record<string, unknown>;
type Check = (value: unknown) => boolean;
const record = (value: unknown): value is ObjectRow =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const text: Check = (value) => typeof value === "string";
const finite: Check = (value) => typeof value === "number" && Number.isFinite(value);
const boolean: Check = (value) => typeof value === "boolean";
const integer: Check = (value) =>
  finite(value) && Number.isSafeInteger(value) && Number(value) >= 0;
const optional =
  (check: Check): Check =>
  (value) =>
    value === undefined || check(value);
const list =
  (check: Check): Check =>
  (value) =>
    Array.isArray(value) && value.length <= MAX_THINGS && value.every(check);
const fields = (value: unknown, checks: Record<string, Check>): boolean =>
  record(value) && Object.entries(checks).every(([key, check]) => check(value[key]));
const numeric: Check = (value) => record(value) && Object.values(value).every(finite);
const look: Check = (value) =>
  fields(value, { glyph: finite, ink: finite, scale: optional(finite), sways: optional(boolean) });
const element: Check = (value) =>
  fields(value, {
    name: text,
    kind: optional(text),
    forms: optional(list(text)),
    baseline: optional(numeric),
    look: optional(look),
    solid: optional(boolean),
  });
const presentation: Check = (value) =>
  element(value) && fields(value, { element: text, states: numeric });
const thing: Check = (value) =>
  presentation(value) && fields(value, { id: text, x: finite, z: finite });
const awareness: Check = list((value) =>
  fields(value, { source: text, name: text, channel: text, strength: finite }),
);
const body: Check = (value) =>
  fields(value, {
    meters: list((row) => fields(row, { id: text, label: text, level: finite, ink: finite })),
    counts: list((row) => fields(row, { id: text, label: text, value: finite })),
  });

function validateSurface(value: unknown): void {
  if (
    !fields(value, {
      actor: text,
      generation: optional(text),
      pauseReason: optional((reason) => reason === null || text(reason)),
      revision: integer,
      tick: integer,
      sequence: integer,
      seed: finite,
      position: (position) =>
        Array.isArray(position) && position.length === 2 && position.every(finite),
      elements: (elements) =>
        record(elements) &&
        Object.keys(elements).length <= MAX_THINGS &&
        Object.values(elements).every(element),
      body,
      compiled: list(text),
      sought: list(text),
    })
  )
    throw new Error("Invalid shared snapshot surface");
}

type Presentation = Omit<ThingView, "id" | "x" | "z">;
type Instance = [string, number, number, number];
interface WireView extends Omit<SharedView, "things" | "aware"> {
  wire: 1;
  presentations: Presentation[];
  instances: Instance[];
  aware: SharedView["aware"] | null;
}

function sight(things: ThingView[]): SharedView["aware"] {
  return things.map((thing) => ({
    source: thing.id,
    name: thing.name,
    channel: "sight",
    strength: 1,
  }));
}

/** Bounds reject visibly; nothing is dropped to meet a byte or population budget. */
export function encodeSharedView(view: SharedView): string {
  if (view.things.length > MAX_THINGS) throw new Error("Shared snapshot exceeds thing bound");
  validateSurface(view);
  if (!awareness(view.aware)) throw new Error("Invalid shared snapshot awareness");
  const presentations: Presentation[] = [];
  const indices = new Map<string, number>();
  const instances: Instance[] = view.things.map(({ id, x, z, ...presentation }) => {
    const key = JSON.stringify(presentation);
    let index = indices.get(key);
    if (index === undefined) {
      index = presentations.length;
      indices.set(key, index);
      presentations.push(presentation);
    }
    return [id, x, z, index];
  });
  const { things, aware, ...rest } = view;
  const wire: WireView = {
    ...rest,
    wire: 1,
    presentations,
    instances,
    aware: JSON.stringify(aware) === JSON.stringify(sight(things)) ? null : aware,
  };
  const json = JSON.stringify(wire);
  if (json.length > MAX_JSON) throw new Error("Shared snapshot exceeds JSON bound");
  preflight(wire, json.length);
  return json;
}

function preflight(wire: WireView, encodedLength: number): string[] {
  if (
    !(Array.isArray(wire.instances) && Array.isArray(wire.presentations)) ||
    wire.instances.length > MAX_THINGS ||
    wire.presentations.length > MAX_THINGS
  )
    throw new Error("Invalid shared snapshot dictionary");
  const templates = wire.presentations.map((value) => {
    if (!presentation(value)) throw new Error("Invalid shared snapshot presentation");
    return JSON.stringify(value);
  });
  let expandedLength = encodedLength;
  // Complete the resource preflight before cloning or spreading even the first instance.
  for (const instance of wire.instances) {
    if (
      !Array.isArray(instance) ||
      instance.length !== 4 ||
      typeof instance[0] !== "string" ||
      !Number.isFinite(instance[1]) ||
      !Number.isFinite(instance[2]) ||
      !Number.isSafeInteger(instance[3]) ||
      instance[3] < 0
    )
      throw new Error("Invalid shared snapshot instance");
    const [id, x, z, index] = instance;
    const template = templates[index];
    const entry = wire.presentations[index];
    if (template === undefined || !entry) throw new Error("Invalid shared snapshot presentation");
    expandedLength += template.length + JSON.stringify({ id, x, z }).length;
    if (wire.aware === null)
      expandedLength += JSON.stringify({
        source: id,
        name: entry.name,
        channel: "sight",
        strength: 1,
      }).length;
    if (expandedLength > MAX_JSON) throw new Error("Shared snapshot exceeds expanded JSON bound");
  }
  return templates;
}

function expand(wire: WireView, encodedLength: number): ThingView[] {
  const templates = preflight(wire, encodedLength);
  return wire.instances.map(([id, x, z, index]) => {
    const template = templates[index];
    if (template === undefined) throw new Error("Invalid shared snapshot presentation");
    // JSON cloning preserves unknown public fields and independent nested instance values.
    return { ...JSON.parse(template), id, x, z } as ThingView;
  });
}

/** Legacy JSON remains readable across additive publication/reconnect. */
export function decodeSharedView(json: string): SharedView {
  if (json.length > MAX_JSON) throw new Error("Shared snapshot exceeds JSON bound");
  const parsed: SharedView | WireView = JSON.parse(json);
  if (!record(parsed)) throw new Error("Invalid shared snapshot");
  validateSurface(parsed);
  if (!("wire" in parsed)) {
    if (!(list(thing)(parsed.things) && awareness(parsed.aware)))
      throw new Error("Invalid shared snapshot things or awareness bound");
    return parsed;
  }
  if (parsed.wire !== 1) throw new Error("Unsupported shared snapshot version");
  if (parsed.aware !== null && !awareness(parsed.aware))
    throw new Error("Invalid shared snapshot awareness");
  const wire = parsed as WireView;
  const things = expand(wire, json.length);
  const { wire: _version, presentations: _presentations, instances: _instances, ...rest } = wire;
  return { ...rest, things, aware: parsed.aware ?? sight(things) };
}
