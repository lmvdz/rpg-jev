/**
 * Solid contact conduction in SI units, as a matter process: the bounded thermal fixture
 * (`../thermal/physics.ts`, mechanics `solid-contact-v1`) carried out on matter things. A thing
 * with `si` heat data is a lumped 0.01 m cube; things whose tiles touch edge to edge exchange
 * heat through the series conductance of their halves; a probe exchanges through its own
 * conductance with the one thing it is docked to. Explicit Euler on a fixed 0.01 s grid, in
 * the same order as the fixture, so the two agree to the joule
 * (`test/matter/conduct-oracle.test.ts`). The ordinal temperature follows from the energy by one
 * code calibration, never the other way.
 */
import type { Change, MatterWorld, SolidHeat, Thing } from "./types.ts";
import { clamp } from "./types.ts";

export interface ConductAct {
  process: "conduct";
  place: string;
  /** Whole seconds, 0 to 60, as the fixture allows. */
  seconds: number;
}

/** Kelvin to the ordinal scale: 20 °C is mild (2), and each 20 K is a level. */
export const levelOfKelvin = (kelvin: number): number => clamp(2 + (kelvin - 293.15) / 20);

export const capacityOf = (si: SolidHeat): number =>
  si.probe ? si.probe.capacityJPerK : si.massKg * si.specificHeatJPerKgK;

export const kelvinOf = (si: SolidHeat): number => si.energyJ / capacityOf(si);

const compareIds = (a: string, b: string): number => {
  if (a === b) return 0;
  return a < b ? -1 : 1;
};

interface Node {
  id: string;
  si: SolidHeat;
  capacity: number;
  energy: number;
  delta: number;
}

interface Edge {
  a: Node;
  b: Node;
  conductance: number;
}

function touching(a: Thing, b: Thing): boolean {
  if (!(a.where && b.where)) return false;
  return Math.abs(a.where[0] - b.where[0]) + Math.abs(a.where[1] - b.where[1]) === 1;
}

function edgesOf(world: MatterWorld, nodes: readonly Node[]): Edge[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges: Edge[] = [];
  const solids = nodes.filter((n) => !n.si.probe);
  for (const [i, a] of solids.entries()) {
    for (const b of solids.slice(i + 1)) {
      const [ta, tb] = [world.things[a.id], world.things[b.id]];
      if (!(ta && tb && touching(ta, tb))) continue;
      const conductance =
        0.0001 / (0.005 / a.si.conductivityWPerMK + 0.005 / b.si.conductivityWPerMK);
      edges.push({ a, b, conductance });
    }
  }
  for (const probe of nodes) {
    const target = probe.si.probe?.target;
    const docked = target === null || target === undefined ? undefined : byId.get(target);
    if (probe.si.probe && docked && world.things[docked.id]?.where)
      edges.push({ a: probe, b: docked, conductance: probe.si.probe.conductanceWPerK });
  }
  return edges.sort((x, y) => compareIds(x.a.id, y.a.id) || compareIds(x.b.id, y.b.id));
}

export function conduct(world: MatterWorld, act: ConductAct): Change[] {
  const seconds = Math.floor(act.seconds);
  if (!(seconds > 0 && seconds <= 60))
    return [{ kind: "nothing", because: ["X3"], note: "no time passes for heat to move" }];
  const nodes: Node[] = Object.values(world.things)
    .filter((t): t is Thing & { si: SolidHeat } => t.place === act.place && !!t.si)
    .map((t) => ({
      id: t.id,
      si: t.si,
      capacity: capacityOf(t.si),
      energy: t.si.energyJ,
      delta: 0,
    }))
    .sort((a, b) => compareIds(a.id, b.id));
  const edges = edgesOf(world, nodes);
  for (let step = 0; step < seconds * 100; step++) {
    for (const node of nodes) node.delta = 0;
    for (const { a, b, conductance } of edges) {
      const transfer = conductance * (a.energy / a.capacity - b.energy / b.capacity) * 0.01;
      a.delta -= transfer;
      b.delta += transfer;
    }
    for (const node of nodes) node.energy += node.delta;
  }
  return nodes.flatMap((node): Change[] => [
    {
      kind: "energy",
      thing: node.id,
      energyJ: node.energy,
      because: ["X3", "P7"],
      note: "heat passes between what touches",
      quiet: true,
    },
    {
      kind: "state",
      thing: node.id,
      set: { temperature: levelOfKelvin(node.energy / node.capacity) },
      because: ["X3", "S1"],
      note: "it is as warm as its heat",
      quiet: true,
    },
  ]);
}
