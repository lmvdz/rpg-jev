/** Bounded, real-millilitre mechanism state; independent of ordinal matter properties. */
export interface Material {
  id: string;
  label: string;
}
export interface Actor {
  id: string;
  x: number;
  z: number;
  version: number;
  carrySlots: number;
}
export interface Holder {
  id: string;
  label: string;
  look: { glyph: number; ink: number; scale?: number | undefined };
  capacityMl: number;
  portable: boolean;
  open: boolean;
  placement: { kind: "ground"; x: number; z: number } | { kind: "held"; actor: string };
  contents: null | { material: string; quantityMl: number };
  version: number;
}
export interface State {
  actors: Actor[];
  holders: Holder[];
  materials: Material[];
}
export type Action =
  | { kind: "none" }
  | { kind: "opening"; holder: string; open: boolean }
  | { kind: "take"; holder: string }
  | { kind: "place"; holder: string; x: number; z: number }
  | { kind: "transfer"; source: string; destination: string; quantityMl: number }
  | { kind: "move"; x: number; z: number };
export interface Attempt {
  /** Bind this externally to the authenticated caller, never client body text. */
  actor: string;
  versions: Record<string, number>;
  action: Action;
}
export type Effect =
  | { kind: "holder_updated"; beforeVersion: number; after: Holder }
  | { kind: "actor_updated"; beforeVersion: number; after: Actor };
export type Reason =
  | "applied"
  | "none"
  | "unchanged"
  | "invalid_attempt"
  | "access"
  | "stale"
  | "not_portable"
  | "carry_full"
  | "not_held"
  | "invalid_quantity"
  | "insufficient"
  | "capacity"
  | "mixture"
  | "same_holder"
  | "invalid_step"
  | "blocked"
  | "terrain_required";
export interface Outcome {
  effects: Effect[];
  status: "applied" | "noop" | "rejected" | "unsupported";
  reason: Reason;
}
export interface Context {
  canStep?: (actor: Readonly<Actor>, x: number, z: number) => boolean;
  /** Required for placement: the caller owns the authoritative terrain policy. */
  canPlace?: (actor: Readonly<Actor>, x: number, z: number) => boolean;
}
export type VisibleHolder = Omit<Holder, "contents"> & {
  /** Absent means hidden, null means visibly empty. */
  contents?: (NonNullable<Holder["contents"]> & { label: string }) | null;
};
export interface View {
  actor: Actor;
  holders: VisibleHolder[];
}
export type Option = Omit<Attempt, "actor">;
