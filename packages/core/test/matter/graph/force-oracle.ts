/**
 * Force as it was when it was functions, kept word for word as the oracle for the rows that
 * replaced it (force-rules.test.ts). Nothing in the engine reads this. When a rule is changed
 * on purpose, change the row and this together, or retire both.
 */
import {
  type Change,
  clamp,
  type EffectRow,
  effective,
  type ForceAct,
  type Manner,
  type MatterWorld,
  ORDINARY,
  type Properties,
  section,
  surfaceTemperature,
  type Thing,
  type Wound,
} from "../../../src/matter/index.ts";

/** What is being worked, as far as force cares. */
interface Resists {
  hardness: number;
  toughness: number;
  size: number;
  /** The dimension a cut has to cross. */
  thickness: number;
}

/** What living flesh is like, as levels: soft, and tougher than it is hard. */
const FLESH: Resists = { hardness: 1, toughness: 2, size: 2, thickness: 1 };

interface Armour {
  id: string;
  resists: Resists;
}

/** The hardest, toughest thing a body wears: what a blow has to get through. */
function wornBy(world: MatterWorld, wears: readonly string[] | undefined): Armour | null {
  let best: Armour | null = null;
  let score = -1;
  for (const id of wears ?? []) {
    const worn = world.things[id];
    if (!worn || worn.state.integrity <= 1) continue;
    const p = effective(world, worn);
    const forms = world.elements[worn.element]?.forms ?? [];
    if (p.hardness + p.toughness <= score) continue;
    score = p.hardness + p.toughness;
    best = { id, resists: { ...p, thickness: section(forms, p.size) } };
  }
  return best;
}

function meetsArmour(tool: Properties, edge: number, manner: Manner, armour: Armour): number {
  return driven(
    Math.max(cut(tool, edge, manner, armour.resists), blow(tool, manner, armour.resists)),
    manner,
  );
}

/** What this body is like to a blow: its own row if it has one, else a person. */
function fleshOf(world: MatterWorld, element: string | undefined): Resists {
  const p = world.elements[element ?? ""]?.props;
  if (!p) return FLESH;
  const size = p.size ?? FLESH.size;
  return {
    hardness: p.hardness ?? FLESH.hardness,
    toughness: p.toughness ?? FLESH.toughness,
    size,
    thickness: Math.max(1, size - 1),
  };
}

interface Reaction {
  id: string;
  /** Minimum effective levels of the instrument. */
  instrument: Partial<Properties>;
  /** Minimum surface temperature of the instrument. */
  temperature: number;
  /** Minimum heat exposure: degrees above warm, times seconds of contact. */
  exposure: number;
  /** What it does, from a closed set the engine knows how to carry out. */
  does: "seal_wounds" | "spark";
  /** How it is shown when it happens, if it is. */
  effect?: EffectRow;
  because: string[];
  note: string;
}

const REACTIONS: readonly Reaction[] = [
  {
    id: "cautery",
    instrument: {},
    temperature: 4,
    exposure: 6,
    does: "seal_wounds",
    because: ["S1", "B3", "X3"],
    note: "held there, the heat closes the wound",
  },
  {
    id: "spark",
    instrument: { hardness: 4 },
    temperature: 0,
    exposure: 0,
    does: "spark",
    because: ["P3", "X2", "E9"],
    note: "hard on hard throws a spark",
  },
];

/** What flows or drifts is not struck: a blow goes through it. */
function flows(world: MatterWorld, thing: Thing): boolean {
  const forms = world.elements[thing.element]?.forms ?? [];
  return forms.includes("liquid") || forms.includes("gas");
}

/** Keenness against toughness. Nothing cuts what is as hard as itself. */
function cut(tool: Properties, edge: number, manner: Manner, patient: Resists): number {
  if (edge <= 0 || tool.hardness <= patient.hardness) return -5;
  const keen = edge + manner.effort * 0.4 + tool.mass * 0.2;
  return keen - (patient.toughness * 0.6 + patient.hardness * 0.4 + 0.5);
}

/** Momentum against toughness and bulk. A light tool taps however hard it is. */
function blow(tool: Properties, manner: Manner, patient: Resists): number {
  const momentum = tool.mass * manner.effort * 0.5 + tool.hardness * 0.3;
  return momentum - (patient.toughness * 1.2 + patient.size * 0.4 + 0.5);
}

/** However good the tool, it goes no deeper than the arm behind it drives it. */
const driven = (x: number, manner: Manner) => Math.min(x, manner.effort * 2);

function meets(reaction: Reaction, tool: Properties, temperature: number, exposure: number) {
  if (temperature < reaction.temperature || exposure < reaction.exposure) return false;
  return Object.entries(reaction.instrument).every(
    ([key, min]) => tool[key as keyof Properties] >= (min ?? 0),
  );
}

function woundBody(world: MatterWorld, act: ForceAct, instrument: Thing): Change[] {
  const body = world.bodies[act.patient];
  if (!body) return [];
  const manner = act.manner ?? ORDINARY;
  const seconds = act.seconds ?? 0.3;
  const tool = effective(world, instrument);
  const edge = instrument.state.edge;
  const flesh = fleshOf(world, body.element);
  const bare = driven(Math.max(cut(tool, edge, manner, flesh), blow(tool, manner, flesh)), manner);
  const armour = wornBy(world, body.wears);
  const turned = armour !== null && meetsArmour(tool, edge, manner, armour) <= 0;
  // What is worn meets the blow first. Turned, only the shock of it reaches the body.
  const into = turned ? Math.max(0, blow(tool, manner, flesh)) * 0.3 : bare;
  const depth = clamp(into * 0.8);
  const temperature = surfaceTemperature(instrument);
  const exposure = Math.max(0, temperature - 3) * seconds;
  const burned = clamp(Math.max(0, temperature - 3) * Math.min(1, seconds / 3) * 2);
  const seal = REACTIONS.find((r) => r.does === "seal_wounds");
  const sealing = seal !== undefined && meets(seal, tool, temperature, exposure);
  const open = body.wounds.some((w) => w.bleeding > 0);
  const changes: Change[] = [];
  // A burn with no cut is a wound of its own, unless the heat went into closing one.
  if (depth > 0 || (burned > 0 && !(sealing && open))) {
    const bleeding = edge > 0 && !turned ? depth : depth * 0.3;
    const wound: Wound = { depth, bleeding, burned };
    changes.push({
      kind: "wound",
      body: body.id,
      wound,
      because: ["X2", "P3", "S5", "B3", ...(burned > 0 ? ["S1", "X3"] : [])],
      note: burned > 0 ? "it sears what it touches" : "it cuts",
    });
  }
  if (seal && sealing)
    body.wounds.forEach((w, index) => {
      if (w.bleeding <= 0) return;
      const set = { bleeding: 0, burned: clamp(w.burned + burned) };
      const { because, note } = seal;
      changes.push({ kind: "treat", body: body.id, index, set, because, note });
    });
  return changes;
}

/** An edge wears by how hard the work is against its own hardness, and by how it is used. */
function wear(instrument: Thing, tool: Properties, p: Properties, act: ForceAct): Change[] {
  if (instrument.state.edge <= 0) return [];
  const manner = act.manner ?? ORDINARY;
  const ratio = Math.max(0.2, p.hardness / Math.max(1, tool.hardness));
  const use = act.aim === "surface" ? 0.5 : 1;
  const loss = 0.05 * manner.effort ** 2 * ratio ** 2 * use;
  return [
    {
      kind: "state",
      thing: instrument.id,
      set: { edge: clamp(instrument.state.edge - loss) },
      because: ["S5", "P3", "X2"],
      note: "the edge wears",
    },
  ];
}

interface Struck {
  patient: Thing;
  tool: Properties;
  p: Properties;
  resists: Resists;
  act: ForceAct;
}

/** A cut severs what is thin, scars what is thick, and only shaves when it works the surface. */
function cutting({ patient, tool, resists, act }: Struck, into: number): Change[] {
  const reach = 1 + tool.size * 0.5;
  if (act.aim === "surface") {
    // What comes off is still there: shavings, spoil, scrapings. The thing is the less for it.
    const taken = Math.min(patient.state.amount * 0.5, into * 0.02 * reach);
    if (taken <= 0) return [];
    return [
      {
        kind: "create",
        thing: {
          id: `${patient.id}.spoil`,
          element: patient.element,
          place: patient.place,
          state: { ...patient.state, integrity: 5, amount: taken, coating: null, burning: null },
        },
        because: ["X2", "S5", "P4", "S14", "E3"],
        note: "what comes off it lies beside it",
      },
      {
        kind: "consume",
        thing: patient.id,
        amount: taken,
        because: ["X2", "S14", "E4"],
        note: "and the thing is the less for it",
      },
    ];
  }
  const share = (into * reach) / (1 + resists.thickness) ** 3;
  return [
    {
      kind: "state",
      thing: patient.id,
      set: { integrity: clamp(patient.state.integrity - share) },
      because: ["X2", "S5", "P4", "P2", "S4", ...(act.aim === "along" ? ["grained"] : [])],
      note: share >= patient.state.integrity ? "it parts" : "the edge bites into it",
    },
  ];
}

/** What is tough takes a blow without breaking; struck by something harder, it is marred. */
function denting(
  { patient, tool, p }: Pick<Struck, "patient" | "tool" | "p">,
  into: number,
): Change[] {
  if (tool.hardness <= p.hardness)
    return [{ kind: "nothing", because: ["X2", "P4"], note: "it takes the blow and gives" }];
  const share = (into * 0.3 * (1 + tool.size * 0.5)) / (1 + p.size) ** 3;
  return [
    {
      kind: "state",
      thing: patient.id,
      set: { integrity: clamp(patient.state.integrity - share) },
      because: ["X2", "P3", "P4", "S4"],
      note: "the harder thing mars it",
    },
  ];
}

/** Only what is not tough fractures. A small thing shatters whole; a big one spalls a piece. */
function breaking({ patient, tool, p, act }: Struck, into: number): Change[] {
  // A hidden flaw is found by a blow as surely as by a load.
  const brittle = clamp((3 - (p.toughness - patient.state.flaw)) / 3, 0, 1);
  if (brittle <= 0) return denting({ patient, tool, p }, into);
  const share = (into * 5 * brittle * (1 + tool.size * 0.5)) / (1 + p.size) ** 3;
  const whole = share >= 2 && p.toughness <= 1;
  const changes: Change[] = [
    {
      kind: "state",
      thing: patient.id,
      set: { integrity: whole ? 0 : clamp(patient.state.integrity - share) },
      because: ["X2", "P4", "P1", "P2", "S4"],
      note: whole ? "it goes to pieces" : "it gives under the blow",
    },
  ];
  const taken = Math.min(patient.state.amount * 0.5, share / 5);
  if (p.toughness > 1 || into <= 1 || patient.state.integrity <= 0 || taken <= 0) return changes;
  // What is hard and not tough breaks sharp, if the blow was placed with care.
  const care = (act.manner ?? ORDINARY).care;
  const edge = p.hardness >= 4 ? clamp(care * 1.5, 0, 4) : 0;
  changes.push({
    kind: "create",
    thing: {
      id: `${patient.id}.piece`,
      element: patient.element,
      place: patient.place,
      // The coat stays with what it was on: a piece does not come away with a second coat.
      state: { ...patient.state, integrity: 5, edge, amount: taken, coating: null, burning: null },
    },
    because: ["P3", "P4", "S5", "E3"],
    note: edge > 0 ? "a piece comes away with a keen edge" : "a piece breaks off",
  });
  // The pieces of a thing sum to the thing.
  changes.push({
    kind: "consume",
    thing: patient.id,
    amount: taken,
    because: ["S14", "E4"],
    note: "and the thing is the less for it",
  });
  return changes;
}

/**
 * A collision falls on both. The striker meets the rule the struck thing met, under the same
 * momentum, by its own toughness and bulk; a blow placed with care spares the striker.
 */
function recoil(struck: Struck, instrument: Thing, momentum: number, manner: Manner): Change[] {
  const { tool, p } = struck;
  const into = driven(
    momentum + p.hardness * 0.3 - (tool.toughness * 1.2 + tool.size * 0.4 + 0.5),
    manner,
  );
  if (into <= 0) return [];
  const spared = into * (1 - manner.care / 6);
  const back: Struck = { ...struck, patient: instrument, tool: p, p: tool };
  return breaking(back, spared).filter((c) => c.kind !== "nothing");
}

function strikeThing(world: MatterWorld, act: ForceAct, instrument: Thing): Change[] {
  const patient = world.things[act.patient];
  if (!patient || patient.id === instrument.id || flows(world, patient) || flows(world, instrument))
    return [];
  const manner = act.manner ?? ORDINARY;
  const tool = effective(world, instrument);
  const p = effective(world, patient);
  const forms = world.elements[patient.element]?.forms ?? [];
  const resists: Resists = { ...p, thickness: section(forms, p.size) };
  const grain = act.aim === "along" && forms.includes("grained") ? 1 : 0;
  const cutInto = driven(cut(tool, instrument.state.edge, manner, resists) + grain, manner);
  const blowInto = driven(blow(tool, manner, resists), manner);
  const struck: Struck = { patient, tool, p, resists, act };
  const changes: Change[] = [
    {
      kind: "signal",
      place: patient.place,
      channel: "sound",
      source: patient.id,
      strength: clamp(1 + manner.effort * 0.5 + Math.min(tool.hardness, p.hardness) * 0.4),
      because: ["X2", "E9"],
      note: "the blow sounds",
    },
    ...wear(instrument, tool, p, act),
  ];
  if (cutInto > 0 && cutInto >= blowInto) changes.push(...cutting(struck, cutInto));
  else if (blowInto > 0) changes.push(...breaking(struck, blowInto));
  else changes.push({ kind: "nothing", because: ["X2", "P3", "P4"], note: "it barely marks it" });
  changes.push(...recoil(struck, instrument, tool.mass * manner.effort * 0.5, manner));
  const spark = REACTIONS.find((r) => r.does === "spark");
  if (spark && p.hardness >= 4 && manner.effort >= 3 && meets(spark, tool, 0, 0))
    changes.push({
      kind: "signal",
      place: patient.place,
      channel: "light",
      source: patient.id,
      strength: 1,
      because: spark.because,
      note: spark.note,
    });
  return changes;
}

export function forceOracle(world: MatterWorld, act: ForceAct): Change[] {
  const instrument = world.things[act.instrument];
  if (!instrument)
    return [{ kind: "nothing", because: [], note: "there is nothing there to strike with" }];
  const worn = wornBy(world, world.bodies[act.patient]?.wears);
  const onArmour = worn ? strikeThing(world, { ...act, patient: worn.id }, instrument) : [];
  const changes = [
    ...woundBody(world, act, instrument),
    ...onArmour,
    ...strikeThing(world, act, instrument),
  ];
  if (changes.length > 0) return changes;
  return [{ kind: "nothing", because: ["X2"], note: "nothing comes of it" }];
}
