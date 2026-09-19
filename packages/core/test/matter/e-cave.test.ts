/**
 * Batch E (held out), the cave scenarios, run through the matter engine with the rules frozen.
 * Each test asserts what the scenario says a sensible person expects. `it.fails` marks an
 * outcome the rules do not produce, with the reason in brackets; a name that starts
 * `RULE ERROR:` marks one the rules get wrong. Rows are in `rows-e-cave.ts`, written before
 * anything ran.
 *
 * Unbuilt, so no test: cave-12 (a drip filling a pot overnight: a source with a rate, and a
 * vessel that gathers what falls into it. A hollow thing has no contents, S8 being absent, so
 * there is nothing a test could read, and the splash on the bedroll and the ringing of the
 * drops have no act either).
 *
 * A cave here is a cold, still, dark place with an air level. Nothing falls (X1 has no fall:
 * a thing never changes place, and a move is a going across one place), nothing is inside
 * anything (S8, R2), nothing rests on, is tied to or rubs on anything (R3 as a state, R4, P14),
 * no place changes (E13), nothing flows (R7), and a signal stays in the place it was made in.
 * So a shaft and its head are two places, and what the scenario lowers, drops or hauls is
 * built where it ends up, as the earlier batches did. Parts of outcomes with no act to play
 * and no state to read are not asserted at all: the count of breaths and the guess at a depth
 * (cave-03), damage hidden inside a coil, and hours of light in what candles are left
 * (cave-04), a button lost, and the way back being harder tired or laden (cave-05), foam and a
 * dying draught as warnings, and marking a stone to see the water fall (cave-06), junctions
 * guessed at and a floor drop found by a foot (cave-07), mites, and half a sack being usable
 * (cave-08), the jerkin folded under the rope, which can only matter once something wears
 * (cave-09), flying hot flakes, and the roof over the fire loosened (cave-10), blowflies, and
 * nobody connecting the two (cave-11), the heap running in from above when its foot is taken
 * out, and a crawl cleared over its crest (cave-13: the block cannot be shifted, so there is
 * nothing to play), mud stirred by the grapple, a hoop pulled off and the staves left, and a
 * boot brought up instead (cave-14), knocks counted to pass a number, direction lost in rock,
 * and the rescuers' argument (cave-15).
 *
 * In cave-15 the wall is put in the trapped miner's level, where he strikes it. Force does not
 * ask where its parties are, so a wall put in the rescuers' level would be heard by them when
 * struck from the other: that is a missing check, not rock carrying a knock, and is not used.
 *
 * Changed after the first run, and why: one encoding, in cave-04. Every `it` and `it.fails` was
 * decided from reading the engine before anything ran. The first run had one `it` failing: the
 * rat ten tiles down the adit was offered the bread to eat, not the candles to go to, because
 * the store's things had no position, and a thing with no `where` is beside everyone (distance
 * reads 0). The store's things were given the spot `[0, 0]`; with that the rat smells only the
 * tallow from ten tiles and makes for it, as predicted. No row, threshold or place was changed,
 * and no `it.fails` turned out to pass. The engine's numbers were printed afterwards to check
 * that each expected failure fails for the reason its name gives (a lamp's blaze 3.5 in air 3
 * and in air 1; a prop at contamination 5, integrity 0 after nine years, and a fresh one's
 * strength 3.9 against a share of 3.5; the barrow at 4.88 under the slab; the box at 4.81 and
 * the teeth at edge 0 after two hundred bites, the rope untouched at 5; warmth 0 beside the
 * lamp and 0.95 without it after an hour; both sacks at contamination 5; thirty logs holding
 * 1800 minutes of fuel; the ewe at health 4.93 after three days; the jackdaw offered only
 * `examine`). One row decides a pass by a narrow margin and is said here: the bracken's
 * strength is 3.13, so it gives under a ewe of mass 4 and would bear one of mass 3.
 */
import { describe, expect, it } from "vitest";
import {
  type Act,
  alight,
  type Body,
  blaze,
  canTake,
  effective,
  emits,
  type MatterWorld,
  play,
  resolve,
  routine,
  strength,
  type ThingState,
  weight,
} from "../../src/matter/index.ts";
import { body, thing, world } from "./elements.ts";
import { EXTRA } from "./rows-e-cave.ts";

const minutes = (n: number): Act => ({ process: "drift", minutes: n });
const hours = (n: number): Act => minutes(n * 60);
const days = (n: number): Act => hours(n * 24);

/** Sets fuel burning in a world that is already built. */
function lit(w: MatterWorld, id: string): MatterWorld {
  const fuel = w.things[id];
  return fuel ? { ...w, things: { ...w.things, [id]: alight(w, fuel) } } : w;
}

/** The oil in a lamp: a coat is the only oil a thing can carry. Ten measures burn two hours. */
const OILED: Partial<ThingState> = {
  coating: { element: "oil", amount: 10, coverage: 1, bond: 0 },
};

const who = (w: MatterWorld, id: string): Body => w.bodies[id] ?? body(id);

const bears = (support: string, bearing: string[]): Act => ({ process: "load", support, bearing });

/** How hard the thing burns, or nothing if it is not there. */
const flame = (w: MatterWorld, id: string): number => {
  const t = w.things[id];
  return t ? blaze(w, t) : 0;
};

describe("cave-01: a lamp lowered into a foul well", () => {
  const lampIn = (place: string) =>
    lit(
      world(
        [thing("lamp", "lamp", place, OILED), thing("line", "rope", place)],
        [body("player", { place: "wellhead", element: "person" })],
        EXTRA,
      ),
      "lamp",
    );
  const lowered = resolve(lampIn("wellbottom"), minutes(1)).world;

  it("cave-01: the lamp burns steadily on the way down the open shaft", () => {
    const after = resolve(lampIn("wellshaft"), minutes(10)).world;
    expect(after.things.lamp?.state.burning).not.toBeNull();
    expect(flame(after, "lamp")).toBeCloseTo(flame(lampIn("wellshaft"), "lamp"), 5);
  });

  it.fails("cave-01: in the thinning air above the foul layer the flame shrinks to a blue bead before it dies (blaze reads what burns, how much and how near its end: air is some or none to a flame, never less)", () => {
    expect(flame(lampIn("wellmid"), "lamp")).toBeLessThan(flame(lampIn("wellshaft"), "lamp"));
  });

  it("cave-01: in the foul air at the bottom the flame goes out", () => {
    expect(lowered.things.lamp?.state.burning).toBeNull();
  });

  it.fails("cave-01: watching from the well head, the player sees the light go down the shaft, and sees it fail (a signal reaches only bodies in its own place, and the shaft's air makes it another place)", () => {
    const after = resolve(lampIn("wellshaft"), minutes(1)).world;
    expect(after.bodies.player?.aware?.lamp).toBeDefined();
  });

  it("cave-01: hauled up, the lamp is unharmed with its oil still in it, and relights at once in the open", () => {
    const out = lowered.things.lamp?.state ?? {};
    const head = lit(
      world(
        [thing("lamp", "lamp", "wellhead", out), thing("match", "tinder", "wellhead")],
        [],
        EXTRA,
      ),
      "match",
    );
    expect(head.things.lamp?.state.integrity).toBe(5);
    expect(head.things.lamp?.state.coating?.amount).toBeGreaterThan(9);
    const relit = resolve(head, { process: "heat", source: "match", target: "lamp", minutes: 1 });
    expect(relit.world.things.lamp?.state.burning).not.toBeNull();
  });

  it.fails("cave-01: a person climbing down would grow dizzy and drop in the same place (air is no need of a body: weathered reads cold, wet, wind and the hours, and a place with no air costs whoever is in it nothing)", () => {
    const down = world([], [body("climber", { place: "wellbottom", element: "person" })], EXTRA);
    const after = resolve(down, minutes(10)).world;
    expect(after.bodies.climber?.health ?? 5).toBeLessThan(5);
  });

  it("cave-01: the bad air is still there tomorrow, since nothing stirs it", () => {
    expect(resolve(lowered, days(1)).world.places.wellbottom?.air).toBe(0);
  });

  it("cave-01: the rope comes up damp along the length that hung in the wet of the bottom", () => {
    const after = resolve(lampIn("wellbottom"), minutes(10)).world;
    expect(after.things.line?.state.wetness).toBeGreaterThan(1);
  });
});

describe("cave-02: pit props rotting under a roof", () => {
  const years = resolve(world([thing("old", "pitprop", "tinlevel")], [], EXTRA), days(365 * 9));
  const rotten: Partial<ThingState> = years.world.things.old?.state ?? {};
  // A cart-sized slab over eight props: each bears an eighth of it.
  const level = (state: Partial<ThingState>) =>
    world(
      [
        thing("a", "pitprop", "tinlevel", state),
        thing("b", "pitprop", "tinlevel"),
        thing("share", "roofslab", "tinlevel", { amount: 1 / 8 }),
        thing("slab", "roofslab", "tinlevel"),
        thing("barrow", "barrow", "tinlevel"),
      ],
      [],
      EXTRA,
    );
  const gives = resolve(level(rotten), bears("a", ["share"]));

  it("cave-02: a sound prop bears its share of the roof; years of damp and rot take its strength, and it crushes under the same share", () => {
    const [fresh, gone] = [level({}), level(rotten)];
    expect(resolve(fresh, bears("a", ["share"])).world.things.a?.state.integrity).toBe(5);
    expect(rotten.contamination ?? 0).toBeGreaterThan(3);
    const [a, old] = [fresh.things.a, gone.things.a];
    expect(old ? strength(gone, old) : 9).toBeLessThan((a ? strength(fresh, a) : 0) - 1);
    expect(gives.world.things.a?.state.integrity).toBeLessThanOrEqual(1);
  });

  it.fails("cave-02: a prop carrying nearly all it can shows it for weeks: bulging, shedding splinters, grit from the roof (load is held or not at a moment: there is no step between whole and broken under a standing load, and nothing is given off until it goes)", () => {
    const { world: after, changes } = resolve(level({}), bears("a", ["share"]));
    const shown = changes.some((c) => c.kind === "signal");
    expect(shown || (after.things.a?.state.integrity ?? 5) < 5).toBe(true);
  });

  it("cave-02: someone who came to look would have found the rot: the far-gone prop smells of it, where a sound one gives nothing away in the dark", () => {
    const visit = world(
      [thing("old", "pitprop", "tinlevel", rotten), thing("sound", "pitprop", "tinlevel")],
      [body("visitor", { place: "tinlevel", element: "person" })],
      EXTRA,
    );
    const aware = resolve(visit, minutes(1)).world.bodies.visitor?.aware ?? {};
    expect(aware.old?.channel).toBe("scent");
    expect(aware.sound).toBeUndefined();
  });

  it.fails("cave-02: when one prop crushes its neighbours take up its load (load is a check on one support: nothing rests on anything as a state, so a failed prop hands nothing on)", () => {
    expect(gives.changes.some((c) => c.kind === "state" && c.thing === "b")).toBe(true);
  });

  it.fails("cave-02: with the props gone the slab comes down on the barrow under it (what a failed support held becomes no force on what is below: only a body that was borne is hurt)", () => {
    expect(gives.world.things.barrow?.state.integrity).toBeLessThan(5);
  });

  it.fails("RULE ERROR: cave-02: a cart-sized slab of rock landing on a wooden barrow flattens it (what is tough never breaks under a blow, however heavy: the harder thing only mars it, by a tenth of a level)", () => {
    const lands: Act = {
      process: "force",
      instrument: "slab",
      patient: "barrow",
      manner: { effort: 5, care: 0, haste: 5 },
    };
    expect(resolve(level({}), lands).world.things.barrow?.state.integrity).toBeLessThanOrEqual(1);
  });

  it.fails("cave-02: the level is blocked by a heap of rubble, and dust hangs for an hour (no act changes a place, E13 being absent, and a support that gives way makes nothing: no rubble, no dust)", () => {
    const made = gives.changes.some((c) => c.kind === "create");
    const blocked =
      JSON.stringify(gives.world.places.tinlevel) !== JSON.stringify(level({}).places.tinlevel);
    expect(made || blocked).toBe(true);
  });
});

describe("cave-03: a stone dropped down a pothole", () => {
  const lip = world(
    [
      thing("rock", "stone", "moor"),
      thing("ledge", "limestone", "pothole", { amount: 1 }),
      thing("pool", "water", "pothole", { amount: 500, temperature: 1 }),
    ],
    [
      body("player", { place: "moor", element: "person" }),
      body("daw", { place: "pothole", element: "jackdaw", where: [0, 3], needs: { hunger: 1 } }),
    ],
    EXTRA,
  );
  // The stone as it is on the way down: in the shaft.
  const falling: MatterWorld = {
    ...lip,
    things: { ...lip.things, rock: thing("rock", "stone", "pothole") },
  };
  const hard = { effort: 4, care: 0, haste: 4 };
  const cracks = resolve(falling, {
    process: "force",
    instrument: "rock",
    patient: "ledge",
    manner: hard,
  });

  it.fails("cave-03: let go over the hole, the stone ends at the bottom and is gone for good (setting a thing down leaves it where the body stands: X1 has no fall, and a thing never changes place)", () => {
    const dropped = play(lip, [
      { process: "take", body: "player", thing: "rock" },
      { process: "take", body: "player", thing: "rock", drop: true },
    ]).world;
    expect(dropped.things.rock?.place).toBe("pothole");
  });

  it("cave-03: striking the ledge partway down, the stone cracks off it sharply", () => {
    const loud = cracks.changes.some(
      (c) => c.kind === "signal" && c.channel === "sound" && c.strength >= 3,
    );
    expect(loud).toBe(true);
  });

  it.fails("cave-03: and the player at the lip hears it, and so learns of the ledge (a signal reaches only bodies in its own place: nothing made in the shaft comes up out of it)", () => {
    expect(cracks.world.bodies.player?.aware?.ledge).toBeDefined();
  });

  it.fails("cave-03: it ends in a deep plop, which tells of standing water (what flows is not struck: a blow goes through it, and makes no sound at all)", () => {
    const { changes } = resolve(falling, {
      process: "force",
      instrument: "rock",
      patient: "pool",
      manner: hard,
    });
    expect(changes.some((c) => c.kind === "signal" && c.channel === "sound")).toBe(true);
  });

  it("cave-03: the jackdaws nesting in the shaft wall hear the crack", () => {
    expect(cracks.world.bodies.daw?.aware?.ledge?.channel).toBe("sound");
  });

  it.fails("cave-03: and burst out past the player's face (a sudden noise is strange, not a menace: threat comes only from a body, so the offer is to look into it, never to get away)", () => {
    expect(routine(cracks.world, who(cracks.world, "daw")).intent).toBe("keep_away");
  });
});

describe("cave-04: rats in the miners' store", () => {
  const greased: Partial<ThingState> = {
    coating: { element: "tallow", amount: 0.2, coverage: 0.8, bond: 2 },
  };
  const store = (ratAt: readonly [number, number]) =>
    world(
      [
        thing("bread", "oatbread", "adit", { amount: 6 }),
        thing("candles", "tallow", "adit", { amount: 24 }),
        thing("box", "dealbox", "adit"),
        thing("tinderbox", "tin", "adit"),
        thing("coil", "rope", "adit", greased),
        thing("teeth", "ratteeth", "adit", { edge: 3 }),
        // The store is a spot in the adit: a thing with no position is beside everyone.
      ].map((t) => ({ ...t, where: [0, 0] as const })),
      [body("rat", { place: "adit", element: "rat", where: ratAt, needs: { hunger: 3 } })],
      EXTRA,
    );
  const gnaws = (patient: string): Act => ({ process: "force", instrument: "teeth", patient });
  const many = (act: Act, n: number): Act[] => Array.from({ length: n }, () => act);

  /** What the rat does with nobody watching: the first of its offers, over and over. */
  function left(start: MatterWorld, turns: number) {
    let at = resolve(start, minutes(1)).world;
    const eaten: string[] = [];
    for (let i = 0; i < turns; i++) {
      const act = routine(at, who(at, "rat")).act;
      if (!act) break;
      if (act.process === "ingest") eaten.push(at.things[act.thing]?.element ?? "");
      at = resolve(at, act).world;
    }
    return { world: at, eaten };
  }

  it("cave-04: a hungry rat down the adit catches the smell of the tallow in the dark and makes for the store", () => {
    const far = resolve(store([10, 0]), minutes(1)).world;
    expect(far.bodies.rat?.aware?.candles?.channel).toBe("scent");
    expect(routine(far, who(far, "rat")).id).toBe("go_to:candles");
  });

  it("cave-04: it eats the bread first and then the candles, which are fat and so food to it, and the miner comes back to no bread and far fewer candles", () => {
    const { world: after, eaten } = left(store([1, 0]), 20);
    expect(eaten[0]).toBe("oatbread");
    expect(eaten.lastIndexOf("oatbread")).toBeLessThan(eaten.indexOf("tallow"));
    expect(after.things.bread).toBeUndefined();
    expect(after.things.candles?.state.amount ?? 0).toBeLessThan(20);
  });

  it("cave-04: a wooden box is no barrier to teeth, which bite into deal, and the tin is untouched", () => {
    expect(resolve(store([1, 0]), gnaws("box")).world.things.box?.state.integrity).toBeLessThan(5);
    const tried = play(store([1, 0]), many(gnaws("tinderbox"), 20)).world;
    expect(tried.things.tinderbox?.state.integrity).toBe(5);
  });

  it.fails("cave-04: over five nights they gnaw a hole through the corner of the candle box (an edge wears with every stroke and nothing whets a tooth, so a dozen bites blunt it; and a box is one integrity, with no corner to hole)", () => {
    const after = play(store([1, 0]), many(gnaws("box"), 200)).world;
    expect(after.things.box?.state.integrity).toBeLessThanOrEqual(3);
  });

  it.fails("cave-04: they chew the greased rope for its fat (a coat lends its surface to what it covers, not what it serves: a rope greased with tallow is no food to anything)", () => {
    const { world: after } = left(store([1, 0]), 40);
    expect(after.things.coil?.state.integrity).toBeLessThan(5);
  });

  it.fails("RULE ERROR: cave-04: gnawed at night after night, strands of the rope are bitten through and it bears less than it did (a cut sets keenness against toughness at each stroke, and a stroke that falls short leaves nothing behind: teeth that cannot part a rope at one bite barely mark it in a thousand)", () => {
    const before = store([1, 0]);
    const after = play(before, many(gnaws("coil"), 200)).world;
    const [was, now] = [before.things.coil, after.things.coil];
    expect(now ? strength(after, now) : 9).toBeLessThan(was ? strength(before, was) : 0);
  });

  it.fails("cave-04: droppings and crumbs tell the miner that rats did it (eating consumes and leaves nothing: no droppings, no crumbs, no trace for anyone to read)", () => {
    const before = store([1, 0]);
    const { world: after } = left(before, 20);
    const fresh = Object.keys(after.things).filter((id) => !(id in before.things));
    expect(fresh.length).toBeGreaterThan(0);
  });
});

describe("cave-05: a squeeze, with a pack", () => {
  const rift = lit(
    world(
      [
        thing("pack", "pack", "rift"),
        thing("lamp", "lamp", "rift", OILED),
        thing("coat", "cloth", "rift"),
        thing("walls", "sharprock", "rift", { edge: 2 }),
      ],
      [body("player", { place: "rift", element: "person", where: [0, 0], wears: ["coat"] })],
      EXTRA,
    ),
    "lamp",
  );
  const through: Act = { process: "move", body: "player", to: [6, 0], minutes: 3 };
  const holding = (ids: string[]): MatterWorld => ({
    ...rift,
    bodies: { ...rift.bodies, player: { ...who(rift, "player"), holds: ids } },
  });

  it.fails("cave-05: with the pack on the player jams at the chest, and with it off they get through (no opening has a width and no body or load a bulk to set against it: fit and access are absent, and a move is only a going)", () => {
    const laden = resolve(holding(["pack"]), through).world.bodies.player?.where ?? [0, 0];
    const free = resolve(holding([]), through).world.bodies.player?.where ?? [0, 0];
    expect(laden[0]).toBeLessThan(free[0]);
  });

  it("cave-05: forced through between sharp rock, the player comes out grazed and the coat torn", () => {
    const scrape = resolve(rift, { process: "force", instrument: "walls", patient: "player" });
    const grazes = scrape.changes.flatMap((c) => (c.kind === "wound" ? [c.wound] : []));
    expect(grazes[0]?.depth ?? 0).toBeGreaterThan(0);
    expect(grazes[0]?.depth ?? 9).toBeLessThanOrEqual(2);
    expect(scrape.world.things.coat?.state.integrity).toBeLessThan(5);
  });

  it.fails("cave-05: held at arm's length and tipped, the lamp spills a third of its oil (a hollow thing has no contents to spill, and what is held only goes where its holder goes)", () => {
    const after = resolve(holding(["lamp"]), through).world;
    expect(after.things.lamp?.state.coating?.amount ?? 10).toBeLessThan(9);
  });

  it.fails("cave-05: the struggle leaves them winded and tired (tiredness comes with the hours and nothing else: no going costs any effort)", () => {
    const after = resolve(holding([]), through).world;
    expect(after.bodies.player?.needs.rest ?? 0).toBeGreaterThan(0.5);
  });
});

describe("cave-06: cut off by a rising stream", () => {
  const cave = world(
    [thing("stream", "water", "crawl", { amount: 1000, temperature: 1 })],
    [],
    EXTRA,
  );
  const shelf = (things: Parameters<typeof world>[0]) =>
    world(things, [body("explorer", { place: "chamber", element: "person", wetness: 4 })], EXTRA);
  const withLamp = lit(shelf([thing("lamp", "lamp", "chamber", OILED)]), "lamp");

  it.fails("cave-06: hours after heavy rain starts on the moor the stream rises and fills the low crawl to the roof (no drift touches a place: E13 is absent, a place has no water level, and rain in one place is nothing to another)", () => {
    const after = resolve(cave, hours(3)).world;
    expect(after.places.crawl).not.toEqual(cave.places.crawl);
  });

  it.fails("cave-06: the only warning is the stream's sound changing (emits reads burning, heat, daylight and scent: running water gives off no sound to change)", () => {
    const stream = cave.things.stream;
    expect((stream ? emits(cave, stream).sound : 0) ?? 0).toBeGreaterThan(0);
  });

  it("cave-06: wet and still at cave cold, the explorer chills within the hour and grows hungry, and most of a day of it is dangerous", () => {
    const hour = resolve(shelf([]), hours(1)).world.bodies.explorer;
    expect(hour?.needs.warmth ?? 0).toBeGreaterThan(0.5);
    const day = resolve(shelf([]), hours(18)).world.bodies.explorer;
    expect(day?.needs.warmth ?? 0).toBeGreaterThanOrEqual(4);
    expect(day?.needs.hunger ?? 0).toBeGreaterThan(4);
    expect(day?.health ?? 5).toBeLessThan(5);
  });

  it.fails("RULE ERROR: cave-06: with the lamp burning beside them they are cold all the same (whatever burns in a place warms a body by how hard it burns, and oil burns hard: a lamp flame counts for most of a hearth, and keeps off all the cold of a cave)", () => {
    const hour = resolve(withLamp, hours(1)).world.bodies.explorer;
    expect(hour?.needs.warmth ?? 0).toBeGreaterThan(0.3);
  });

  it("cave-06: the wait uses up the light: the lamp is out long before the water would drop", () => {
    const after = resolve(withLamp, hours(18)).world;
    expect(after.things.lamp?.state.burning).toBeNull();
  });
});

describe("cave-07: the lamp runs out an hour from daylight", () => {
  const deep = lit(
    world(
      [
        thing("lamp", "lamp", "drycave", OILED),
        thing("tinderbox", "tin", "drycave"),
        thing("striker", "steel", "drycave"),
        thing("flint", "flint", "drycave"),
        thing("wick", "wick", "drycave"),
      ],
      [body("player", { place: "drycave", element: "person", where: [0, 0] })],
      EXTRA,
    ),
    "lamp",
  );
  const here = resolve(deep, hours(1)).world;
  const dark = resolve(here, minutes(61)).world;
  const strike: Act = {
    process: "force",
    instrument: "striker",
    patient: "flint",
    manner: { effort: 3, care: 2, haste: 2 },
  };

  it("cave-07: two hours of oil, one used getting here: the lamp burns on for the hour left and then dies, empty", () => {
    expect(here.things.lamp?.state.burning?.fuel).toBeCloseTo(60, 0);
    expect(dark.things.lamp?.state.burning).toBeNull();
    expect(dark.things.lamp?.state.coating).toBeNull();
  });

  it("cave-07: the flame shrinks as the oil gets low", () => {
    const low = resolve(here, minutes(58)).world;
    expect(flame(low, "lamp")).toBeLessThan(flame(here, "lamp"));
    expect(flame(low, "lamp")).toBeGreaterThan(0);
  });

  it.fails("RULE ERROR: cave-07: while it burns the player sees the cave by it (a lit lamp is itself seen, but lights nothing: a thing is seen by the light of its place alone, so in a cave the lamp shows only the lamp)", () => {
    expect(here.bodies.player?.aware?.lamp?.channel).toBe("light");
    expect(here.bodies.player?.aware?.tinderbox).toBeDefined();
  });

  it("cave-07: with the lamp dead the dark is total, and the player sees nothing", () => {
    const seen = Object.values(dark.bodies.player?.aware ?? {}).filter(
      (p) => p.channel === "sight" || p.channel === "light",
    );
    expect(seen).toEqual([]);
  });

  it("cave-07: the tinderbox still gives sparks", () => {
    const { changes } = resolve(dark, strike);
    expect(changes.some((c) => c.kind === "signal" && c.channel === "light")).toBe(true);
  });

  it.fails("cave-07: a spark caught on the dry wick sets it glowing for a minute (a spark is a light signal: it is no hot thing, it lands nowhere and meets no surface)", () => {
    expect(resolve(dark, strike).world.things.wick?.state.burning).not.toBeNull();
  });

  it.fails("cave-07: feeling along the wall in the dark, the way out takes many times as long as it did by light (what a body can do reads hurt, cold, tiredness and sickness: no sense bears on going, so the blind cover ground as fast as the sighted)", () => {
    const walk = (place: string) => {
      const w = world([], [body("walker", { place, element: "person", where: [0, 0] })], EXTRA);
      const out = resolve(w, { process: "move", body: "walker", to: [500, 0], minutes: 5 }).world;
      return out.bodies.walker?.where?.[0] ?? 0;
    };
    expect(walk("drycave")).toBeLessThan(walk("hearth") / 2);
  });
});

describe("cave-08: two sacks of flour in a cellar", () => {
  const cellar = world(
    [thing("floor", "floursack", "cellar"), thing("shelf", "floursack", "cellar")],
    [],
    EXTRA,
  );
  const later = resolve(cellar, days(42)).world;

  it.fails("cave-08: the sack set on the earth floor draws damp up from it, and is wetter than the one on the slatted shelf (wetting reads the air of the place and nothing else: nothing touches or rests on anything, so damp does not pass from a wet thing to a dry one)", () => {
    const fortnight = resolve(cellar, days(14)).world;
    expect(fortnight.things.floor?.state.wetness ?? 0).toBeGreaterThan(
      (fortnight.things.shelf?.state.wetness ?? 0) + 0.5,
    );
  });

  it("cave-08: six weeks on, the damp flour is mouldy, musty and not fit to eat", () => {
    const floor = later.things.floor;
    expect(floor?.state.contamination).toBeGreaterThan(3);
    expect(floor ? effective(later, floor).noxiousness : 0).toBeGreaterThan(2);
    expect(floor ? effective(later, floor).scent : 0).toBeGreaterThan(1);
  });

  it.fails("RULE ERROR: cave-08: the sack on the shelf, with air under it, is sound (cool damp air alone wets whatever drinks as far as the place allows, and rot follows the wetness: on the shelf or on the floor, both sacks spoil alike)", () => {
    expect(later.things.shelf?.state.contamination).toBeLessThan(1);
  });
});

describe("cave-09: a rope sawing over a sharp lip", () => {
  const pitch = world(
    [
      thing("line", "rope", "pitchhead"),
      thing("worn", "rope", "pitchhead", { integrity: 2.5 }),
      thing("lip", "limestone", "pitchhead", { edge: 2 }),
      thing("ore", "oresack", "pitchhead"),
    ],
    [body("player", { place: "pitchhead", element: "person" })],
    EXTRA,
  );
  const bare = bears("line", ["player"]);
  const laden = bears("line", ["player", "ore"]);
  const parts = resolve(pitch, bears("worn", ["player", "ore"]));

  it("cave-09: the anchored rope bears the player down and up, and bears them with a sack of ore", () => {
    expect(resolve(pitch, bare).world.things.line?.state.integrity).toBe(5);
    expect(resolve(pitch, laden).world.things.line?.state.integrity).toBe(5);
    expect(weight(pitch, ["player", "ore"])).toBeGreaterThan(weight(pitch, ["player"]));
  });

  it.fails("cave-09: each trip saws the loaded rope over the sharp lip, and on the third climb, with a sack, it parts (friction is read by no rule and no act wears what rubs: a load is a check that leaves nothing behind, and the rope has no lip to run over)", () => {
    const after = play(pitch, [bare, bare, bare, laden, bare, laden]).world;
    expect(after.things.line?.state.integrity).toBeLessThanOrEqual(1);
  });

  it("cave-09: a rope cut half through at one spot parts under the laden climber, who falls and is hurt", () => {
    expect(parts.world.things.worn?.state.integrity).toBeLessThanOrEqual(1);
    expect(parts.changes.some((c) => c.kind === "wound" && c.body === "player")).toBe(true);
  });

  it.fails("cave-09: the rope is in two pieces, a short end on the boss and the long one below (a support that gives way drops to broken and never divides: only a blow or a shaving makes a piece)", () => {
    const ropes = Object.values(parts.world.things).filter((t) => t.element === "rope");
    expect(ropes.length > 2 || (parts.world.things.worn?.state.amount ?? 1) < 1).toBe(true);
  });
});

describe("cave-10: fire-setting, the burning", () => {
  const heading = lit(
    world(
      [
        thing("face", "quartzface", "copperlevel"),
        thing("pile", "firewood", "copperlevel", { amount: 30 }),
      ],
      [body("miner", { place: "copperlevel", element: "person", where: [12, 0] })],
      EXTRA,
    ),
    "pile",
  );

  it("cave-10: hours of fire stacked against the face heat the rock through", () => {
    const fired = resolve(heading, {
      process: "heat",
      source: "pile",
      target: "face",
      minutes: 360,
    }).world;
    expect(fired.things.face?.state.temperature).toBeGreaterThanOrEqual(4.5);
  });

  it.fails("cave-10: the blind level fills with smoke, and nobody can stay in it (fire uses no air and smoke is a signal, not a gas that gathers: the air of a place changes by nothing, and no body needs it)", () => {
    const after = resolve(heading, hours(6)).world;
    const fouled = (after.places.copperlevel?.air ?? 2) < (heading.places.copperlevel?.air ?? 2);
    expect(fouled || (after.bodies.miner?.health ?? 5) < 5).toBe(true);
  });

  it.fails("RULE ERROR: cave-10: by the next morning the wood is gone to ash (fuel is the burning time of one log times how many there are: a stack burns log after log and never together, so thirty logs burn for thirty hours)", () => {
    const morning = resolve(heading, hours(24)).world;
    expect(morning.things.pile).toBeUndefined();
    expect(Object.values(morning.things).some((t) => t.element === "ash")).toBe(true);
  });
});

describe("cave-10: fire-setting, the quenching", () => {
  const hot = world(
    [
      thing("face", "quartzface", "copperlevel", { temperature: 5 }),
      thing("cold", "quartzface", "copperlevel"),
      thing("buckets", "water", "copperlevel", { amount: 3, temperature: 1 }),
      thing("pick", "pick", "copperlevel", { edge: 2 }),
    ],
    [],
    EXTRA,
  );
  const throwOn = (target: string): Act => ({
    process: "heat",
    source: "buckets",
    target,
    minutes: 1,
  });
  const quenched = resolve(hot, throwOn("face"));
  const swing = (patient: string): Act => ({
    process: "force",
    instrument: "pick",
    patient,
    manner: { effort: 4, care: 2, haste: 2 },
  });
  /** How much rock one swing of the pick brings away. */
  const won = (w: MatterWorld, patient: string): number =>
    (w.things[patient]?.state.amount ?? 0) -
    (resolve(w, swing(patient)).world.things[patient]?.state.amount ?? 0);

  it("cave-10: water thrown on the hot face cracks it, and thrown on cold rock does nothing", () => {
    expect(quenched.world.things.face?.state.integrity).toBeLessThanOrEqual(3);
    expect(resolve(hot, throwOn("cold")).world.things.cold?.state.integrity).toBe(5);
  });

  it.fails("cave-10: with a rush of steam (steam is given off only where water meets what burns: on scorching rock it cools and cracks in silence)", () => {
    const soaked = resolve(hot, { process: "soak", liquid: "buckets", target: "face", amount: 1 });
    const steams = [...quenched.changes, ...soaked.changes].some(
      (c) => c.kind === "signal" && c.channel === "smoke",
    );
    expect(steams).toBe(true);
  });

  it.fails("cave-10: afterwards the shattered rock comes away easily, where the sound face barely marks under the same pick (a blow reads toughness, a hidden flaw and bulk: a crack already in a thing does not make it give more)", () => {
    expect(won(quenched.world, "face")).toBeGreaterThan(won(hot, "cold") * 2);
  });
});

describe("cave-11: a ewe down a hidden shaft", () => {
  const grazing = world(
    [thing("bracken", "bracken", "hill")],
    [
      body("ewe", { place: "hill", element: "ewe" }),
      body("shepherd", { place: "fields", element: "person" }),
    ],
    EXTRA,
  );
  const fell = resolve(grazing, bears("bracken", ["ewe"]));
  const shaft = world(
    [
      thing("carcass", "meat", "sheepshaft", { amount: 8 }),
      thing("stream", "water", "sheepshaft", { amount: 1000 }),
      thing("fouled", "water", "sheepshaft", { amount: 1000, contamination: 3 }),
      thing("spring", "water", "spring", { amount: 1000 }),
    ],
    [body("villager", { place: "spring", element: "person" })],
    EXTRA,
  );
  const week = resolve(shaft, days(7)).world;

  it("cave-11: the bracken over the shaft mouth bears nothing of a ewe's weight: she goes through it and is hurt by the fall", () => {
    expect(fell.world.things.bracken?.state.integrity).toBeLessThanOrEqual(1);
    expect(fell.changes.some((c) => c.kind === "wound" && c.body === "ewe")).toBe(true);
  });

  it.fails("cave-11: her bleating may reach the shepherd two fields away on a still evening (no act gives voice, and a signal reaches only bodies in its own place)", () => {
    const evening = resolve(fell.world, hours(2)).world;
    expect(Object.keys(evening.bodies.shepherd?.aware ?? {}).length).toBeGreaterThan(0);
  });

  it.fails("cave-11: hurt and without water, she is dead within three days (thirst is no need, hunger costs no health, and nothing dies: only cold and bleeding take health)", () => {
    const after = resolve(fell.world, days(3)).world;
    expect(after.bodies.ewe?.health ?? 5).toBeLessThanOrEqual(0);
  });

  it("cave-11: in warm weather the carcass is foul within the week, and the shaft smells of it", () => {
    const carcass = week.things.carcass;
    expect(carcass?.state.contamination).toBeGreaterThan(3);
    expect((carcass ? emits(week, carcass).scent : 0) ?? 0).toBeGreaterThanOrEqual(4);
  });

  it.fails("cave-11: water running over the rotting carcass carries the rot away with it (soak moves what the liquid carries into what it wets and never the other way: nothing rotten fouls the water that washes it)", () => {
    const washed = resolve(week, {
      process: "soak",
      liquid: "stream",
      target: "carcass",
      amount: 20,
    }).world;
    expect(washed.things.stream?.state.contamination ?? 0).toBeGreaterThan(0.5);
  });

  it.fails("cave-11: and the stream brings it out at the spring at the hill foot (nothing flows: R7 is absent, and what is in one place never reaches another)", () => {
    const fortnight = resolve(shaft, days(14)).world;
    expect(fortnight.things.spring?.state.contamination ?? 0).toBeGreaterThan(0);
  });

  it("cave-11: water carrying that much rot sickens whoever drinks it, and not at once, so nobody connects the two", () => {
    const tainted = world(
      [thing("spring", "water", "spring", { amount: 1000, contamination: 3 })],
      [body("villager", { place: "spring", element: "person" })],
      EXTRA,
    );
    const drank = resolve(tainted, { process: "ingest", body: "villager", thing: "spring" }).world;
    expect(drank.bodies.villager?.sickness ?? 0).toBeGreaterThan(1);
    expect(drank.bodies.villager?.sickensIn ?? 0).toBeGreaterThan(60);
    expect(drank.bodies.villager?.health).toBe(5);
  });
});

describe("cave-13: a choked level", () => {
  const choke = (holds: string[]) =>
    world(
      [thing("keystone", "block", "chokedlevel"), thing("bar", "iron", "chokedlevel")],
      [body("player", { place: "chokedlevel", element: "person", holds })],
      EXTRA,
    );

  it("cave-13: the big block at the foot of the heap is more than the player can shift by hand", () => {
    expect(canTake(choke([]), who(choke([]), "player"), "keystone")).toBe(false);
  });

  it.fails("cave-13: with the iron bar under it the player levers it out (a lever is in no act: what a body can shift is its strength against the mass, whatever it holds)", () => {
    const barred = choke(["bar"]);
    expect(canTake(barred, who(barred, "player"), "keystone")).toBe(true);
  });
});

describe("cave-14: a bucket lost down a draw-well", () => {
  const well = world(
    [
      thing("line", "rope", "drawwell"),
      thing("bucket", "bucket", "drawwell"),
      thing("fill", "water", "drawwell", { amount: 0.5 }),
      thing("water", "water", "wellwater", { amount: 5000, temperature: 1 }),
    ],
    [],
    EXTRA,
  );
  /** Whether the well water bears it up: the engine has no floating, and a load is the nearest. */
  const floats = (ids: string[]): boolean =>
    resolve(well, bears("water", ids)).world.things.water?.state.integrity === 5;

  it.fails("cave-14: the worn wet knot slips as the full bucket comes off the water, and the rope winds up whole and empty (nothing is tied to anything: R4 and friction are absent, so a rope either bears a load or breaks, and this one bears it)", () => {
    const { world: after, changes } = resolve(well, bears("line", ["bucket", "fill"]));
    expect(after.things.line?.state.integrity).toBe(5);
    expect(changes.some((c) => c.kind !== "nothing" && c.kind !== "percept")).toBe(true);
  });

  it.fails("cave-14: empty, the oak bucket floats; full, its iron takes it to the bottom (buoyancy is read by no rule, and a bucket has no inside to fill: water bears nothing heavier than a feather)", () => {
    expect(floats(["bucket"])).toBe(true);
    expect(floats(["bucket", "fill"])).toBe(false);
  });

  it("cave-14: hooked by the bail, the sodden bucket is heavier than it went down, and the grapple's line bears it up", () => {
    const sunk = resolve(well, { process: "soak", liquid: "water", target: "bucket", amount: 5 });
    expect(sunk.world.things.bucket?.state.wetness).toBeGreaterThan(1);
    expect(weight(sunk.world, ["bucket"])).toBeGreaterThan(weight(well, ["bucket"]));
    expect(resolve(sunk.world, bears("line", ["bucket"])).world.things.line?.state.integrity).toBe(
      5,
    );
  });
});

describe("cave-15: knocking through solid rock", () => {
  const mine = world(
    [thing("wall", "minerock", "closedlevel"), thing("hammer", "hammer", "closedlevel")],
    [
      body("miner", { place: "closedlevel", element: "person", holds: ["hammer"] }),
      body("rescuer", { place: "nextlevel", element: "person" }),
    ],
    EXTRA,
  );
  const knock = resolve(mine, {
    process: "force",
    by: "miner",
    instrument: "hammer",
    patient: "wall",
    manner: { effort: 3, care: 2, haste: 2 },
  });

  it("cave-15: the hammer on solid rock rings loud, and chips the wall where it strikes", () => {
    const rings = knock.changes.some(
      (c) => c.kind === "signal" && c.channel === "sound" && c.strength >= 4,
    );
    expect(rings).toBe(true);
    expect(knock.world.things.wall?.state.integrity).toBeLessThan(5);
  });

  it.fails("cave-15: the rescuers in the next level hear the knocking clearly, though they never heard him shout (a signal reaches only bodies in its own place: nothing that lies between passes or stops a sound, so rock carries a knock no better than air carries a voice, and neither arrives)", () => {
    expect(knock.world.bodies.rescuer?.aware?.wall).toBeDefined();
  });
});
