/**
 * An editing session: the tool in hand, the stroke in progress, and the
 * history. It knows tiles and nothing of mice or pixels, so the whole of the
 * editor's behaviour runs under test; the page only tells it which tile the
 * mouse is over and which button went down.
 */
import { GLYPH_SWAYS } from "../glyph/batch.ts";
import { glyphOfExtra } from "../glyph/font.ts";
import { INK } from "../palette.ts";
import { SHAPE } from "../terrain/grid.ts";
import { type Edit, EditBuilder, History, settle, tileAt, type World } from "./edits.ts";
import {
  type Brush,
  brushTiles,
  floodTiles,
  rectTiles,
  type Stroke,
  TOOLS,
  type Tool,
} from "./tools.ts";

const FIRST_TOOL = TOOLS[0] as Tool;

export class EditorSession {
  readonly world: World;
  readonly history = new History();
  readonly brush: Brush = {
    kind: 0,
    shape: SHAPE.slantN,
    ink: INK.ember,
    look: { glyph: glyphOfExtra("tree"), ink: INK.leaf, flags: GLYPH_SWAYS, scale: 22 },
    size: 1,
  };
  tool: Tool = FIRST_TOOL;
  /** The tile under the mouse, or -1. */
  hover = -1;
  /** Told which tiles need their meshes rebuilt, and that the world is no longer as saved. */
  onChanged: (tiles: readonly number[]) => void = () => undefined;
  #stroke: Stroke | null = null;
  #rectFrom = -1;
  #last = -1;

  constructor(world: World) {
    this.world = world;
  }

  get busy(): boolean {
    return this.#stroke !== null;
  }

  /** A button went down over a tile. `rect` drags out a rectangle in place of brushing. */
  begin(index: number, invert: boolean, rect: boolean): void {
    if (index < 0 || this.#stroke) return;
    this.#stroke = {
      world: this.world,
      edit: new EditBuilder(this.world),
      brush: this.brush,
      invert,
      anchorHeight: tileAt(this.world.grid, index).height,
    };
    this.hover = index;
    this.#last = index;
    if (this.tool.floods) {
      this.#apply(floodTiles(this.world.grid, index));
      this.end();
    } else if (rect) {
      this.#rectFrom = index;
    } else {
      this.#apply(brushTiles(this.world.grid, index, this.brush.size));
    }
  }

  /** The mouse moved to another tile. Brushes every tile on the way, so a fast hand leaves no gaps. */
  moveTo(index: number): void {
    this.hover = index;
    if (!this.#stroke || index < 0 || this.#rectFrom >= 0 || index === this.#last) return;
    const grid = this.world.grid;
    const fromX = this.#last % grid.width;
    const fromZ = Math.floor(this.#last / grid.width);
    const dx = (index % grid.width) - fromX;
    const dz = Math.floor(index / grid.width) - fromZ;
    const steps = Math.max(Math.abs(dx), Math.abs(dz));
    for (let i = 1; i <= steps; i++) {
      const x = Math.round(fromX + (dx * i) / steps);
      const z = Math.round(fromZ + (dz * i) / steps);
      this.#apply(brushTiles(grid, grid.index(x, z), this.brush.size));
    }
    this.#last = index;
  }

  /** The button came up: a rectangle is applied now, and the stroke becomes one step of history. */
  end(): void {
    const stroke = this.#stroke;
    if (!stroke) return;
    if (this.#rectFrom >= 0 && this.hover >= 0) {
      this.#apply(rectTiles(this.world.grid, this.#rectFrom, this.hover));
    }
    this.history.push(stroke.edit.finish());
    this.#stroke = null;
    this.#rectFrom = -1;
  }

  /** What to light up: the brush under the mouse, or the rectangle being dragged. [x0, z0, x1, z1]. */
  cursor(): [number, number, number, number] | null {
    if (this.hover < 0) return null;
    const grid = this.world.grid;
    const tiles =
      this.#rectFrom >= 0
        ? [this.#rectFrom, this.hover]
        : brushTiles(grid, this.hover, this.tool.floods ? 1 : this.brush.size);
    let [x0, z0, x1, z1] = [grid.width, grid.depth, 0, 0];
    for (const index of tiles) {
      const x = index % grid.width;
      const z = Math.floor(index / grid.width);
      x0 = Math.min(x0, x);
      z0 = Math.min(z0, z);
      x1 = Math.max(x1, x + 1);
      z1 = Math.max(z1, z + 1);
    }
    return [x0, z0, x1, z1];
  }

  undo(): void {
    this.#replayed(this.history.undo(this.world));
  }

  redo(): void {
    this.#replayed(this.history.redo(this.world));
  }

  #replayed(edit: Edit | null): void {
    if (!edit) return;
    this.onChanged(
      settle(
        this.world,
        edit.tiles.map((change) => change.index),
      ),
    );
  }

  #apply(tiles: readonly number[]): void {
    const stroke = this.#stroke;
    if (!stroke) return;
    for (const index of tiles) this.tool.apply(stroke, index);
    this.onChanged(settle(this.world, stroke.edit.drain()));
  }
}
