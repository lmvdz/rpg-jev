/**
 * The client as it stands: a world on screen, a hero to walk it, and the
 * editor that paints it (SPEC.md section 16, steps R0 to R4).
 *
 * Play: arrows or WASD walk. Tab opens the editor, where the same keys move
 * the view and the mouse paints. Both: Q and E turn the camera, - and = zoom,
 * O toggles glyph outlines, P swaps the palette, B measures what a frame costs.
 */
import { vec3 } from "gl-matrix";
import { Camera } from "./camera.ts";
import { type MountedEditor, mountEditor } from "./editor/mount.ts";
import { EditorPanel } from "./editor/panel.ts";
import { Rover } from "./editor/rover.ts";
import { EditorSession } from "./editor/session.ts";
import { DEFAULT_ATMOSPHERE } from "./gl/frame.ts";
import { Renderer } from "./gl/renderer.ts";
import { GlyphBatch } from "./glyph/batch.ts";
import { glyphOfChar } from "./glyph/font.ts";
import { INK, PALETTE_HEX } from "./palette.ts";
import type { ActRequest } from "./play/act-request.ts";
import { type MountedPlay, mountPlay } from "./play/pointer.ts";
import { StatusDisplay } from "./play/status.ts";
import { StandInBody } from "./scene/body.ts";
import { Drift } from "./scene/drift.ts";
import { Walker } from "./scene/walker.ts";
import { ChunkManager } from "./terrain/chunks.ts";
import { groundHeight } from "./terrain/tessellate.ts";
import { askPriors, delayed, EffectBook } from "./view/effect-book.ts";
import { EFFECTS } from "./view/effect-rows.ts";
import { OneShots } from "./view/effects.ts";
import { LivingThings } from "./view/living.ts";
import { MOTIONS } from "./view/motions.ts";
import { applySky } from "./view/sky.ts";
import type { WorldContent } from "./world/format.ts";
import { ObjectLayer } from "./world/objects.ts";
import { dropDraft, keepDraft, type LoadedWorld, loadWorld, saveWorld } from "./world/storage.ts";

const NIGHT_HEX = PALETTE_HEX.map((hex, i) => (i === INK.lamp ? hex : dim(hex)));
const DRAFT_AFTER_MS = 1500;
/** The hero is always the glyph batch's first instance. */
const HERO_SLOT = () => 0;
/** Stand-ins until acts come from the world: when a reach lands, in seconds, and how hard it is. */
const STRIKE_LANDS = 0.08;
const STRIKE_LEVEL = 3;

function dim(hex: string): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = Math.round(((value >> 16) & 0xff) * 0.45);
  const g = Math.round(((value >> 8) & 0xff) * 0.55);
  const b = Math.round((value & 0xff) * 0.8);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function need<T extends Element>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`the page has no ${selector}`);
  return found;
}

/** Everything on the page that outlives a frame. */
interface App {
  canvas: HTMLCanvasElement;
  hud: HTMLPreElement;
  name: string;
  stress: boolean;
  renderer: Renderer;
  camera: Camera;
  batch: GlyphBatch;
  walker: Walker;
  rover: Rover;
  objects: ObjectLayer;
  chunks: ChunkManager;
  session: EditorSession;
  goal: vec3;
  stats: {
    fps: number;
    cpuMs: number;
    gpuMs: number | null;
    benchMs: number | null;
    waiting: number;
  };
  editing: boolean;
  night: boolean;
  yawGoal: number;
  last: number;
  hudAt: number;
  /** When the world last changed without being kept, or 0. */
  changedAt: number;
  /** Where the world on screen came from or went to. */
  note: string;
  /** A grown world's things and what changes them, or null for a painted world. */
  living: LivingThings | null;
  /** The effects born so far, by element and by what is happening to it. */
  book: EffectBook;
  /** Effects of events, each played once. */
  shots: OneShots;
  /** The mouse in play: tooltip, click to walk, menu. Mounted once the page is up. */
  play: MountedPlay | null;
  /** The hero's body (a stand-in until world state has one) and the bars that show it. */
  body: StandInBody;
  status: StatusDisplay | null;
  drift: Drift | null;
  driftAt: number;
  /** The hour of the day, 0 to 24, and how many hours pass in a second. */
  hour: number;
  hoursPerSecond: number;
}

function build(loaded: LoadedWorld, query: URLSearchParams): App {
  const canvas = need<HTMLCanvasElement>("#view");
  const { grid, objects: placed, start } = loaded.content;
  const renderer = new Renderer(canvas);
  const camera = new Camera();
  const stress = query.has("stress");
  if (stress) {
    // The R1 gate's worst case: every tile and every glyph on screen at once.
    camera.settings.distance = 560;
    camera.settings.far = 2000;
  }

  // The hero is the batch's first glyph; everything after it belongs to the object layer.
  const batch = new GlyphBatch(placed.length + 256);
  // The hero must be in the batch before the things are, and must know what blocks the way:
  // so the walker asks through this, and the things are filled in a few lines down.
  let living: LivingThings | null = null;
  const walker = new Walker(grid, start[0], start[1], (tile) => living?.blocks(tile) ?? false);
  batch.add(walker.x, walker.y, walker.z, { glyph: glyphOfChar("@"), ink: INK.lamp });
  const objects = new ObjectLayer(grid, batch);
  for (const o of placed) objects.set(grid.index(o.x, o.z), o.look);
  const things = loaded.things ?? null;
  // No judge is attached yet, so the priors answer; `?judge=<ms>` makes them answer late, which
  // shows the generic row handing over to the born one. Elements are shared between worlds, so
  // the book's seed is not the map's.
  const wait = Number(query.get("judge") ?? 0);
  const book = new EffectBook(wait > 0 ? delayed(askPriors, wait) : askPriors, 1);
  if (things) living = new LivingThings(things, grid, objects, book);

  const worker = new Worker(new URL("./terrain/worker.ts", import.meta.url), { type: "module" });
  worker.onerror = (event) => console.error(`the tessellation worker failed: ${event.message}`);
  const chunks = new ChunkManager(grid, worker, (key, mesh, x, z, size) =>
    renderer.terrain.setChunk(key, mesh, x, z, size),
  );
  renderer.onRestored = () => {
    chunks.markAllDirty();
    batch.markAllDirty();
  };

  return {
    canvas,
    hud: need<HTMLPreElement>("#hud"),
    name: loaded.name,
    stress,
    renderer,
    camera,
    batch,
    walker,
    rover: new Rover(grid, walker.x, walker.z),
    objects,
    chunks,
    session: new EditorSession({ grid, objects }),
    goal: vec3.fromValues(walker.x, walker.y, walker.z),
    stats: { fps: 0, cpuMs: 0, gpuMs: null, benchMs: null, waiting: 0 },
    editing: query.has("edit"),
    night: false,
    yawGoal: 0,
    last: performance.now(),
    hudAt: 0,
    changedAt: 0,
    note: loaded.from,
    living,
    book,
    shots: new OneShots(),
    play: null,
    body: new StandInBody(),
    status: null,
    drift: things ? new Drift(things, 1) : null,
    driftAt: 0,
    // A grown world starts late in the afternoon, so its first dusk is a minute away.
    hour: things ? 17 : 12,
    hoursPerSecond: things ? 1 / 12 : 0,
  };
}

function content(app: App): WorldContent {
  return {
    grid: app.session.world.grid,
    objects: app.objects.list(),
    start: [app.walker.tileX, app.walker.tileZ],
  };
}

function mountEditing(app: App): { panel: EditorPanel; editor: MountedEditor } {
  const { session, walker, chunks } = app;
  const grid = session.world.grid;
  session.onChanged = (tiles) => {
    for (const index of tiles)
      chunks.markTileDirty(index % grid.width, Math.floor(index / grid.width));
    app.changedAt = performance.now();
  };
  const heroHere = () => {
    if (session.hover < 0) return;
    walker.jumpToTile(session.hover % grid.width, Math.floor(session.hover / grid.width));
    app.changedAt = performance.now();
  };
  const save = () => {
    app.changedAt = 0;
    saveWorld(app.name, content(app)).then((said) => {
      app.note = said;
      panel.status(said);
    });
  };
  const revert = () => {
    dropDraft(app.name);
    location.reload();
  };
  const panel = new EditorPanel(session, { save, revert, heroHere });
  document.body.append(panel.root);
  panel.visible = app.editing;
  const editor = mountEditor({
    canvas: app.canvas,
    camera: app.camera,
    session,
    panel,
    editing: () => app.editing,
    save,
    heroHere,
  });
  return { panel, editor };
}

function writeHud(app: App): void {
  const { stats, renderer, canvas } = app;
  // The timer query stretches with the GPU's clock state and its other work: a hint, not a measure.
  const gpu = stats.gpuMs === null ? "n/a" : `~${stats.gpuMs.toFixed(1)} ms`;
  const bench = stats.benchMs === null ? "press b" : `${stats.benchMs.toFixed(2)} ms a frame`;
  const terrain = renderer.terrain.stats;
  app.hud.textContent = [
    `${stats.fps.toFixed(0)} fps   cpu ${stats.cpuMs.toFixed(2)} ms   gpu timer ${gpu}`,
    `measured: ${bench}   at ${canvas.width}x${canvas.height}`,
    `${terrain.chunksDrawn} chunks   ${terrain.triangles} tris   ${app.batch.count} glyphs`,
    app.chunks.waiting > 0 ? `building ${app.chunks.waiting} chunks` : app.note,
    app.editing ? "EDITING   tab: play" : "arrows walk  q/e turn  -/= zoom  tab: edit",
  ].join("\n");
}

function bindKeys(app: App, panel: EditorPanel, editor: MountedEditor): void {
  const { camera, renderer, rover, walker, session } = app;
  const keys: Readonly<Record<string, () => void>> = {
    tab: () => {
      app.editing = !app.editing;
      panel.visible = app.editing;
      rover.releaseAll();
      rover.jumpTo(walker.x, walker.z);
      if (!app.editing) session.moveTo(-1);
    },
    q: () => {
      app.yawGoal += Math.PI / 2;
    },
    e: () => {
      app.yawGoal -= Math.PI / 2;
    },
    "-": () => {
      camera.settings.distance = Math.min(camera.settings.distance * 1.15, 400);
    },
    "=": () => {
      camera.settings.distance = Math.max(camera.settings.distance / 1.15, 8);
    },
    o: () => {
      renderer.atmosphere.outline = !renderer.atmosphere.outline;
    },
    p: () => {
      app.night = !app.night;
      renderer.setPalette(app.night ? NIGHT_HEX : PALETTE_HEX);
    },
    t: () => {
      app.hour = (app.hour + 2) % 24;
    },
    " ": () => renderer.motions.play(HERO_SLOT, MOTIONS.hop, app.last / 1000),
    x: () => renderer.motions.play(HERO_SLOT, MOTIONS.spin, app.last / 1000),
    c: () => renderer.motions.play(HERO_SLOT, MOTIONS.recoil, app.last / 1000, 0, -1),
    b: () => {
      app.stats.benchMs = renderer.measure(camera, app.batch, app.last / 1000);
      writeHud(app);
    },
  };

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    const chord = event.ctrlKey || event.metaKey;
    const steps = app.editing
      ? rover.press.bind(rover)
      : (k: string) => walker.press(k, camera.settings.yaw);
    if ((!chord && steps(key)) || (app.editing && editor.key(event))) {
      event.preventDefault();
      return;
    }
    const run = chord ? undefined : keys[key];
    if (!run) return;
    event.preventDefault();
    run();
  });
  window.addEventListener("keyup", (event) => {
    const key = event.key.toLowerCase();
    walker.release(key);
    rover.release(key);
  });
  window.addEventListener("blur", () => {
    rover.releaseAll();
    walker.releaseAll();
  });
}

/**
 * The fog backs off with the camera, so zooming out shows the map and not a
 * wall of fog: gently in play (at the usual distance it is where it always
 * was), and right out of the way while editing or measuring.
 */
function setFog(app: App): void {
  const a = app.renderer.atmosphere;
  const reach = app.camera.settings.distance * (app.stress || app.editing ? 2 : 0.65);
  a.fogStart = Math.max(DEFAULT_ATMOSPHERE.fogStart, reach);
  a.fogEnd = Math.max(DEFAULT_ATMOSPHERE.fogEnd, reach * 2.2);
  app.renderer.applyAtmosphere();
}

/** The hour moves the sky; a grown world's things change, and the ones that burn light the frame. */
function liven(app: App, now: number, dt: number): void {
  app.hour = (app.hour + dt * app.hoursPerSecond) % 24;
  applySky(app.hour, app.renderer.atmosphere);
  app.renderer.lights.begin(app.goal[0], app.goal[2]);
  const emitters = app.renderer.emitters;
  emitters.begin();
  // The hero kicks up dust while on the move.
  const { walker } = app;
  const moving = walker.x !== walker.tileX + 0.5 || walker.z !== walker.tileZ + 0.5;
  if (moving) emitters.add(walker.x, walker.y, walker.z, EFFECTS.dust);
  app.shots.emit(emitters, now / 1000);
  if (!(app.living && app.drift)) return;
  app.living.emit(emitters);
  if (now - app.driftAt > 400) {
    app.driftAt = now;
    app.living.redraw(app.drift.step());
  }
  app.living.shine(app.renderer.lights);
}

function frame(app: App, editor: MountedEditor, now: number): void {
  const { walker, rover, camera, renderer, batch, goal, stats, session } = app;
  // The first timestamp can be earlier than the clock read at load.
  const dt = Math.min(Math.max((now - app.last) / 1000, 0), 0.1);
  app.last = now;
  const began = performance.now();

  walker.update(dt, camera.settings.yaw);
  batch.move(0, walker.x, walker.y, walker.z);
  app.body.update(dt, walker.x !== walker.tileX + 0.5 || walker.z !== walker.tileZ + 0.5);
  app.status?.update(app.body.view);
  if (app.editing) {
    rover.update(dt, camera.settings.yaw, camera.settings.distance);
    vec3.set(goal, rover.x, rover.y, rover.z);
    editor.track();
  } else {
    vec3.set(goal, walker.x, walker.y, walker.z);
  }
  const pointed = app.play?.track() ?? null;
  renderer.setCursor(app.editing ? session.cursor() : pointed);
  liven(app, now, dt);
  setFog(app);
  camera.settings.yaw += (app.yawGoal - camera.settings.yaw) * Math.min(dt * 10, 1);
  app.chunks.pump(goal[0], goal[2]);
  camera.update(goal, dt, renderer.resize());
  renderer.draw(camera, batch, now / 1000);

  if (app.changedAt > 0 && began - app.changedAt > DRAFT_AFTER_MS && !session.busy) {
    app.changedAt = 0;
    keepDraft(app.name, content(app));
    app.note = `${app.name}: unsaved copy kept in this browser (ctrl s saves it to the repository)`;
  }
  stats.cpuMs += (performance.now() - began - stats.cpuMs) * 0.05;
  stats.fps += (1 / Math.max(dt, 1e-4) - stats.fps) * 0.05;
  stats.gpuMs = renderer.timer.latestMs;
  stats.waiting = app.chunks.waiting;
  if (now - app.hudAt > 500) {
    app.hudAt = now;
    writeHud(app);
  }
}

const query = new URLSearchParams(location.search);
loadWorld(query).then((loaded) => {
  const app = build(loaded, query);
  const { panel, editor } = mountEditing(app);
  bindKeys(app, panel, editor);
  app.status = new StatusDisplay();
  const acts: ActRequest[] = [];
  Object.assign(window, { __acts: acts });
  app.play = mountPlay({
    canvas: app.canvas,
    camera: app.camera,
    grid: app.session.world.grid,
    walker: app.walker,
    living: app.living,
    playing: () => !app.editing,
    say: (text) => {
      app.note = text;
      writeHud(app);
    },
    // A stand-in for an act: the hero lunges at the thing, the thing shakes, and what comes off
    // a thing of its element when it is struck is played once. How hard is the world's to say.
    reach: (tile) => {
      const { walker, renderer, objects } = app;
      const grid = app.session.world.grid;
      const now = app.last / 1000;
      const x = tile % grid.width;
      const z = Math.floor(tile / grid.width);
      renderer.motions.play(HERO_SLOT, MOTIONS.lunge, now, x - walker.tileX, z - walker.tileZ);
      renderer.motions.play(() => objects.slotAt(tile), MOTIONS.shake, now + STRIKE_LANDS);
      const struck = app.living?.thingAt(tile);
      if (!struck) return;
      const rows = app.book.entry(struck, "struck").rows[STRIKE_LEVEL] ?? [];
      const y = groundHeight(grid, x + 0.5, z + 0.5) + 0.5;
      app.shots.play(x + 0.5, y, z + 0.5, rows, now + STRIKE_LANDS);
    },
    // There is no world behind the client yet to resolve an act, so the request is kept where
    // a judge or a test can take it (`__acts`), and the HUD says what was handed over.
    act: (request) => {
      acts.push(request);
      const { line, inReach } = request.state;
      app.note = `"${line}" is ready for the judge: ${inReach.length} things in reach, ${request.questions.length} questions. No world is attached yet to resolve it.`;
      writeHud(app);
      console.log("act request", request);
    },
  });
  // Handles for driving the page from a script: nothing in the client reads them.
  Object.assign(window, {
    __stats: app.stats,
    __renderer: app.renderer,
    __session: app.session,
    __walker: app.walker,
    __births: app.book.log,
    __shots: app.shots,
    __living: app.living,
  });
  app.camera.snapTo(app.goal);
  // One closure for the life of the page: the frame itself allocates nothing.
  const tick = (now: number) => {
    frame(app, editor, now);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
