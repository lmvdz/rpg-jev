/**
 * The editor's panel: what is in hand, and the buttons that are not worth a
 * key. It is plain DOM over the canvas. It holds no state of its own: it
 * writes to the session's brush and tool, and `refresh` redraws it from them,
 * so a right-click that picks something up shows here too.
 */
import { GLYPH_SWAYS } from "../glyph/batch.ts";
import { ATLAS_COLS, buildGlyphAtlas, CELL_H, CELL_W, GLYPH_COUNT } from "../glyph/font.ts";
import { PALETTE_HEX } from "../palette.ts";
import { LEVEL, SHAPE, type Shape } from "../terrain/grid.ts";
import { TILE_KINDS } from "../terrain/kinds.ts";
import { tileAt } from "./edits.ts";
import type { EditorSession } from "./session.ts";
import { TOOLS } from "./tools.ts";

export interface PanelActions {
  save(): void;
  revert(): void;
  heroHere(): void;
}

const SHAPES: readonly { shape: Shape; label: string }[] = [
  { shape: SHAPE.slantN, label: "ramp N" },
  { shape: SHAPE.slantE, label: "ramp E" },
  { shape: SHAPE.slantS, label: "ramp S" },
  { shape: SHAPE.slantW, label: "ramp W" },
  { shape: SHAPE.hole, label: "hole" },
];

const GLYPH_ZOOM = 5;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text = "",
  className = "",
): HTMLElementTagNameMap[K] {
  const made = document.createElement(tag);
  made.textContent = text;
  if (className) made.className = className;
  return made;
}

/** A row of buttons, one of which is lit. Returns the row and a function that lights the right one. */
function choice<T>(
  options: readonly { value: T; label: string; colour?: string }[],
  pick: (value: T) => void,
): { row: HTMLDivElement; light: (value: T) => void } {
  const row = el("div", "", "row");
  const buttons = options.map((option) => {
    const button = el("button", option.label);
    if (option.colour) {
      button.style.background = option.colour;
      button.className = "swatch";
    }
    button.addEventListener("click", () => pick(option.value));
    row.append(button);
    return button;
  });
  const light = (value: T) => {
    buttons.forEach((button, i) => {
      button.classList.toggle("lit", options[i]?.value === value);
    });
  };
  return { row, light };
}

function stepper(label: string, read: () => number, write: (value: number) => void) {
  const row = el("div", "", "row");
  const shown = el("span", "", "value");
  const less = el("button", "-");
  const more = el("button", "+");
  less.addEventListener("click", () => write(read() - 1));
  more.addEventListener("click", () => write(read() + 1));
  row.append(el("span", label, "label"), less, shown, more);
  return { row, show: () => (shown.textContent = String(read())) };
}

/** Every glyph of the font, drawn large; a click picks one. */
function glyphPicker(pick: (glyph: number) => void) {
  const atlas = buildGlyphAtlas();
  const canvas = el("canvas", "", "glyphs");
  canvas.width = atlas.width * GLYPH_ZOOM;
  canvas.height = atlas.height * GLYPH_ZOOM;
  const context = canvas.getContext("2d");
  canvas.addEventListener("click", (event) => {
    const box = canvas.getBoundingClientRect();
    const column = Math.floor(((event.clientX - box.left) / box.width) * ATLAS_COLS);
    const line = Math.floor(((event.clientY - box.top) / box.height) * (atlas.height / CELL_H));
    const glyph = line * ATLAS_COLS + column;
    if (glyph >= 0 && glyph < GLYPH_COUNT) pick(glyph);
  });
  const draw = (chosen: number, colour: string) => {
    if (!context) return;
    context.fillStyle = "#0d0e14";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const left = (chosen % ATLAS_COLS) * CELL_W * GLYPH_ZOOM;
    const top = Math.floor(chosen / ATLAS_COLS) * CELL_H * GLYPH_ZOOM;
    context.fillStyle = "#2a2d3c";
    context.fillRect(left - 2, top - 2, CELL_W * GLYPH_ZOOM + 1, CELL_H * GLYPH_ZOOM + 1);
    for (let i = 0; i < atlas.pixels.length; i++) {
      if (atlas.pixels[i] !== 255) continue;
      const x = i % atlas.width;
      const y = Math.floor(i / atlas.width);
      const isChosen = Math.floor(x / CELL_W) + Math.floor(y / CELL_H) * ATLAS_COLS === chosen;
      context.fillStyle = isChosen ? colour : "#9aa0a8";
      context.fillRect(x * GLYPH_ZOOM, y * GLYPH_ZOOM, GLYPH_ZOOM, GLYPH_ZOOM);
    }
  };
  return { canvas, draw };
}

export class EditorPanel {
  readonly root = el("div", "", "editor");
  readonly #session: EditorSession;
  readonly #refreshers: (() => void)[] = [];
  readonly #status = el("div", "", "status");

  constructor(session: EditorSession, actions: PanelActions) {
    this.#session = session;
    this.#tools();
    this.#terrain();
    this.#objects();
    this.#actions(actions);
    this.root.append(this.#status);
    // Clicks on the panel are not strokes on the map.
    for (const type of ["mousedown", "mouseup", "wheel", "contextmenu"]) {
      this.root.addEventListener(type, (event) => event.stopPropagation());
    }
    this.refresh();
  }

  set visible(shown: boolean) {
    this.root.style.display = shown ? "block" : "none";
  }

  refresh(): void {
    for (const refresher of this.#refreshers) refresher();
  }

  /** The line at the foot: what is under the mouse, and what the tool in hand does. */
  status(message = ""): void {
    const { world, hover, tool } = this.#session;
    const lines = [message || `${tool.name}: ${tool.hint}`];
    if (hover >= 0) {
      const tile = tileAt(world.grid, hover);
      const x = hover % world.grid.width;
      const z = Math.floor(hover / world.grid.width);
      const kind = TILE_KINDS[tile.kind]?.name ?? "?";
      lines.push(`(${x}, ${z})  ${kind}  height ${tile.height} (${tile.height * LEVEL} m)`);
    }
    this.#status.textContent = lines.join("\n");
  }

  #section(title: string, ...rows: HTMLElement[]): void {
    this.root.append(el("h2", title), ...rows);
  }

  #tools(): void {
    const session = this.#session;
    const tools = choice(
      TOOLS.map((tool) => ({ value: tool, label: `${tool.key} ${tool.name}` })),
      (tool) => {
        session.tool = tool;
        this.refresh();
      },
    );
    const size = stepper(
      "brush",
      () => session.brush.size,
      (value) => {
        session.brush.size = Math.min(Math.max(value, 1), 15);
        this.refresh();
      },
    );
    this.#section("tool  (shift-drag: rectangle, right button: opposite)", tools.row, size.row);
    this.#refreshers.push(
      () => tools.light(session.tool),
      size.show,
      () => this.status(),
    );
  }

  #terrain(): void {
    const brush = this.#session.brush;
    const kinds = choice(
      TILE_KINDS.map((kind, index) => ({
        value: index,
        label: kind.name,
        colour: PALETTE_HEX[kind.floor],
      })),
      (kind) => {
        brush.kind = kind;
        this.refresh();
      },
    );
    const shapes = choice(
      SHAPES.map((entry) => ({ value: entry.shape, label: entry.label })),
      (shape) => {
        brush.shape = shape;
        this.refresh();
      },
    );
    const inks = choice(
      PALETTE_HEX.map((hex, index) => ({ value: index, label: "", colour: hex })),
      (ink) => {
        brush.ink = ink;
        brush.look = { ...brush.look, ink };
        this.refresh();
      },
    );
    this.#section("kind", kinds.row);
    this.#section("shape", shapes.row);
    this.#section("colour (tiles and glyphs)", inks.row);
    this.#refreshers.push(
      () => kinds.light(brush.kind),
      () => shapes.light(brush.shape),
      () => inks.light(brush.ink),
    );
  }

  #objects(): void {
    const brush = this.#session.brush;
    const picker = glyphPicker((glyph) => {
      brush.look = { ...brush.look, glyph };
      this.refresh();
    });
    const scale = stepper(
      "size",
      () => brush.look.scale ?? 16,
      (value) => {
        brush.look = { ...brush.look, scale: Math.min(Math.max(value, 6), 48) };
        this.refresh();
      },
    );
    const sway = el("button", "sways");
    sway.addEventListener("click", () => {
      brush.look = { ...brush.look, flags: (brush.look.flags ?? 0) ^ GLYPH_SWAYS };
      this.refresh();
    });
    scale.row.append(sway);
    this.#section("glyph", picker.canvas, scale.row);
    this.#refreshers.push(
      () => picker.draw(brush.look.glyph, PALETTE_HEX[brush.look.ink] ?? "#fff"),
      scale.show,
      () => sway.classList.toggle("lit", ((brush.look.flags ?? 0) & GLYPH_SWAYS) !== 0),
    );
  }

  #actions(actions: PanelActions): void {
    const session = this.#session;
    const row = el("div", "", "row");
    const buttons: readonly [string, () => void][] = [
      ["undo (ctrl z)", () => session.undo()],
      ["redo (ctrl y)", () => session.redo()],
      ["save (ctrl s)", actions.save],
      ["hero here (h)", actions.heroHere],
      ["revert", actions.revert],
    ];
    for (const [label, run] of buttons) {
      const button = el("button", label);
      button.addEventListener("click", run);
      row.append(button);
    }
    this.#section("world", row);
  }
}
