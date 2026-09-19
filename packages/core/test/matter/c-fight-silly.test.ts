/**
 * Batch C, held out: fight and silly. Each test asserts what the scenario says a sensible
 * person expects. `it.fails` marks what the rules cannot produce, or get wrong (`RULE ERROR`),
 * with the reason in brackets. Rows are in `rows-c-fight-silly.ts`. Not tested, because the
 * outcome turns on mechanisms the engine does not have: fight-07, silly-05, silly-06, silly-07.
 */
import { describe, expect, it } from "vitest";
import {
  type Act,
  alight,
  type Manner,
  type MatterWorld,
  play,
  resolve,
  type Wound,
} from "../../src/matter/index.ts";
import { body, thing, world } from "./elements.ts";
import { EXTRA } from "./rows-c-fight-silly.ts";

const SWING: Manner = { effort: 4, care: 2, haste: 3 };
const THRUST: Manner = { effort: 3, care: 4, haste: 3 };
const GRAB: Manner = { effort: 2, care: 2, haste: 2 };
const LICK: Manner = { effort: 0, care: 3, haste: 1 };
const PRESSED: Manner = { effort: 1, care: 1, haste: 1 };
const BRUSH: Manner = { effort: 0, care: 0, haste: 2 };

const strike = (instrument: string, patient: string, manner: Manner, seconds?: number): Act => ({
  process: "force",
  instrument,
  patient,
  manner,
  ...(seconds === undefined ? {} : { seconds }),
});
const minutes = (n: number): Act => ({ process: "drift", minutes: n });
const times = <T>(n: number, x: T): T[] => Array.from({ length: n }, () => x);
const NO_WOUND: Wound = { depth: 0, bleeding: 0, burned: 0 };
const lastWound = (w: MatterWorld, id: string): Wound => w.bodies[id]?.wounds.at(-1) ?? NO_WOUND;

describe("fight-01: two axes against a sword and a cuirass", () => {
  const road = world(
    [
      thing("axe", "handaxe", "road", { edge: 3 }),
      thing("sword", "broadsword", "road", { edge: 4 }),
      thing("cuirass", "cuirass", "road"),
    ],
    [body("guard", { place: "road" }), body("player", { place: "road" })],
    EXTRA,
  );

  it("fight-01: an axe driven into the unarmoured gap opens a deep wound that bleeds as deep, and the heavier sword would bite deeper than the light axe", () => {
    const hit = lastWound(resolve(road, strike("axe", "guard", THRUST)).world, "guard");
    expect(hit.depth).toBeGreaterThan(1.5);
    expect(hit.bleeding).toBeGreaterThan(1.5);
    const sword = lastWound(resolve(road, strike("sword", "player", THRUST)).world, "player");
    expect(sword.depth).toBeGreaterThan(hit.depth);
  });

  it("fight-01: the cuirass turns the first axe blow: marked, not parted", () => {
    const after = resolve(road, strike("axe", "cuirass", SWING)).world;
    expect(after.things.cuirass?.state.integrity ?? 0).toBeGreaterThan(1);
    expect(after.things.cuirass?.state.integrity ?? 9).toBeLessThan(5);
  });

  it.fails("fight-01: the same blow wounds a man in a cuirass less than a bare one (no wears or covers relation: a body has nothing on it, so a blow at a body meets flesh whatever it is dressed in)", () => {
    const bare = world(
      [thing("axe", "handaxe", "road", { edge: 3 })],
      [body("guard", { place: "road" })],
      EXTRA,
    );
    const [armoured, naked] = [
      lastWound(resolve(road, strike("axe", "guard", SWING)).world, "guard"),
      lastWound(resolve(bare, strike("axe", "guard", SWING)).world, "guard"),
    ];
    expect(armoured.depth).toBeLessThan(naked.depth);
  });

  it("fight-01: left unbound the wound goes on bleeding: an hour on it has not stopped and it has cost him", () => {
    const hit = resolve(road, strike("axe", "guard", THRUST)).world;
    const later = resolve(hit, minutes(60)).world;
    expect(lastWound(later, "guard").bleeding).toBeGreaterThan(0);
    expect(later.bodies.guard?.health ?? 9).toBeLessThan(5);
  });

  it.fails("fight-01: he is bleeding badly: within the hour he has lost a fifth of what he had (an axe driven under the arm is a wound of 2 in 5 and costs 0.4 of health in the hour: the worst wound the scale has takes over four hours to kill)", () => {
    const hit = resolve(road, strike("axe", "guard", THRUST)).world;
    expect(resolve(hit, minutes(60)).world.bodies.guard?.health ?? 9).toBeLessThan(4);
  });
});

describe("fight-02: a plank-and-hide shield in a doorway", () => {
  const door = world(
    [
      thing("knife", "blade", "doorway", { edge: 4 }),
      thing("hide", "leather", "doorway"),
      thing("board", "plank", "doorway"),
    ],
    [body("player", { place: "doorway" })],
    EXTRA,
  );
  const thrusts = (n: number, at: string) =>
    play(door, times(n, strike("knife", at, THRUST))).world;

  it("fight-02: the hide face holds the first thrust and is split by the second", () => {
    expect(thrusts(1, "hide").things.hide?.state.integrity ?? 0).toBeGreaterThan(1);
    expect(thrusts(2, "hide").things.hide?.state.integrity ?? 9).toBeLessThanOrEqual(1);
  });

  it("fight-02: the shield fails by degrees: every thrust leaves the board worse than the last, and none of them goes through it at once", () => {
    const left = [0, 1, 2, 3].map((n) => thrusts(n, "board").things.board?.state.integrity ?? 0);
    expect(left[1]).toBeLessThan(left[0] ?? 0);
    expect(left[2]).toBeLessThan(left[1] ?? 0);
    expect(left[3]).toBeLessThan(left[2] ?? 0);
    expect(left[1]).toBeGreaterThan(3);
  });

  it.fails("fight-02: two thrusts crack a plank, and by the third the board is no longer a shield (a knife thrust takes 0.4 off the board: cracked after five, gone after fourteen; the direction is right and the countdown is four times too long for this scenario)", () => {
    expect(thrusts(2, "board").things.board?.state.integrity ?? 9).toBeLessThanOrEqual(3.5);
    expect(thrusts(3, "board").things.board?.state.integrity ?? 9).toBeLessThanOrEqual(2);
  });
});

describe("fight-02: the grapple that ends it", () => {
  it.fails("RULE ERROR: fight-02: thrown down and pinned with all the player has, the attacker comes out of it bruised (bare hands never mark a body at any effort: a blow must clear the bar for breaking flesh before it bruises it)", () => {
    const w = world(
      [thing("hands", "hand", "doorway")],
      [body("attacker", { place: "doorway" })],
      EXTRA,
    );
    const thrown = resolve(w, strike("hands", "attacker", { effort: 5, care: 1, haste: 4 }, 2));
    expect(lastWound(thrown.world, "attacker").depth).toBeGreaterThan(0);
  });
});

describe("fight-03: a staff from the high ground", () => {
  const slope = world(
    [thing("staff", "staff", "scree"), thing("knife", "blade", "scree", { edge: 4 })],
    [body("player", { place: "scree" })],
    EXTRA,
  );

  it("fight-03: the staff catches a rib: a bruise that hardly bleeds, where a blade swung as hard would have opened him, and he can crawl away from it", () => {
    const hit = resolve(slope, strike("staff", "player", SWING)).world;
    const bruise = lastWound(hit, "player");
    expect(bruise.depth).toBeGreaterThan(0.3);
    expect(bruise.bleeding).toBeLessThan(bruise.depth * 0.5);
    const cut = lastWound(resolve(slope, strike("knife", "player", SWING)).world, "player");
    expect(cut.bleeding).toBeGreaterThan(bruise.bleeding * 2);
    expect(resolve(hit, minutes(60)).world.bodies.player?.health ?? 0).toBeGreaterThan(4.5);
  });
});

describe("fight-04: a cudgel out of the hazel", () => {
  const track = world(
    [thing("cudgel", "cudgel", "road")],
    [body("player", { place: "road" })],
    EXTRA,
  );

  it("fight-04: the free first blow lands squarely on the shoulder: bruised, not bleeding out, and still standing an hour on", () => {
    const hit = resolve(track, strike("cudgel", "player", SWING)).world;
    const bruise = lastWound(hit, "player");
    expect(bruise.depth).toBeGreaterThan(0.3);
    expect(bruise.depth).toBeLessThan(2.5);
    expect(bruise.bleeding).toBeLessThan(1);
    expect(resolve(hit, minutes(60)).world.bodies.player?.health ?? 0).toBeGreaterThan(4.5);
  });
});

describe("fight-05: an arrow in the haunch", () => {
  const heath = world(
    [thing("arrow", "arrow", "heath", { edge: 4 })],
    [body("stag", { place: "heath" })],
    EXTRA,
  );
  const hit = resolve(heath, strike("arrow", "stag", SWING)).world;

  it("fight-05: a hit is not a kill: the stag is wounded and bleeding, and three hours on it has lost blood, is still alive, and the wound is closing", () => {
    const wound = lastWound(hit, "stag");
    expect(wound.depth).toBeGreaterThan(1);
    expect(wound.bleeding).toBeGreaterThan(1);
    const later = resolve(hit, minutes(180)).world;
    expect(later.bodies.stag?.health ?? 9).toBeLessThan(5);
    expect(later.bodies.stag?.health ?? 0).toBeGreaterThan(2);
    expect(lastWound(later, "stag").bleeding).toBeLessThan(wound.bleeding);
  });
});

describe("fight-06: a covered pit", () => {
  const path = world(
    [
      thing("cover", "lattice", "path"),
      thing("litter", "needles", "path", { amount: 5 }),
      thing("pursuer", "man", "path"),
    ],
    [body("pursuer", { place: "path" })],
    EXTRA,
  );

  it("fight-06: the cover carries its skin of needles and gives way under a running man, and once sprung it is broken for anyone to see", () => {
    const dressed = resolve(path, { process: "load", support: "cover", bearing: ["litter"] });
    expect(dressed.world.things.cover?.state.integrity).toBe(5);
    const sprung = resolve(path, {
      process: "load",
      support: "cover",
      bearing: ["litter", "pursuer"],
    });
    expect(sprung.world.things.cover?.state.integrity ?? 9).toBeLessThanOrEqual(1);
    expect(sprung.changes.some((c) => c.kind === "signal" && c.channel === "sound")).toBe(true);
  });

  it.fails("fight-06: the man who goes through it is hurt by the drop (a load that fails breaks the support and does nothing to what it held: no fall, no landing)", () => {
    const sprung = resolve(path, {
      process: "load",
      support: "cover",
      bearing: ["litter", "pursuer"],
    }).world;
    expect(sprung.bodies.pursuer?.wounds.length ?? 0).toBeGreaterThan(0);
  });
});

describe("fight-08: after the fight", () => {
  const yard = world(
    [thing("strip", "cloth", "dooryard", { wetness: 0.05 })],
    [
      body("rival", { place: "dooryard", wounds: [{ depth: 3, bleeding: 3, burned: 0 }] }),
      body("player", { place: "dooryard", wounds: [{ depth: 0.5, bleeding: 0.5, burned: 0 }] }),
    ],
    EXTRA,
  );

  it("fight-08: nothing is zeroed when the fight is won: the deep cut is still running two hours on and costing him, the scratch has closed, and both wounds are still there next day", () => {
    const later = resolve(yard, minutes(120)).world;
    expect(lastWound(later, "rival").bleeding).toBeGreaterThan(1);
    expect(later.bodies.rival?.health ?? 9).toBeLessThan(4.5);
    expect(lastWound(later, "player").bleeding).toBe(0);
    const nextDay = resolve(yard, minutes(24 * 60)).world;
    expect(lastWound(nextDay, "rival").depth).toBeGreaterThan(0);
    expect(nextDay.bodies.rival?.health ?? 9).toBeLessThan(later.bodies.rival?.health ?? 0);
  });

  it.fails("fight-08: binding the cut with a strip of cloth slows the bleeding (no join onto a body: a coat goes on things only, and cloth is too hard to spread)", () => {
    const bound = resolve(yard, {
      process: "coat",
      substance: "strip",
      target: "rival",
      manner: { effort: 3, care: 3, haste: 2 },
    }).world;
    expect(lastWound(bound, "rival").bleeding).toBeLessThan(3);
  });

  it.fails("fight-08: both are hungrier some hours after than they were (time over a body only bleeds it and brings on a sickness: no need drifts)", () => {
    const later = resolve(yard, minutes(240)).world;
    expect(later.bodies.player?.needs.hunger ?? 0).toBeGreaterThan(
      yard.bodies.player?.needs.hunger ?? 9,
    );
  });
});

describe("silly-01: lick the sword", () => {
  const camp = world(
    [
      thing("sword", "iron", "camp", { edge: 3, temperature: 1 }),
      thing("poker", "iron", "camp", { edge: 3, temperature: 5 }),
    ],
    [body("player", { place: "camp" })],
    EXTRA,
  );

  it("silly-01: a lick of a cold edge does nothing, a swing of the same sword opens a man, and the sword is as it was", () => {
    const licked = resolve(camp, strike("sword", "player", LICK, 1));
    expect(licked.world.bodies.player?.wounds).toHaveLength(0);
    const swung = lastWound(resolve(camp, strike("sword", "player", SWING)).world, "player");
    expect(swung.depth).toBeGreaterThan(2);
    expect(licked.world.things.sword?.state).toEqual(camp.things.sword?.state);
  });

  it.fails("RULE ERROR: silly-01: a tongue pressed on the edge is cut 1.5 deep, over half what a full swing of the sword does and deeper than a cudgel swung with all a man has (keenness adds to depth whatever the arm does: it should be a nick)", () => {
    const nick = lastWound(resolve(camp, strike("sword", "player", PRESSED, 1)).world, "player");
    const swung = lastWound(resolve(camp, strike("sword", "player", SWING)).world, "player");
    expect(nick.depth).toBeGreaterThan(0);
    expect(nick.depth).toBeLessThan(1.5);
    expect(swung.depth).toBeGreaterThan(nick.depth * 2);
  });

  it("silly-01: it is the blade's state that answers, not the verb: the same lick of one left in the fire burns the tongue", () => {
    const burnt = lastWound(resolve(camp, strike("poker", "player", LICK, 1)).world, "player");
    expect(burnt.burned).toBeGreaterThan(0);
    expect(burnt.depth).toBe(0);
  });

  it.fails("RULE ERROR: silly-01: the lick takes iron off the sword and it goes down like food (ingest swallows a share of anything, whatever its hardness: the sword should be unchanged)", () => {
    const tasted = resolve(camp, {
      process: "ingest",
      body: "player",
      thing: "sword",
      amount: 0.01,
    }).world;
    expect(tasted.things.sword?.state.amount).toBe(1);
  });
});

describe("silly-02: eat a handful of dirt", () => {
  const field = world(
    [
      thing("handful", "dirt", "field", { contamination: 1, wetness: 0.05 }),
      thing("cap", "mushroom", "field"),
    ],
    [body("player", { place: "field" }), body("other", { place: "field" })],
    EXTRA,
  );
  const eat = (who: string, what: string): Act => ({ process: "ingest", body: who, thing: what });

  it("silly-02: dirt is not food: it goes down, does nothing for hunger, and upsets the stomach a little some hours later, nothing like what a deadly mushroom does", () => {
    const ate = resolve(field, eat("player", "handful")).world;
    expect(ate.things.handful).toBeUndefined();
    expect(ate.bodies.player?.needs.hunger).toBe(field.bodies.player?.needs.hunger);
    expect(ate.bodies.player?.sickness ?? 0).toBeGreaterThan(0);
    expect(ate.bodies.player?.sickness ?? 9).toBeLessThan(2.5);
    expect(ate.bodies.player?.sickensIn ?? 0).toBeGreaterThanOrEqual(60);
    expect(ate.bodies.player?.health).toBe(5);
    const nextDay = resolve(ate, minutes(24 * 60)).world;
    expect(nextDay.bodies.player?.health ?? 0).toBeGreaterThan(3.5);
    const poisoned = resolve(field, eat("other", "cap")).world;
    expect(poisoned.bodies.other?.sickness ?? 0).toBeGreaterThan(
      (ate.bodies.player?.sickness ?? 9) * 2,
    );
  });
});

describe("silly-03: hug the bear", () => {
  const bank = world(
    [
      thing("paw", "paw", "riverbank", { edge: 2 }),
      thing("hands", "hand", "riverbank"),
      thing("cudgel", "cudgel", "riverbank"),
    ],
    [body("player", { place: "riverbank" }), body("bear", { place: "riverbank" })],
    EXTRA,
  );

  it("silly-03: the grab does nothing to the bear, and the swipe that answers it sends the player away bleeding", () => {
    const hugged = resolve(bank, strike("hands", "bear", GRAB, 3)).world;
    expect(hugged.bodies.bear?.wounds).toHaveLength(0);
    const swiped = lastWound(resolve(hugged, strike("paw", "player", SWING)).world, "player");
    expect(swiped.depth).toBeGreaterThan(1);
    expect(swiped.bleeding).toBeGreaterThan(1);
  });

  it.fails("silly-03: a blow that lays a man open does less to a bear (a body has no row: every body is the same flesh, so hide, bulk and strength are nowhere)", () => {
    const man = lastWound(resolve(bank, strike("cudgel", "player", SWING)).world, "player");
    const bear = lastWound(resolve(bank, strike("cudgel", "bear", SWING)).world, "bear");
    expect(bear.depth).toBeLessThan(man.depth);
  });
});

describe("silly-04: juggle three lit torches", () => {
  const room = world(
    [
      thing("hearth", "bough", "hall"),
      thing("one", "torch", "hall"),
      thing("two", "torch", "hall"),
      thing("three", "torch", "hall"),
      thing("floor", "stone", "hall", { amount: 50 }),
      thing("rushes", "straw", "hall"),
    ],
    [body("player", { place: "hall" })],
    EXTRA,
  );
  const fire = room.things.hearth;
  const lit: MatterWorld = fire
    ? { ...room, things: { ...room.things, hearth: alight(room, fire) } }
    : room;
  const held = (target: string): Act => ({ process: "heat", source: "hearth", target, minutes: 1 });
  const torches = play(lit, [held("one"), held("two"), held("three")]).world;

  it("silly-04: a minute in the hearth lights each of the three torches", () => {
    for (const id of ["one", "two", "three"])
      expect(torches.things[id]?.state.burning, id).not.toBeNull();
  });

  it("silly-04: the torch that gets away brushes the forearm on its way down: a singe, not a cut", () => {
    const singed = lastWound(
      resolve(torches, strike("three", "player", BRUSH, 0.5)).world,
      "player",
    );
    expect(singed.burned).toBeGreaterThan(0);
    expect(singed.burned).toBeLessThan(1.5);
    expect(singed.depth).toBe(0);
    expect(singed.bleeding).toBe(0);
  });

  it("silly-04: the floor matters: on bare stone the dropped torch burns on and lights nothing, and on straw it would have been a fire", () => {
    const onStone = resolve(torches, {
      process: "heat",
      source: "three",
      target: "floor",
      minutes: 10,
    }).world;
    expect(onStone.things.floor?.state.burning).toBeNull();
    expect(onStone.things.three?.state.burning).not.toBeNull();
    const onStraw = resolve(torches, {
      process: "heat",
      source: "three",
      target: "rushes",
      minutes: 1,
    }).world;
    expect(onStraw.things.rushes?.state.burning).not.toBeNull();
  });
});
