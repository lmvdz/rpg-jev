/**
 * The clearing (docs/sandbox-direction.md, "a first slice"): a small map
 * grown from a seed, with nothing drawn by hand and no straight line in it.
 * Meadow and woods from noise, a quarry face where a second noise runs high,
 * a stream that wanders downhill from the north edge to the south, and a
 * hearth on the flattest dry ground near the middle.
 *
 * It is a stand-in. The sandbox's world will come from world state: places
 * with properties, and instances of elements. What this hands over is already
 * in that shape (`ThingView`: a look from closed sets, and visible states),
 * so the renderer meets the real world through the same door.
 */
import { Rng } from "@rpg-jev/core/rng";
import { glyphOfChar, glyphOfExtra } from "../glyph/font.ts";
import { INK } from "../palette.ts";
import { DIR_X, DIR_Z, SHAPE, type Shape, TileGrid } from "../terrain/grid.ts";
import { kindIndex } from "../terrain/kinds.ts";
import type { ElementLook, ThingView, VisibleStates } from "../view/things.ts";
import { makeNoise } from "./demo.ts";

export const CLEARING_SIZE = 96;

export interface Clearing {
  grid: TileGrid;
  things: ThingView[];
  start: [number, number];
  hearth: [number, number];
}

const KIND = {
  grass: kindIndex("grass"),
  rock: kindIndex("rock"),
  sand: kindIndex("sand"),
  water: kindIndex("water"),
  forest: kindIndex("forest"),
  dirt: kindIndex("dirt"),
};

/** What the client is told of an element: its name, whether it fills its tile, and its look. */
interface Element {
  name: string;
  solid: boolean;
  look: ElementLook;
}

/** Stand-ins for rows of the element pool. The look is a glyph and a colour from the closed sets. */
const LOOK = {
  tree: {
    name: "an oak",
    solid: true,
    look: { glyph: glyphOfExtra("tree"), ink: INK.leaf, scale: 24, sways: true },
  },
  pine: {
    name: "a pine",
    solid: true,
    look: { glyph: glyphOfExtra("pine"), ink: INK.pine, scale: 26, sways: true },
  },
  bush: {
    name: "a bramble",
    solid: false,
    look: { glyph: glyphOfExtra("bush"), ink: INK.grass, sways: true },
  },
  reed: {
    name: "reeds",
    solid: false,
    look: { glyph: glyphOfExtra("reed"), ink: INK.leaf, sways: true },
  },
  stone: {
    name: "loose stone",
    solid: false,
    look: { glyph: glyphOfExtra("rock"), ink: INK.ash },
  },
  fire: {
    name: "a fire",
    solid: true,
    look: { glyph: glyphOfExtra("flame"), ink: INK.lamp, scale: 18 },
  },
  rat: {
    name: "a rat",
    solid: false,
    look: { glyph: glyphOfChar("r"), ink: INK.sand, scale: 12 },
  },
} as const satisfies Record<string, Element>;

function place(element: Element, x: number, z: number, states: VisibleStates): ThingView {
  return { name: element.name, solid: element.solid, x, z, look: element.look, states };
}

function shapeLand(grid: TileGrid, rng: Rng): void {
  const hills = makeNoise(rng);
  const ridge = makeNoise(rng);
  const woods = makeNoise(rng);
  for (let z = 0; z < grid.depth; z++) {
    for (let x = 0; x < grid.width; x++) {
      const level = 2 + Math.floor(hills(x, z) * 6);
      const crag = ridge(x + 40, z + 90);
      if (crag > 0.6) {
        // The quarry: where the ridge noise runs high the ground steps up sharply into bare rock.
        grid.set(x, z, { height: level + 3 + Math.floor((crag - 0.6) * 30), kind: KIND.rock });
      } else {
        grid.set(x, z, { height: level, kind: woods(x, z) > 0.52 ? KIND.forest : KIND.grass });
      }
    }
  }
}

/** A stream from the north edge to the south: it wanders, and it never runs uphill. */
function carveStream(grid: TileGrid, rng: Rng): void {
  const wander = makeNoise(rng);
  let bed = Number.POSITIVE_INFINITY;
  for (let z = 0; z < grid.depth; z++) {
    const centre = Math.floor(grid.width * 0.3 + (wander(200, z * 2.5) - 0.5) * grid.width * 0.7);
    const width = wander(z, 300) > 0.6 ? 3 : 2;
    bed = Math.min(bed, grid.heightAt(centre, z));
    for (let x = centre - 1; x <= centre + width; x++) {
      if (!grid.contains(x, z)) continue;
      const bank = x < centre || x >= centre + width;
      if (!bank) grid.set(x, z, { height: bed - 1, kind: KIND.water, shape: SHAPE.flat });
      else if (grid.kindAt(x, z) !== KIND.water && grid.kindAt(x, z) !== KIND.rock) {
        grid.set(x, z, { height: Math.min(grid.heightAt(x, z), bed), kind: KIND.sand });
      }
    }
  }
}

/** One-level steps on open ground become ramps here and there, so the land can be walked. */
function softenSteps(grid: TileGrid, rng: Rng): void {
  for (let z = 1; z < grid.depth - 1; z++) {
    for (let x = 1; x < grid.width - 1; x++) {
      if (grid.kindAt(x, z) === KIND.water || rng.next() > 0.5) continue;
      const d = Math.floor(rng.next() * 4);
      const rise = grid.heightAt(x + (DIR_X[d] ?? 0), z + (DIR_Z[d] ?? 0)) - grid.heightAt(x, z);
      if (rise === 1) grid.set(x, z, { shape: (SHAPE.slantN + d) as Shape });
    }
  }
}

function nearWater(grid: TileGrid, x: number, z: number, reach: number): boolean {
  for (let dz = -reach; dz <= reach; dz++) {
    for (let dx = -reach; dx <= reach; dx++) {
      if (grid.kindAt(x + dx, z + dz) === KIND.water) return true;
    }
  }
  return false;
}

/** The flattest dry open ground near the middle: where somebody would have lit a fire. */
function findHearth(grid: TileGrid): [number, number] {
  let best: [number, number] = [Math.floor(grid.width / 2), Math.floor(grid.depth / 2)];
  let bestCost = Number.POSITIVE_INFINITY;
  for (let z = 8; z < grid.depth - 8; z++) {
    for (let x = 8; x < grid.width - 8; x++) {
      if (grid.kindAt(x, z) !== KIND.grass || nearWater(grid, x, z, 3)) continue;
      let rough = 0;
      for (let dz = -2; dz <= 2; dz++) {
        for (let dx = -2; dx <= 2; dx++) {
          rough += Math.abs(grid.heightAt(x + dx, z + dz) - grid.heightAt(x, z));
          if (grid.kindAt(x + dx, z + dz) === KIND.rock) rough += 2;
        }
      }
      const cost = rough * 6 + Math.hypot(x - grid.width / 2, z - grid.depth / 2);
      if (cost < bestCost) {
        bestCost = cost;
        best = [x, z];
      }
    }
  }
  return best;
}

interface Growth {
  look: Element;
  chance: number;
  states(rng: Rng): VisibleStates;
}

const plant = (rng: Rng): VisibleStates => ({ growth: 1 + Math.floor(rng.next() * 4) });
const loose = (rng: Rng): VisibleStates => ({ amount: 1 + Math.floor(rng.next() * 5) });

/** What grows or lies on each kind of ground, and how commonly. */
const GROWS: Readonly<Record<number, readonly Growth[]>> = {
  [KIND.forest]: [
    { look: LOOK.tree, chance: 0.22, states: plant },
    { look: LOOK.pine, chance: 0.12, states: plant },
  ],
  [KIND.grass]: [
    { look: LOOK.bush, chance: 0.03, states: plant },
    { look: LOOK.tree, chance: 0.012, states: plant },
    { look: LOOK.stone, chance: 0.006, states: loose },
  ],
  [KIND.rock]: [{ look: LOOK.stone, chance: 0.09, states: loose }],
  [KIND.sand]: [{ look: LOOK.reed, chance: 0.25, states: plant }],
};

function scatter(grid: TileGrid, rng: Rng, keepClear: [number, number], out: ThingView[]): void {
  for (let z = 0; z < grid.depth; z++) {
    for (let x = 0; x < grid.width; x++) {
      const nearHearth = Math.hypot(x - keepClear[0], z - keepClear[1]) < 4;
      if (nearHearth || grid.shapeAt(x, z) !== SHAPE.flat) continue;
      let draw = rng.next();
      for (const option of GROWS[grid.kindAt(x, z)] ?? []) {
        if (draw < option.chance) {
          out.push(place(option.look, x, z, option.states(rng)));
          break;
        }
        draw -= option.chance;
      }
    }
  }
}

export function buildClearing(seed = 1): Clearing {
  const rng = Rng.fromSeed(seed);
  const grid = new TileGrid(CLEARING_SIZE, CLEARING_SIZE);
  shapeLand(grid, rng);
  carveStream(grid, rng);
  softenSteps(grid, rng);

  const hearth = findHearth(grid);
  const level = grid.heightAt(hearth[0], hearth[1]);
  const things: ThingView[] = [];
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = hearth[0] + dx;
      const z = hearth[1] + dz;
      grid.set(x, z, { height: level, kind: KIND.dirt, shape: SHAPE.flat });
      // A ring of stones with a gap to the south, and the fire in the middle.
      if (dx === 0 && dz === 0) things.push(place(LOOK.fire, x, z, { burning: 4 }));
      else if (!(dx === 0 && dz === 1)) things.push(place(LOOK.stone, x, z, { amount: 3 }));
    }
  }
  things.push(place(LOOK.rat, hearth[0] + 3, hearth[1] - 2, {}));
  scatter(grid, rng, hearth, things);
  return { grid, things, start: [hearth[0], hearth[1] + 3], hearth };
}
