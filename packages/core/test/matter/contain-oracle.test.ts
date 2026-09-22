/**
 * The matter containment process against the flat holder module it ports (`src/containment`):
 * on every seeded case the flat module can represent (one material per holder, which is all
 * it supports), the two reach the same verdict, and both conserve what is poured. The flat
 * module counts millilitres; matter counts amount, so a hundred millilitres is one amount and
 * holders come in the capacities a matter container of each size holds (4 ** (size - 1)).
 */
import { describe, expect, it } from "vitest";
import { type Holder, resolveContainment, type State } from "../../src/containment/index.ts";
import { interiorOf } from "../../src/matter/contain.ts";
import { placeOf, worldOf } from "../../src/matter/pool.ts";
import { resolve } from "../../src/matter/resolve.ts";
import { type Element, FRESH, type MatterWorld } from "../../src/matter/types.ts";
import { Rng } from "../../src/rng.ts";

const ML = 100;
const SIZES = [1, 2, 3, 4] as const;
const capacityOf = (size: number) => 4 ** (size - 1) * ML;

const ELEMENTS: Element[] = [
  ...SIZES.map(
    (size): Element => ({
      id: `jar${size}`,
      name: "a jar",
      kind: "thing",
      forms: ["hollow"],
      props: { size, mass: size },
    }),
  ),
  { id: "milk", name: "milk", kind: "material", forms: ["liquid"], props: { size: 1, mass: 1 } },
];

interface Case {
  flat: State;
  sizes: Record<string, number>;
  source: string;
  destination: string;
  quantityMl: number;
}

function draw(rng: Rng): Case {
  const sizes: Record<string, number> = {};
  const holders: Holder[] = ["a", "b"].map((id) => {
    const size = SIZES[Math.floor(rng.next() * SIZES.length)] as number;
    sizes[id] = size;
    const capacityMl = capacityOf(size);
    const quantityMl = Math.floor(rng.next() * (capacityMl / ML + 1)) * ML;
    return {
      id,
      label: id,
      look: { glyph: 0, ink: 1 },
      capacityMl,
      portable: true,
      open: rng.next() < 0.8,
      placement: { kind: "ground", x: 0, z: 0 },
      contents: quantityMl > 0 ? { material: "milk", quantityMl } : null,
      version: 1,
    };
  });
  const same = rng.next() < 0.1;
  return {
    flat: {
      actors: [{ id: "me", x: 0, z: 0, version: 1, carrySlots: 2 }],
      holders,
      materials: [{ id: "milk", label: "milk" }],
    },
    sizes,
    source: "a",
    destination: same ? "a" : "b",
    quantityMl: (1 + Math.floor(rng.next() * 8)) * ML,
  };
}

function toMatter(c: Case): MatterWorld {
  const world = worldOf(ELEMENTS, [placeOf("yard")]);
  for (const holder of c.flat.holders) {
    world.things[holder.id] = {
      id: holder.id,
      element: `jar${c.sizes[holder.id]}`,
      place: "yard",
      state: { ...FRESH },
    };
    world.places[interiorOf(holder.id)] = placeOf(interiorOf(holder.id), {
      air: holder.open ? 5 : 0,
    });
    if (holder.contents)
      world.things[`${holder.id}.milk`] = {
        id: `${holder.id}.milk`,
        element: "milk",
        place: interiorOf(holder.id),
        state: { ...FRESH, amount: holder.contents.quantityMl / ML },
      };
  }
  return world;
}

const milkIn = (world: MatterWorld, holder: string) =>
  Object.values(world.things)
    .filter((t) => t.element === "milk" && t.place === interiorOf(holder))
    .reduce((sum, t) => sum + t.state.amount * ML, 0);

describe("matter containment agrees with the flat holder module", () => {
  it("on 2,000 seeded transfers and openings, verdicts and totals match", () => {
    const rng = Rng.fromSeed(20260922);
    let applied = 0;
    for (let i = 0; i < 2000; i++) {
      const c = draw(rng);
      const versions = { me: 1, a: 1, b: 1 };
      const flat = resolveContainment(c.flat, {
        actor: "me",
        versions,
        action: {
          kind: "transfer",
          source: c.source,
          destination: c.destination,
          quantityMl: c.quantityMl,
        },
      });
      const world = toMatter(c);
      const liquid = world.things[`${c.source}.milk`];
      const outcome = resolve(world, {
        process: "contain",
        how: "pour",
        container: c.destination,
        thing: liquid?.id ?? "none",
        amount: c.quantityMl / ML,
      });
      const refused = outcome.changes.some((change) => change.kind === "nothing");
      expect(refused, `case ${i}: flat said ${flat.reason}`).toBe(flat.status !== "applied");
      if (flat.status !== "applied") continue;
      applied++;
      const after = new Map(flat.effects.map((e) => [e.after.id, e.after] as const));
      for (const id of ["a", "b"]) {
        const holder = after.get(id) as Holder | undefined;
        expect(milkIn(outcome.world, id)).toBeCloseTo(holder?.contents?.quantityMl ?? 0);
      }
    }
    expect(applied).toBeGreaterThan(200);
  });

  it("opening and closing agree", () => {
    const rng = Rng.fromSeed(7);
    for (let i = 0; i < 200; i++) {
      const c = draw(rng);
      const open = rng.next() < 0.5;
      const flat = resolveContainment(c.flat, {
        actor: "me",
        versions: { me: 1, a: 1 },
        action: { kind: "opening", holder: "a", open },
      });
      const outcome = resolve(toMatter(c), {
        process: "contain",
        how: open ? "unseal" : "seal",
        container: "a",
      });
      const changed = !outcome.changes.some((change) => change.kind === "nothing");
      expect(changed).toBe(flat.status === "applied");
    }
  });
});
