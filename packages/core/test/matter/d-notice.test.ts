/**
 * Batch D (held out), the noticing scenarios, run through the matter engine with the rules
 * frozen. Each test asserts what the scenario says a sensible person expects. `it.fails` marks
 * an outcome the rules do not produce, with the reason in brackets; a name that starts
 * `RULE ERROR:` marks one the rules get wrong. Rows are in `rows-d-notice.ts`, written before
 * anything ran.
 *
 * A tile is taken as a stride: the engine's own reach is a tile and a half and its rush is
 * eight. So "a few paces" is 3 to 5 tiles, "fairly close" 10, "some way off" in a wood 30,
 * "circling at a distance" 40, and "far off" across a valley or a plain 300 and more. Sensing
 * works inside one place, so a ridge and the valley under it are one place here, and a house
 * and the yard outside it are two.
 *
 * Unbuilt, so no test: notice-11 (tracks: nothing a body does leaves a trace, E9 has no trace
 * channel, ground takes no print and footfalls make no sound for snow to muffle), notice-15
 * (camouflage: colour is not a property, vocabulary section 8, so there is no dark on pale; a
 * body is seen by its size and the place's light whatever it wears, and eyes do not adapt).
 *
 * Stated and with nothing to assert: that smoke may be mistaken for cloud by someone who has
 * not seen a cookfire (notice-02) and that an echo blurs where a sound came from (notice-12),
 * because a percept is a source, a channel and a strength, with no direction and no
 * mistaking; that circling birds mean food under them (notice-13), because a percept is not a
 * belief and nothing infers; that a dog knows a stranger's scent from the household's
 * (notice-06), because a scent tells which body and not whether it is known; the boat adrift
 * (notice-09), because nothing is joined to anything; the time the mother loses (notice-14).
 * A pack of wolves and a flock of sheep are one body each: there is no group with a count.
 *
 * Encodings that stand in for what is missing: a lantern is a thing with a small coat of oil
 * burning on it (a wick), since nothing has contents; fog is cover 5; a gate eased open is a
 * gentle force of a hand on it, since a blow is the only act that sounds; wind from the east
 * is only a level, so up and down wind differ in where the stalker stands and nothing else.
 *
 * Changed after the first run, and why: nothing that decides a result. Every `it` and every
 * `it.fails` was written as such before anything ran, from reading the engine, and the first
 * run came out as written: 17 derived, 27 not. With the engine's numbers printed, three
 * distances quoted in the bracketed reasons were corrected (the lantern's reach, the reach of
 * a person's scent, the reach of a ripe carcass's scent), and the file was put through the
 * formatter. No assertion, row, threshold, place or distance in a world was changed.
 */
import { describe, expect, it } from "vitest";
import {
  type Act,
  alight,
  type Body,
  type Bond,
  type Change,
  type Channel,
  emits,
  type MatterWorld,
  play,
  reaches,
  resolve,
  routine,
  sensed,
  type Thing,
} from "../../src/matter/index.ts";
import { body, thing, world } from "./elements.ts";
import { EXTRA } from "./rows-d-notice.ts";

type Spot = readonly [number, number];

const minutes = (n: number): Act => ({ process: "drift", minutes: n });
const hours = (n: number): Act => minutes(n * 60);

const put = (t: Thing, where: Spot): Thing => ({ ...t, where });

const who = (id: string, element: string, place: string, where: Spot, set: Partial<Body> = {}) =>
  body(id, { element, place, where, needs: { hunger: 1, rest: 1 }, ...set });

/** Sets fuel burning in a world that is already built: a camp that already has its fire. */
function lit(w: MatterWorld, id: string): MatterWorld {
  const fuel = w.things[id];
  return fuel ? { ...w, things: { ...w.things, [id]: alight(w, fuel) } } : w;
}

/** One empty act, so that everyone has noticed what there is to notice. */
const noticed = (w: MatterWorld) => resolve(w, minutes(0)).world;

const percept = (w: MatterWorld, observer: string, of: string) => sensed(w).get(observer)?.[of];

/** How far above the observer's threshold what that thing gives off on a channel arrives. */
function carried(w: MatterWorld, observer: string, source: string, channel: Channel): number {
  const [o, s] = [w.bodies[observer], w.things[source]];
  return o && s ? reaches(w, o, s, channel, emits(w, s)[channel] ?? 0) : 0;
}

/** The same for the mere sight of a body, which is seen as a thing of its size is. */
function sightOf(w: MatterWorld, observer: string, target: string): number {
  const [o, t] = [w.bodies[observer], w.bodies[target]];
  if (!(o && t)) return 0;
  const shape = thing("shape", t.element ?? "person", t.place);
  return reaches(w, o, t, "sight", emits(w, shape).sight ?? 0);
}

const sounds = (changes: readonly Change[], source: string) =>
  changes.flatMap((c) =>
    c.kind === "signal" && c.channel === "sound" && c.source === source ? [c.strength] : [],
  );

const gap = (w: MatterWorld, a: string, b: string) => {
  const [p, q] = [w.bodies[a]?.where ?? [0, 0], w.bodies[b]?.where ?? [0, 0]];
  return Math.hypot(p[0] - q[0], p[1] - q[1]);
};

/** What a body does when nobody is watching, played: the world after, and what it chose. */
function acts(w: MatterWorld, id: string) {
  const self = w.bodies[id];
  const choice = self ? routine(w, self) : undefined;
  const after = choice?.act ? resolve(w, choice.act) : { world: w, changes: [] };
  return { choice, ...after };
}

const FAR = 300;

const valley = (place: string, logs = 4) =>
  lit(
    world(
      [put(thing("campfire", "firewood", place, { amount: logs }), [0, 0])],
      [who("player", "person", place, [FAR, 0]), who("camper", "person", place, [1, 0])],
      EXTRA,
    ),
    "campfire",
  );

describe("notice-01: a campfire from the ridge, at night", () => {
  const night = valley("valleynight");

  it.fails("notice-01: from the ridge the player sees the fire's glow, far off across the dark valley (light thins with distance as the sight of a small thing does, half a level a doubling, and the woods take a level and a half: a campfire's glow is lost within a dozen tiles of woodland and a hundred of open ground; being high is no input)", () => {
    expect(percept(night, "player", "campfire")?.channel).toBe("light");
  });

  it("notice-01: the dark gives up the fire and not who sits by it: of the people there the player has nothing", () => {
    expect(percept(night, "player", "camper")).toBeUndefined();
  });
});

describe("notice-02: the same fire by day", () => {
  const night = valley("valleynight");
  const day = valley("valleyday");

  it("notice-02: the signal changes channel with the time of day: the flame's light is washed out by daylight, and the smoke that is lost in the dark shows against the sky", () => {
    expect(carried(day, "player", "campfire", "light")).toBeLessThan(
      carried(night, "player", "campfire", "light") - 1,
    );
    expect(carried(day, "player", "campfire", "light")).toBeLessThanOrEqual(0);
    expect(carried(day, "player", "campfire", "smoke")).toBeGreaterThan(
      carried(night, "player", "campfire", "smoke") + 1,
    );
  });

  it.fails("notice-02: a thin column of smoke is seen from the ridge, above the trees (smoke is one strength at the fire, thinned by distance and hidden by the woods like anything on the ground: it does not rise over cover, and is lost within a few tiles)", () => {
    expect(percept(day, "player", "campfire")?.channel).toBe("smoke");
  });

  it("notice-02: the smoke stays for as long as the fire is fed, and no longer", () => {
    const fire = (w: MatterWorld) => w.things.campfire;
    const smoke = (w: MatterWorld) => {
      const f = fire(w);
      return f ? (emits(w, f).smoke ?? 0) : 0;
    };
    expect(smoke(resolve(day, hours(1)).world)).toBeGreaterThan(1);
    expect(smoke(resolve(day, hours(5)).world)).toBe(0);
    expect(smoke(resolve(valley("valleyday", 8), hours(5)).world)).toBeGreaterThan(1);
  });
});

describe("notice-03: a lantern, a shutter and a wolf", () => {
  const WICK = { element: "oil", amount: 1, coverage: 0.2, bond: 0 };
  function camp(place: string, wolfAt: Spot, set: { lamp?: boolean; shut?: boolean } = {}) {
    const things = [
      put(thing("lantern", "lantern", place, { coating: WICK }), [0, 0]),
      put(thing("cache", "foodcache", place), [10, 0]),
      ...(set.shut ? [put(thing("shutter", "shutter", place), [0, 0])] : []),
    ];
    const wary = { hunter: { fear: 2, anger: 0, trust: 0 } };
    const bodies = [
      who("hunter", "person", place, [1, 0]),
      who("wolf", "wolf", place, wolfAt, { needs: { hunger: 3, rest: 1 }, feels: wary }),
    ];
    const w = world(things, bodies, EXTRA);
    return noticed(set.lamp === false ? w : lit(w, "lantern"));
  }

  it.fails("notice-03: circling at a distance, the wolf sees the lantern's glow (a small flame gives a light of two and a bit, and the night's own light, the scrub and the wolf's threshold take all but a quarter of a level of it: the wolf does not see the lantern even from two tiles off)", () => {
    expect(percept(camp("scrubnight", [40, 0]), "wolf", "lantern")?.channel).toBe("light");
  });

  it.fails("notice-03: with the shutter closed the light drops to much less, though not to nothing (nothing stands between a flame and an eye but the place's cover: a thing set over a light covers nothing, R5 is absent, and there is no act that shuts)", () => {
    const open = camp("scrubnight", [3, 0]);
    const shut = camp("scrubnight", [3, 0], { shut: true });
    expect(carried(shut, "wolf", "lantern", "light")).toBeLessThan(
      carried(open, "wolf", "lantern", "light") - 1,
    );
  });

  it("notice-03: the dark does nothing about smell: at the camp's edge the wolf has the scent of the cache, lantern or no lantern, and hungry, it goes in for it", () => {
    const glowing = camp("scrubnight", [16, 0]);
    const dark = camp("scrubnight", [16, 0], { lamp: false });
    expect(glowing.bodies.wolf?.aware?.cache?.channel).toBe("scent");
    expect(dark.bodies.wolf?.aware?.cache).toEqual(glowing.bodies.wolf?.aware?.cache);
    const went = acts(dark, "wolf");
    expect(went.choice?.id).toBe("go_to:cache");
    expect(went.world.bodies.wolf?.where?.[0]).toBeLessThan(16);
  });

  it.fails("notice-03: it is the light going that lets the wolf come closer: with the lantern showing it keeps off, and in the dark it drifts in (at forty tiles the wolf notices neither the lantern nor the camp, so nothing holds it off and nothing draws it in: hungry, it is offered going looking, which has no act; and wariness of people as a kind is no state, a feeling being toward one body)", () => {
    const showing = acts(camp("scrubnight", [40, 0]), "wolf");
    const dark = acts(camp("scrubnight", [40, 0], { lamp: false }), "wolf");
    expect(showing.choice?.act?.process).not.toBe("move");
    expect(dark.choice?.act?.process).toBe("move");
    expect(gap(dark.world, "wolf", "hunter")).toBeLessThan(39);
  });

  it("notice-03: the hunter never knows the wolf came to the camp's edge, where by day he would have seen it", () => {
    expect(camp("scrubnight", [16, 0]).bodies.hunter?.aware?.wolf).toBeUndefined();
    expect(camp("scrubday", [16, 0]).bodies.hunter?.aware?.wolf?.channel).toBe("sight");
  });
});

/** The breeze is from the east, which is +x: west of the deer is downwind of it. */
const stalk = (playerAt: Spot) =>
  noticed(
    world(
      [],
      [who("deer", "deer", "grassdusk", [0, 0]), who("player", "person", "grassdusk", playerAt)],
      EXTRA,
    ),
  );

describe("notice-04: the stalk from downwind", () => {
  it.fails("RULE ERROR: notice-04: fairly close and downwind, the deer has not caught the player's scent, as it would have from upwind (wind is a level with no direction: it only takes a fifth of a level a step from every scent in the place, so the deer smells a stalker ten tiles downwind exactly as it smells one upwind)", () => {
    expect(stalk([10, 0]).bodies.deer?.aware?.player?.channel).toBe("scent");
    expect(stalk([-10, 0]).bodies.deer?.aware?.player?.channel).not.toBe("scent");
  });

  it.fails("notice-04: what gives the player away in the end is eye or ear, a few strides off (a body moving makes no sound: move emits nothing, however careless; and at dusk, through grass, a deer's eye does not reach a person two tiles away)", () => {
    const crept = resolve(stalk([-10, 0]), {
      process: "move",
      body: "player",
      toward: "deer",
      minutes: 1,
    });
    expect(gap(crept.world, "player", "deer")).toBeLessThan(4);
    const heard = sounds(crept.changes, "player").length > 0;
    expect(heard || sightOf(crept.world, "deer", "player") > 0).toBe(true);
  });
});

describe("notice-05: the stalk from upwind", () => {
  it.fails("notice-05: with the wind from the player to the deer, it has the scent while the player is still far off (scent thins by eight tenths of a level a doubling of distance whatever the wind: a person is lost to the keenest nose beyond thirteen tiles, and wind only ever takes from a scent, it never carries one)", () => {
    expect(stalk([60, 0]).bodies.deer?.aware?.player?.channel).toBe("scent");
  });

  it.fails("notice-05: having the scent of a person, the deer runs, and puts a long stretch of ground between them (nearer, where the engine's nose does reach: what has only been smelt and has done nothing is a small menace at ten tiles, so standing to watch outweighs making off; fear of people as a kind is no state)", () => {
    const smelt = stalk([10, 0]);
    expect(smelt.bodies.deer?.aware?.player?.channel).toBe("scent");
    const ran = acts(smelt, "deer");
    expect(ran.choice?.intent).toBe("keep_away");
    expect(gap(ran.world, "deer", "player")).toBeGreaterThan(25);
  });
});

describe("notice-06: the dog by the door", () => {
  const keeps: Bond[] = [{ from: "dog", to: "farmer", kind: "keeper", weight: 4 }];
  const yard: MatterWorld = {
    ...world(
      [
        put(thing("gate", "gate", "farmyard"), [15, 0]),
        put(thing("hand", "hand", "farmyard"), [16, 0]),
      ],
      [
        who("dog", "dog", "farmyard", [0, 0], {
          attention: "asleep",
          home: { place: "farmyard", where: [0, 0] },
        }),
        who("stranger", "person", "farmyard", [16, 0]),
        who("farmer", "person", "farmhouse", [0, 0], { attention: "asleep" }),
      ],
      EXTRA,
    ),
    bonds: keeps,
  };
  const creak: Act = {
    process: "force",
    by: "stranger",
    instrument: "hand",
    patient: "gate",
    manner: { effort: 1, care: 4, haste: 0 },
  };

  it.fails("notice-06: the sleeping dog catches the faint creak of the gate, or the stranger's scent, across the yard (sleep costs two whole levels on every sense, as much as sixty tiles of distance, so no ear is keen enough asleep: a creak of under two does not carry fifteen tiles even to a dog awake)", () => {
    const after = resolve(yard, creak).world;
    const aware = after.bodies.dog?.aware ?? {};
    expect("gate" in aware || "stranger" in aware).toBe(true);
  });

  it.fails("notice-06: the dog wakes and begins barking (nothing wakes a sleeper: attention is written by no act; and a body has no voice: calling and giving voice are intents with no act, so no sound comes of them)", () => {
    const after = resolve(yard, creak).world;
    expect(after.bodies.dog?.attention ?? "alert").not.toBe("asleep");
    expect(sounds(acts(after, "dog").changes, "dog").length).toBeGreaterThan(0);
  });

  it.fails("notice-06: the household sleeps on at first, and wakes once the barking has gone on a while (there is no barking, no sound passes from one place into another, and nothing wakes a sleeper)", () => {
    const atOnce = resolve(yard, creak).world;
    expect(atOnce.bodies.farmer?.attention).toBe("asleep");
    const later = resolve(atOnce, minutes(10)).world;
    expect(later.bodies.farmer?.attention ?? "alert").not.toBe("asleep");
  });
});

describe("notice-07: a twig underfoot", () => {
  const floor = (place: string, boarAt: Spot) =>
    world(
      [put(thing("twig", "drytwig", place), [0, 0]), put(thing("foot", "foot", place), [0, 0])],
      [who("player", "person", place, [0, 0]), who("boar", "boar", place, boarAt)],
      EXTRA,
    );
  const tread: Act = {
    process: "force",
    by: "player",
    instrument: "foot",
    patient: "twig",
    manner: { effort: 3, care: 0, haste: 4 },
  };

  it("notice-07: a careless foot on a dry twig makes a sound that is clear and not small", () => {
    const made = sounds(resolve(floor("dryforest", [30, 0]), tread).changes, "twig");
    expect(Math.max(0, ...made)).toBeGreaterThan(2.5);
  });

  it.fails("notice-07: and the twig is broken (a blow goes by the mass of the instrument, and a foot is light: the walker's weight behind it is no input, so the driest twig is only marked)", () => {
    const after = resolve(floor("dryforest", [30, 0]), tread).world;
    expect(after.things.twig?.state.integrity).toBeLessThanOrEqual(1);
  });

  it.fails("notice-07: the snap carries through the still wood to a boar some way off (sound thins by seven tenths of a level a doubling, and the wood and its quiet take a level more: the snap is lost to a boar's ear beyond ten tiles)", () => {
    const after = resolve(floor("dryforest", [30, 0]), tread).world;
    expect(after.bodies.boar?.aware?.twig?.channel).toBe("sound");
  });

  it.fails("RULE ERROR: notice-07: hearing it and seeing nothing, the boar moves off the other way (nearer, where the engine's ear does reach: menace is read off bodies alone, so a sound from nowhere is never something to get away from, and the one thing offered toward it is to go and look into it)", () => {
    const after = resolve(floor("dryforest", [8, 0]), tread).world;
    expect(after.bodies.boar?.aware?.twig?.channel).toBe("sound");
    const went = acts(after, "boar");
    expect(went.choice?.intent).toBe("keep_away");
    expect(gap(went.world, "boar", "player")).toBeGreaterThan(8);
  });

  it("notice-07: the player never sees the boar through the trees, where on open ground they would have", () => {
    expect(percept(floor("dryforest", [30, 0]), "player", "boar")).toBeUndefined();
    expect(percept(floor("openground", [30, 0]), "player", "boar")?.channel).toBe("sight");
  });
});

describe("notice-08: a long watch", () => {
  const watch = (playerAt: Spot, guard: Partial<Body> = {}) =>
    lit(
      world(
        [put(thing("torch", "torch", "palisade"), [0, 0])],
        [
          who("guard", "person", "palisade", [1, 0], guard),
          who("player", "person", "palisade", playerAt),
        ],
        EXTRA,
      ),
      "torch",
    );

  it.fails("notice-08: early in the watch the guard would see an approach at a fair distance in the torchlight (a flame is seen and lights nothing: whoever stands near a torch is seen by the place's own light, and by a night's light nobody is seen at any distance)", () => {
    expect(percept(watch([15, 0]), "guard", "player")).toBeDefined();
  });

  it("notice-08: the hours of the watch tell on the guard: past midnight he is more tired than he was", () => {
    const late = resolve(watch([40, 0]), hours(6)).world;
    expect(late.bodies.guard?.needs.rest ?? 0).toBeGreaterThan(1.5);
  });

  it.fails("notice-08: and tired, he has grown drowsy (tiredness climbs with the hours and lowers strength and speed, and never touches attention or the senses: a guard is as alert at dawn as at dusk)", () => {
    const late = resolve(watch([40, 0]), hours(6)).world;
    expect(late.bodies.guard?.attention ?? "alert").not.toBe("alert");
  });

  it.fails("notice-08: drowsy, he misses at six tiles the approach he would have caught alert (by the night's light the guard sees nobody, alert or not, torch or not, and an approach makes no sound: there is nothing for drowsiness to lose)", () => {
    expect(percept(watch([6, 0], { attention: "distracted" }), "guard", "player")).toBeUndefined();
    expect(percept(watch([6, 0]), "guard", "player")).toBeDefined();
  });
});

describe("notice-09: a rope cut under the storm", () => {
  const camp = (place: string, wetness: number) =>
    world(
      [
        put(thing("rope", "rope", place, { wetness }), [0, 0]),
        put(thing("knife", "blade", place, { edge: 4 }), [0, 0]),
      ],
      [
        who("player", "person", place, [0, 0], { holds: ["knife"] }),
        who("owner", "person", place, [5, 0], { attention: "asleep" }),
      ],
      EXTRA,
    );
  const stroke: Act = {
    process: "force",
    by: "player",
    instrument: "knife",
    patient: "rope",
    manner: { effort: 2, care: 4, haste: 1 },
  };
  const storm = camp("stormcamp", 4);
  const still = camp("stillcamp", 0);

  it("notice-09: a few strokes of a sharp knife part the wet rope", () => {
    const after = play(storm, [stroke, stroke, stroke, stroke]).world;
    expect(after.things.rope?.state.integrity).toBeLessThanOrEqual(1);
  });

  it("notice-09: under the storm the cutting goes unheard a few paces off even by someone awake, where in still weather they would hear it", () => {
    const listener = who("listener", "person", "", [3, 0]);
    const heard = (w: MatterWorld, place: string) => {
      const rope = w.things.rope;
      const loud = Math.max(0, ...sounds(resolve(w, stroke).changes, "rope"));
      return rope ? reaches(w, { ...listener, place }, rope, "sound", loud) : 0;
    };
    expect(heard(storm, "stormcamp")).toBeLessThanOrEqual(0);
    expect(heard(still, "stillcamp")).toBeGreaterThan(0);
  });

  it("notice-09: the camp owner, asleep in the tent, never stirs", () => {
    const cut = play(storm, [stroke, stroke, stroke, stroke]);
    expect(cut.world.bodies.owner?.aware?.rope).toBeUndefined();
    expect(cut.changes.some((c) => c.kind === "percept" && c.body === "owner")).toBe(false);
  });

  it.fails("notice-09: in clear still weather the same cut would have reached a light sleeper (sleep is one depth, two whole levels on the ear: there is no dozing between asleep and awake, and the scrape of a knife in rope is nowhere near loud enough for that)", () => {
    expect(resolve(still, stroke).world.bodies.owner?.aware?.rope?.channel).toBe("sound");
  });
});

describe("notice-10: fog on the moor", () => {
  const moor = (place: string) =>
    noticed(
      world(
        [],
        [
          who("traveler", "person", place, [0, 0]),
          who("pack", "wolf", place, [10, 0], { needs: { hunger: 3, rest: 1 } }),
          who("sheep", "sheep", place, [30, 0]),
        ],
        EXTRA,
      ),
    );

  it("notice-10: in the fog neither sees the other at ten strides, where on a clear day both would", () => {
    const fog = moor("moorfog");
    const clear = moor("moorclear");
    expect(fog.bodies.traveler?.aware?.pack).toBeUndefined();
    expect(fog.bodies.pack?.aware?.traveler?.channel).not.toBe("sight");
    expect(clear.bodies.traveler?.aware?.pack?.channel).toBe("sight");
    expect(clear.bodies.pack?.aware?.traveler?.channel).toBe("sight");
  });

  it.fails("notice-10: the traveller's boots on the frost-stiff grass are heard by the pack (a body moving makes no sound, on any ground: move emits nothing)", () => {
    const walked = resolve(moor("moorfog"), {
      process: "move",
      body: "traveler",
      to: [0, 10],
      minutes: 1,
    });
    expect(sounds(walked.changes, "traveler").length).toBeGreaterThan(0);
    expect(walked.world.bodies.pack?.aware?.traveler?.channel).toBe("sound");
  });

  it("notice-10: hungry, the pack goes for the sheep it can smell nearby, and the traveller never learns it was there", () => {
    const fog = moor("moorfog");
    expect(fog.bodies.pack?.aware?.sheep?.channel).toBe("scent");
    const went = acts(fog, "pack");
    expect(went.choice?.id).toBe("go_to:sheep");
    expect(gap(went.world, "pack", "sheep")).toBeLessThan(gap(fog, "pack", "sheep"));
    expect(went.world.bodies.traveler?.aware?.pack).toBeUndefined();
  });
});

describe("notice-12: a bell in a gorge", () => {
  const crossing = (place: string) =>
    world(
      [put(thing("bell", "bell", place), [0, 0]), put(thing("clapper", "clapper", place), [0, 0])],
      [who("player", "person", place, [1, 0]), who("lookout", "person", place, [200, 0])],
      EXTRA,
    );
  const ring: Act = {
    process: "force",
    by: "player",
    instrument: "clapper",
    patient: "bell",
    manner: { effort: 3, care: 2, haste: 2 },
  };

  it("notice-12: the bell, rung, is loud at the bridge", () => {
    const rung = resolve(crossing("gorge"), ring);
    expect(Math.max(0, ...sounds(rung.changes, "bell"))).toBeGreaterThanOrEqual(4);
    expect(rung.world.bodies.player?.aware?.bell?.channel).toBe("sound");
  });

  it("notice-12: at that range the lookout could never have heard it directly, in open country or in the gorge", () => {
    const open = crossing("opencountry");
    const [lookout, bell] = [open.bodies.lookout, open.things.bell];
    const loud = Math.max(0, ...sounds(resolve(open, ring).changes, "bell"));
    expect(lookout && bell ? reaches(open, lookout, bell, "sound", loud) : 1).toBeLessThan(0);
  });

  it.fails("notice-12: the gorge's walls carry the ring on as an echo, and the lookout well up the gorge hears it (a place has no enclosure: nothing lengthens a sound's reach, walls or none, and the river's noise only shortens it)", () => {
    const rung = resolve(crossing("gorge"), ring).world;
    expect(rung.bodies.lookout?.aware?.bell?.channel).toBe("sound");
  });
});

describe("notice-13: a carcass on the plains", () => {
  const hungry = { needs: { hunger: 3, rest: 1 } };
  const kill = (place: string) =>
    world(
      [put(thing("elk", "elkcarcass", place), [0, 0])],
      [
        who("vultures", "vulture", place, [FAR, 0], { ...hungry, tolerates: 5 }),
        who("hyenas", "hyena", place, [400, 0], { ...hungry, tolerates: 4 }),
      ],
      EXTRA,
    );
  const reek = (w: MatterWorld) => {
    const elk = w.things.elk;
    return elk ? (emits(w, elk).scent ?? 0) : 0;
  };
  const day = (place: string) => resolve(kill(place), hours(10)).world;

  it("notice-13: after the better part of a day in the sun the carcass smells more than it did, and more than it would have in the cold", () => {
    expect(reek(day("plains"))).toBeGreaterThan(reek(kill("plains")) + 0.3);
    expect(reek(day("plains"))).toBeGreaterThan(reek(day("coldplains")));
  });

  it.fails("notice-13: the smell carries a long way over the open plains, to vultures far off (scent thins by eight tenths of a level a doubling of distance: the ripest carcass there can be is lost to the keenest nose beyond a hundred and ten tiles, and a day-old one far sooner; warmth does not lift it and wind only thins it)", () => {
    expect(carried(day("plains"), "vultures", "elk", "scent")).toBeGreaterThan(0);
  });

  it.fails("notice-13: the vultures drop toward it (they have it by eye, as the engine has it, but what is three hundred tiles off is never worth going to: going toward a thing loses a fiftieth of a level a tile, so no hunger is enough beyond two hundred)", () => {
    const after = noticed(day("plains"));
    const went = acts(after, "vultures");
    expect(went.choice?.id).toBe("go_to:elk");
    expect(went.world.bodies.vultures?.where?.[0]).toBeLessThan(FAR);
  });

  it.fails("notice-13: hyenas far off on the ground see the birds circling (a bird is seen by its size and the day's light, thinned by distance like anything on the ground: what is up in the sky is no easier to see, and at four hundred tiles it is lost)", () => {
    const circling = kill("plains");
    const birds = circling.bodies.vultures;
    const over: MatterWorld = birds
      ? { ...circling, bodies: { ...circling.bodies, vultures: { ...birds, where: [0, 0] } } }
      : circling;
    expect(percept(over, "hyenas", "vultures")?.channel).toBe("sight");
  });

  it.fails("RULE ERROR: notice-13: the birds wheeling over it are seen from further than the carcass lying on the ground (sight goes by size alone: the carcass in the grass is the bigger, so it is seen from further than the birds in the sky above it)", () => {
    const circling = kill("plains");
    const [hyenas, birds, elk] = [
      circling.bodies.hyenas,
      circling.bodies.vultures,
      circling.things.elk,
    ];
    const over = birds ? { ...birds, where: [0, 0] as const } : undefined;
    const bird = thing("shape", "vulture", "plains");
    const ofBirds =
      hyenas && over
        ? reaches(circling, hyenas, over, "sight", emits(circling, bird).sight ?? 0)
        : 0;
    const ofElk =
      hyenas && elk ? reaches(circling, hyenas, elk, "sight", emits(circling, elk).sight ?? 0) : 0;
    expect(ofBirds).toBeGreaterThan(ofElk);
  });
});

describe("notice-14: a baby cries during a search", () => {
  const young: Bond[] = [{ from: "mother", to: "baby", kind: "young", weight: 5 }];
  const home = noticed({
    ...world(
      [],
      [
        who("baby", "infant", "house", [8, 0], { needs: { hunger: 4.5, rest: 1 } }),
        who("mother", "person", "house", [2, 0]),
        who("player", "person", "house", [0, 0]),
        who("soldier", "person", "street", [0, 0]),
      ],
      EXTRA,
    ),
    bonds: young,
  });

  it("notice-14: the infant, hungry enough, gives voice to it", () => {
    expect(acts(home, "baby").choice?.intent).toBe("express");
  });

  it.fails("notice-14: and the crying is a loud noise in the house, which a soldier waiting outside hears (giving voice has no act: a body has no voice, so no sound is made; and no sound passes from one place into another)", () => {
    const cried = acts(home, "baby");
    expect(sounds(cried.changes, "baby").length).toBeGreaterThan(0);
    expect(cried.world.bodies.soldier?.aware?.baby?.channel).toBe("sound");
  });

  it.fails("notice-14: the mother goes to the infant to quiet it (a ward's need sends its keeper looking for what would meet it, never to the ward: she does not see or hear the child in the back room, going to the one who cries is no intent, and soothing is no act)", () => {
    const went = acts(home, "mother");
    expect(went.choice?.toward).toBe("baby");
    expect(gap(went.world, "mother", "baby")).toBeLessThan(6);
  });
});
