/**
 * Lossless, event-local JSON compaction. No simulation, I/O, clock or dependencies.
 * API accepts/returns serialized event payloads, not archive rows. Archive identity,
 * sequence, generation and durability remain the caller's responsibility.
 *
 * V1 is [marker, version, nodes, root]. Scalar nodes are JSON scalars; container
 * nodes are [0, ...arrayReferences] or [1, ...keyAndValueReferences]. References
 * point strictly backwards. Equal subtrees share storage, never decoded identity.
 * The entire dictionary travels with each event: no checkpoint/base dependency.
 * This is a transport codec, NOT event-schema validation or authentication.
 */
export const EVENT_CODEC_MARKER = "rpg-jev/event-dictionary";
export const EVENT_CODEC_LIMITS = Object.freeze({
  bytes: 16 * 1024 * 1024,
  nodes: 100_000,
  depth: 64,
  visits: 1_000_000,
  // Bounds intermediate expanded fragments too, not just the final root.
  expansionBytes: 64 * 1024 * 1024,
});

type Scalar = string | number | boolean | null;
type Json = Scalar | Json[] | { [key: string]: Json };
type Node = Scalar | number[];
function fail(): never {
  throw new Error("Invalid or oversized event codec payload");
}

/** UTF-8 length, including JSON's escaped lone surrogates, without platform APIs. */
function bytes(text: string): number {
  // Canonical event JSON is usually printable ASCII. The native scan avoids
  // revisiting every byte of every interned subtree in JavaScript.
  if (!/[^\u0020-\u007e]/.test(text)) return text.length;
  let size = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) size++;
    else if (code < 0x800) size += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        size += 4;
        i++;
      } else size += 3;
    } else size += 3;
  }
  return size;
}

function parse(text: string): Json {
  if (typeof text !== "string" || text.length > EVENT_CODEC_LIMITS.bytes) fail();
  if (bytes(text) > EVENT_CODEC_LIMITS.bytes) fail();
  return JSON.parse(text) as Json;
}

function validate(value: Json, depth = 0, budget = { visits: 0 }): void {
  if (depth > EVENT_CODEC_LIMITS.depth || ++budget.visits > EVENT_CODEC_LIMITS.visits) fail();
  if (typeof value === "number" && !Number.isFinite(value)) fail();
  if (value !== null && typeof value === "object")
    for (const child of Object.values(value)) validate(child, depth + 1, budget);
}

function event(value: Json): void {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail();
  validate(value);
}

/**
 * Returns a self-contained compact envelope only when it is smaller. Raw fallback
 * preserves noncanonical JSON (whitespace, number spellings, duplicate keys) byte
 * for byte. Canonical input is also restored byte for byte, including key order.
 */
export function encodeEvent(payload: string): string {
  const value = parse(payload);
  event(value);
  if (JSON.stringify(value) !== payload) return payload;
  const nodes: Node[] = [];
  const subtrees = new Map<string, number>();
  let expansionBytes = 0;
  const intern = (part: Json): number => {
    // Drift repeats whole state patches and cause arrays. Intern those before
    // walking their children, rather than repeatedly visiting every state field.
    const source = JSON.stringify(part);
    const existing = subtrees.get(source);
    if (existing !== undefined) return existing;
    let node: Node;
    if (Array.isArray(part)) node = [0, ...part.map(intern)];
    else if (part !== null && typeof part === "object") {
      node = [1];
      for (const [key, child] of Object.entries(part)) node.push(intern(key), intern(child));
    } else node = part;
    if (nodes.length >= EVENT_CODEC_LIMITS.nodes) fail();
    expansionBytes += bytes(source);
    if (expansionBytes > EVENT_CODEC_LIMITS.expansionBytes) fail();
    subtrees.set(source, nodes.length);
    nodes.push(node);
    return nodes.length - 1;
  };
  const root = intern(value);
  const encoded = JSON.stringify([EVENT_CODEC_MARKER, 1, nodes, root]);
  return bytes(encoded) < bytes(payload) ? encoded : payload;
}

interface Fragment {
  text: string;
  bytes: number;
  depth: number;
  visits: number;
  key?: string;
}

function separatorAt(index: number, tag: number): string {
  if (index === 1) return "";
  return tag === 1 && index % 2 === 0 ? ":" : ",";
}

function container(node: Json[], prior: Fragment[]): Fragment {
  const tag = node[0];
  if (tag !== 0 && tag !== 1) fail();
  if (tag === 1 && node.length % 2 !== 1) fail();
  const parts: string[] = [];
  const keys = new Set<string>();
  let size = 2;
  let depth = 0;
  let visits = 1;
  for (let i = 1; i < node.length; i++) {
    const ref = node[i];
    if (typeof ref !== "number" || !Number.isSafeInteger(ref) || ref < 0) fail();
    const child = prior[ref];
    if (!child) fail();
    const isKey = tag === 1 && i % 2 === 1;
    if (isKey) {
      if (child.key === undefined || keys.has(child.key)) fail();
      keys.add(child.key);
    } else {
      depth = Math.max(depth, child.depth + 1);
      visits += child.visits;
    }
    const separator = separatorAt(i, tag);
    size += child.bytes + separator.length;
    if (size > EVENT_CODEC_LIMITS.bytes || visits > EVENT_CODEC_LIMITS.visits) fail();
    parts.push(separator, child.text);
  }
  if (depth > EVENT_CODEC_LIMITS.depth) fail();
  const brackets = tag === 0 ? ["[", "]"] : ["{", "}"];
  return { text: brackets[0] + parts.join("") + brackets[1], bytes: size, depth, visits };
}

/** Reject unknown versions, missing/forward/cyclic references and expansion bombs. */
export function decodeEvent(payload: string): string {
  const value = parse(payload);
  if (!Array.isArray(value)) {
    event(value);
    return payload;
  }
  if (value.length !== 4 || value[0] !== EVENT_CODEC_MARKER || value[1] !== 1) fail();
  const nodes = value[2];
  const root = value[3];
  if (!Array.isArray(nodes) || nodes.length > EVENT_CODEC_LIMITS.nodes) fail();
  if (root !== nodes.length - 1 || nodes.length === 0) fail();
  const fragments: Fragment[] = [];
  let total = 0;
  for (const node of nodes) {
    let fragment: Fragment;
    if (Array.isArray(node)) fragment = container(node, fragments);
    else {
      if (node !== null && typeof node === "object") fail();
      if (typeof node === "number" && !Number.isFinite(node)) fail();
      const text = JSON.stringify(node);
      fragment = { text, bytes: bytes(text), depth: 0, visits: 1 };
      if (typeof node === "string") fragment.key = node;
    }
    total += fragment.bytes;
    if (total > EVENT_CODEC_LIMITS.expansionBytes) fail();
    fragments.push(fragment);
  }
  const result = fragments[fragments.length - 1];
  if (!result?.text.startsWith("{")) fail();
  // Every fragment was built from validated JSON scalars or containers with
  // unique string keys/backward references. The bounded object text is already
  // valid JSON; parsing and walking it again here duplicates the caller's work.
  return result.text;
}
