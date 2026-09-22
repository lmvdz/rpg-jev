/**
 * Batch A, tools and building (`spikes/vocabulary/results/scenarios/a-tool-build.json`), run
 * through the matter engine. Each test asserts what the scenario says a sensible person
 * expects. `it.fails` marks what the rules do not produce; one whose name starts with
 * `RULE ERROR:` marks something the rules produce wrongly. The rows in `rows-tool-build.ts`
 * were written from the anchors before anything ran. tool-01, tool-03, tool-04, build-03 and
 * build-07 are covered in `batch-a.test.ts`.
 */
import { describe, expect, it } from "vitest";
import { type Act, effective, type Manner, play, resolve } from "../../src/matter/index.ts";
import { body, thing, world } from "./elements.ts";
import { EXTRA } from "./rows-tool-build.ts";

const SOLID: Manner = { effort: 4, care: 3, haste: 2 };
const STEADY: Manner = { effort: 2, care: 3, haste: 1 };
const FIRM: Manner = { effort: 3, care: 2, haste: 2 };

const strike = (instrument: string, patient: string, manner: Manner): Act => ({
  process: "force",
  instrument,
  patient,
  manner,
});
const times = (n: number, act: Act): Act[] => Array.from({ length: n }, () => act);

describe("tool-02: splitting a round with a wedge and a maul", () => {
  const start = world(
    [
      thing("round", "round"),
      thing("wedge", "wedge", "hearth", { edge: 2 }),
      thing("maul", "maul"),
    ],
    [],
    EXTRA,
  );

  it("the wedge goes into the round, and the grain is part of why", () => {
    const { world: after, changes } = resolve(start, {
      process: "force",
      instrument: "wedge",
      patient: "round",
      manner: SOLID,
      aim: "along",
    });
    expect(after.things.round?.state.integrity).toBeLessThan(5);
    expect(changes.some((c) => c.because.includes("grained"))).toBe(true);
  });

  it.fails("after several solid blows the round splits in two (force has one instrument, so the maul's blow never passes through the wedge; grain adds depth, never a split, and no halves are made)", () => {
    const { world: after, changes } = play(start, times(8, strike("wedge", "round", SOLID)));
    expect(after.things.round?.state.integrity).toBeLessThanOrEqual(1);
    expect(changes.some((c) => c.kind === "create")).toBe(true);
  });

  it("fixed rule: eight solid blows of a wooden maul leave an iron wedge cracked and the maul unmarked (a blow never compares the striker's hardness with the target's)", () => {
    const { world: after } = play(start, times(8, strike("maul", "wedge", SOLID)));
    expect(after.things.wedge?.state.integrity).toBeGreaterThan(4.5);
  });
});

describe("tool-05: a beaver fells a birch over several nights", () => {
  const start = world(
    [
      thing("trunk", "birch"),
      thing("crown", "birch"),
      thing("teeth", "teeth", "hearth", { edge: 4 }),
    ],
    [],
    EXTRA,
  );
  const bite = strike("teeth", "trunk", STEADY);
  const bearCrown: Act = { process: "load", support: "trunk", bearing: ["crown"] };
  const gnawedTo = (integrity: number) =>
    world([thing("trunk", "birch", "hearth", { integrity }), thing("crown", "birch")], [], EXTRA);

  it("one bite takes a small share of the trunk, so felling is many nights' work", () => {
    const left = resolve(start, bite).world.things.trunk?.state.integrity ?? 0;
    expect(left).toBeLessThan(5);
    expect(left).toBeGreaterThan(4.9);
  });

  it.fails("and the gnawing gets there in the end (teeth wear like any edge and nothing regrows them: growth is unbuilt, so they go blunt long before the trunk is through)", () => {
    const { world: after } = play(start, times(400, bite));
    expect(after.things.trunk?.state.integrity).toBeLessThan(2.5);
  });

  it("a sound trunk holds its crown, and one gnawed most of the way through does not", () => {
    expect(resolve(gnawedTo(5), bearCrown).world.things.trunk?.state.integrity).toBe(5);
    expect(
      resolve(gnawedTo(1.5), bearCrown).world.things.trunk?.state.integrity,
    ).toBeLessThanOrEqual(1);
  });

  it.fails("RULE ERROR: a trunk gnawed under a third of the way through comes down under its own crown (a sound thing's strength is barely its own mass, so there is almost no margin to gnaw away)", () => {
    expect(resolve(gnawedTo(3.5), bearCrown).world.things.trunk?.state.integrity).toBe(3.5);
  });
});

describe("tool-06: a stone hammer at a quarry face", () => {
  const start = world([thing("face", "rockface"), thing("hammer", "hammer")], [], EXTRA);

  it("a firm blow brings a piece away", () => {
    const { changes } = resolve(start, strike("hammer", "face", FIRM));
    expect(changes.some((c) => c.kind === "create")).toBe(true);
  });

  it("fixed rule: that one blow sends the whole quarry face to pieces (shattering is all or nothing and does not read size)", () => {
    const { world: after } = resolve(start, strike("hammer", "face", FIRM));
    expect(after.things.face?.state.integrity).toBeGreaterThan(4);
  });

  it.fails("every blow and a day's drying loosen the head on its haft (a composite, its fit R10 and a join that drifts are not in the engine)", () => {
    const { changes } = play(start, [
      ...times(30, strike("hammer", "face", FIRM)),
      { process: "drift", minutes: 1440 },
      strike("hammer", "face", FIRM),
    ]);
    expect(changes.some((c) => c.because.includes("R10") || c.because.includes("R4"))).toBe(true);
  });
});

describe("tool-07: carving a spoon from green willow", () => {
  const branch = (flaw = 0) =>
    world(
      [
        thing("branch", "greenwood", "hearth", { flaw }),
        thing("knife", "blade", "hearth", { edge: 4 }),
      ],
      [],
      EXTRA,
    );
  const pass: Act = {
    process: "force",
    instrument: "knife",
    patient: "branch",
    manner: STEADY,
    aim: "along",
  };

  it("a keen knife goes readily into green wood, along the grain", () => {
    const { world: after, changes } = resolve(branch(), pass);
    expect(after.things.branch?.state.integrity).toBeLessThan(5);
    expect(changes.some((c) => c.because.includes("grained"))).toBe(true);
  });

  it.fails("RULE ERROR: thirty steady passes leave the branch in pieces, not carved (force can only take from integrity, and a knife stroke takes a fifth of a branch)", () => {
    const { world: after } = play(branch(), times(30, pass));
    expect(after.things.branch?.state.integrity).toBeGreaterThan(1);
  });

  // Derived since round two of the grown rows (graph/grown.ts): proposed by a model, ratified by Jev.
  it("fixed rule: what was wrong was: thirty passes through green wood take a steel knife from keen to dull", () => {
    const { world: after } = play(branch(), times(30, pass));
    expect(after.things.knife?.state.edge).toBeGreaterThan(3.5);
  });

  it.fails("a hidden knot catches the blade and the wood cracks away (force has no direction, every edge counts as along the grain, and only load reads a flaw)", () => {
    const sound = resolve(branch(0), pass).world.things.branch?.state.integrity ?? 0;
    const knotted = resolve(branch(3), pass).world.things.branch?.state.integrity ?? 0;
    expect(knotted).toBeLessThan(sound);
  });
});

describe("tool-08: driving a peg with a rock", () => {
  const start = world(
    [thing("peg", "peg"), thing("rock", "stone"), thing("mallet", "mallet")],
    [body("player")],
    EXTRA,
  );

  it("the rock mars the head of the peg where a wooden mallet would not", () => {
    const rocked = play(start, times(6, strike("rock", "peg", FIRM))).world.things.peg;
    const malleted = play(start, times(6, strike("mallet", "peg", FIRM))).world.things.peg;
    expect(rocked?.state.integrity).toBeLessThan(5);
    expect(rocked?.state.integrity).toBeGreaterThan(3);
    expect(malleted?.state.integrity).toBe(5);
  });

  it.fails("and the peg goes in, in more swings than a mallet would need (driving is a move into a fit; force only damages)", () => {
    const { changes } = play(start, times(6, strike("rock", "peg", FIRM)));
    expect(changes.some((c) => c.because.includes("R10") || c.because.includes("E5"))).toBe(true);
  });

  it.fails("a glancing blow off the handleless rock bruises a knuckle (aim, grip and care do not reach force)", () => {
    const careless = { effort: 3, care: 0, haste: 4 };
    const { world: after } = play(start, times(6, strike("rock", "peg", careless)));
    expect(after.bodies.player?.wounds.length).toBeGreaterThan(0);
  });
});

describe("tool-10: cutting rope with a blunt knife", () => {
  const start = (edge: number) =>
    world([thing("rope", "rope"), thing("knife", "blade", "hearth", { edge })], [], EXTRA);
  const saw = strike("knife", "rope", FIRM);
  const taken = (edge: number) =>
    5 - (resolve(start(edge), saw).world.things.rope?.state.integrity ?? 5);

  it("a blade with no edge left does not part the rope, however long the sawing, and is no blunter for it", () => {
    const { world: after } = play(start(0), times(60, saw));
    expect(after.things.rope?.state.integrity).toBeGreaterThan(1);
    expect(after.things.knife?.state.edge).toBe(0);
  });

  it.fails("but it frays and weakens the end (an edgeless blade barely marks it: there is no harm short of cutting)", () => {
    const { world: after } = play(start(0), times(60, saw));
    expect(after.things.rope?.state.integrity).toBeLessThan(5);
  });

  it("fixed rule: a badly blunted edge cuts rope nearly as well as a keen one (the cut is tool hardness plus a little edge against hardness alone; keenness does not gate it and the rope's toughness is never read)", () => {
    expect(taken(0.5)).toBeLessThan(taken(4) / 3);
  });

  it("fixed rule: a keen steel knife goes fully blunt before it has parted one rope (bulk is the cube of size, and a cord's size is its length, not what the edge has to cross; and wear counts toughness)", () => {
    const { world: after } = play(start(4), times(40, saw));
    expect(after.things.rope?.state.integrity).toBeLessThanOrEqual(1);
    expect(after.things.knife?.state.edge).toBeGreaterThan(2);
  });
});

describe("build-01: a log bridge", () => {
  const start = world(
    [thing("span", "trunk"), thing("walker", "walker"), thing("cart", "cart")],
    [],
    EXTRA,
  );
  const cross = (what: string): Act => ({ process: "load", support: "span", bearing: [what] });

  it("a young trunk across the banks takes a walker and not a laden cart", () => {
    expect(resolve(start, cross("walker")).world.things.span?.state.integrity).toBe(5);
    expect(resolve(start, cross("cart")).world.things.span?.state.integrity).toBeLessThanOrEqual(1);
  });

  it.fails("and it sags under the walker without breaking (integrity has no step between whole and cracked: deformation)", () => {
    const left = resolve(start, cross("walker")).world.things.span?.state.integrity ?? 0;
    expect(left).toBeLessThan(5);
    expect(left).toBeGreaterThan(3);
  });
});

describe("build-05: rawhide lashings in two days of rain", () => {
  const start = world(
    [thing("lashing", "rawhide", "rain"), thing("pole", "pole", "rain")],
    [],
    EXTRA,
  );
  const soaked = resolve(start, { process: "drift", minutes: 2880 });

  it("the cord soaks, and is weaker and slacker for it", () => {
    const [dry, wet] = [start.things.lashing, soaked.world.things.lashing];
    expect(wet?.state.wetness).toBeGreaterThan(3);
    const before = dry ? effective(start, dry) : undefined;
    const after = wet ? effective(soaked.world, wet) : undefined;
    expect(after?.toughness).toBeLessThan(before?.toughness ?? 0);
    expect(after?.flexibility).toBeGreaterThan(before?.flexibility ?? 5);
  });

  it("and nothing gives way yet: it still holds the pole it binds", () => {
    const { world: after } = resolve(soaked.world, {
      process: "load",
      support: "lashing",
      bearing: ["pole"],
    });
    expect(after.things.lashing?.state.integrity).toBe(5);
  });

  it.fails("the joints have lost their grip and the frame sways (a join R4 with a strength that drifts when wet is not in the engine)", () => {
    expect(soaked.changes.some((c) => c.because.includes("R4"))).toBe(true);
  });
});

describe("build-06: a fox chews through a snare cord", () => {
  const start = world(
    [
      thing("snare", "cord"),
      thing("sapling", "sapling"),
      thing("teeth", "teeth", "hearth", { edge: 3 }),
    ],
    [body("fox")],
    EXTRA,
  );
  const chewed = play(start, times(20, strike("teeth", "snare", STEADY)));

  it("a thin cord is soon gnawed through, and the fox is none the worse", () => {
    expect(chewed.world.things.snare?.state.integrity).toBeLessThanOrEqual(1);
    expect(chewed.world.bodies.fox?.wounds).toHaveLength(0);
  });

  it.fails("the bent sapling springs upright when the cord parts (tension is not a load the engine holds, so nothing is released)", () => {
    expect(chewed.changes.some((c) => c.kind === "state" && c.thing === "sapling")).toBe(true);
  });
});

describe("build-10: a bough roof under two days of snow", () => {
  const roofed = (amount: number) =>
    world([thing("roof", "pole"), thing("snow", "snow", "hearth", { amount })], [], EXTRA);
  const bear: Act = { process: "load", support: "roof", bearing: ["snow"] };

  it("the roof takes the first night's light fall", () => {
    expect(resolve(roofed(0.5), bear).world.things.roof?.state.integrity).toBe(5);
  });

  it.fails("RECALIBRATE (a level of mass became a step of four, cords bear in tension, bulk dries by powers; the assertion's magnitude was set against the old scale): fixed rule: it takes two days' fall just as easily (load weighs a thing by its element's mass level and never reads how much of it there is)", () => {
    expect(resolve(roofed(8), bear).world.things.roof?.state.integrity).toBeLessThanOrEqual(1);
  });
});
