/**
 * Where a world comes from and where it is kept. In order: the test card
 * when the address asks for it (`?stress`, `?seed=`), a named world from the
 * repository (`?world=name`, served from `public/worlds`), the browser's own
 * unsaved copy of that name, and the test card when there is nothing else.
 *
 * Saving writes the file into the repository through the dev server
 * (`vite.config.ts`), and falls back to a download where there is none.
 */
import { buildClearing } from "../scene/clearing.ts";
import { buildDemoScene } from "../scene/demo.ts";
import { buildStudy, STUDY_STATES } from "../scene/study.ts";
import type { ThingView } from "../view/things.ts";
import { decodeWorld, encodeWorld, type WorldContent } from "./format.ts";

export interface LoadedWorld {
  content: WorldContent;
  name: string;
  /** Said on the HUD, so it is never a puzzle which world is on screen. */
  from: string;
  /** A grown world's things, with the states that can be seen. They stand in for `content.objects`. */
  things?: ThingView[];
}

function clearing(seed: number, name: string): LoadedWorld {
  const grown = buildClearing(seed);
  return {
    content: { grid: grown.grid, objects: [], start: grown.start },
    things: grown.things,
    name,
    from: `the clearing, grown from seed ${seed}`,
  };
}

const NAME = /^[a-z0-9][a-z0-9-]{0,40}$/;
const keyOf = (name: string) => `rpg-jev.world.${name}`;

export function demoContent(seed: number): WorldContent {
  const scene = buildDemoScene(seed);
  const [hero, ...rest] = scene.placements;
  return { grid: scene.grid, objects: rest, start: [hero?.x ?? 0, hero?.z ?? 0] };
}

function readDraft(name: string): WorldContent | null {
  try {
    const text = localStorage.getItem(keyOf(name));
    return text ? decodeWorld(JSON.parse(text)) : null;
  } catch (error) {
    console.warn(`the unsaved copy of "${name}" could not be read and is ignored`, error);
    return null;
  }
}

async function readFromRepo(name: string): Promise<WorldContent | null> {
  try {
    const response = await fetch(`/worlds/${name}.json`);
    const type = response.headers.get("content-type") ?? "";
    if (!(response.ok && type.includes("json"))) return null;
    return decodeWorld(await response.json());
  } catch (error) {
    console.warn(`the world "${name}" could not be read`, error);
    return null;
  }
}

export async function loadWorld(query: URLSearchParams): Promise<LoadedWorld> {
  const seed = Number(query.get("seed") ?? 1);
  const asked = query.get("world") ?? "";
  const name = NAME.test(asked) ? asked : "scratch";
  if (query.has("study")) {
    return {
      content: buildStudy(),
      name: "visual-study",
      from: `visual study (not simulated)\nleft to right: ${STUDY_STATES.map((s) => s.name).join(" | ")}`,
    };
  }
  if (query.has("stress") || query.has("card")) {
    return { content: demoContent(seed), name, from: `test card, seed ${seed}` };
  }
  // A painted world is only loaded when it is asked for by name; otherwise the world is grown.
  if (!query.has("world")) return clearing(seed, name);
  const draft = readDraft(name);
  if (draft) return { content: draft, name, from: `${name}, unsaved copy in this browser` };
  const saved = await readFromRepo(name);
  if (saved) return { content: saved, name, from: `${name}, from the repository` };
  const grown = clearing(seed, name);
  return { ...grown, from: `${grown.from} (no world "${name}" yet)` };
}

/** Keeps work across a reload. Quietly does nothing when the browser refuses (private mode, quota). */
export function keepDraft(name: string, content: Readonly<WorldContent>): void {
  try {
    localStorage.setItem(keyOf(name), JSON.stringify(encodeWorld(content)));
  } catch (error) {
    console.warn("the unsaved copy could not be kept", error);
  }
}

export function dropDraft(name: string): void {
  try {
    localStorage.removeItem(keyOf(name));
  } catch {
    // Nothing was kept, so there is nothing to drop.
  }
}

function download(name: string, text: string): void {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  link.download = `${name}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

/** Says where the world went. */
export async function saveWorld(name: string, content: Readonly<WorldContent>): Promise<string> {
  const text = `${JSON.stringify(encodeWorld(content))}\n`;
  try {
    const response = await fetch(`/__world/${name}`, { method: "PUT", body: text });
    if (response.ok) {
      dropDraft(name);
      return `saved to public/worlds/${name}.json`;
    }
  } catch {
    // No dev server behind this page: hand the file to the person.
  }
  download(name, text);
  return `downloaded ${name}.json (no dev server to save through)`;
}
