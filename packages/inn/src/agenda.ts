/**
 * What the inn does on its own: gossip when people meet, debts coming due,
 * and the quest guards. Code decides when each of these happens (SPEC.md
 * sections 7 and 9); the judge is asked only what someone chooses to do or
 * believe at that moment.
 */
import {
  type Belief,
  beliefIn,
  type Claim,
  type Debt,
  type Distortion,
  distort,
  dueDebts,
  expiredDebts,
  feasibleDistortions,
  type LogId,
  sameMatter,
} from "@rpg-jev/core";
import {
  type Asked,
  believeClaim,
  compileSlice,
  FAITHFUL,
  KEEP_QUIET,
  type Option,
  pickDistortion,
  pickSpeechAct,
  questGuard,
  type Slice,
  stakeInClaim,
} from "@rpg-jev/jev";
import {
  C_ACCUSATION,
  C_ODO_TOOK,
  IMPLICATES,
  MARA,
  NPCS,
  PLAYER,
  RETELLING_HABIT,
  TRUST,
  WRONGDOING,
} from "./content.ts";
import type { Game } from "./game.ts";
import { goTo, react } from "./reactions.ts";
import { guardSlice, rankedBeliefs, sceneSlice, standing, trustIn } from "./slices.ts";
import { guarded, keptBack } from "./talk.ts";
import { cap, claimClause, nameOf, tieWords, whenFor } from "./words.ts";

/** Minutes before the same two people trade tales again, in either direction. */
const GOSSIP_COOLDOWN = 35;

export async function runAgenda(g: Game, cause: LogId): Promise<void> {
  for (const debt of expiredDebts(g.world))
    g.commit({ kind: "settle_debt", id: debt.id, status: "cancelled" }, debt.cause ?? cause);
  // What comes due because of what just happened is due now too: a consequence with no
  // delay lands in the same pass. Each debt is tried once a pass, so one that is waiting
  // for its moment (someone to share a room with) cannot hold the pass up.
  const tried = new Set<string>();
  for (;;) {
    const debt = dueDebts(g.world).find((d) => !tried.has(d.id));
    if (!debt || g.ending()) break;
    tried.add(debt.id);
    await fire(g, debt, debt.cause ?? cause);
  }
  if (g.ending()) return;
  await meetings(g, cause);
}

// --- Gossip -------------------------------------------------------------------

/** When two NPCs share a room and have not talked lately, a tale may pass between them. */
async function meetings(g: Game, cause: LogId): Promise<void> {
  for (const [i, first] of NPCS.entries())
    for (const second of NPCS.slice(i + 1)) {
      const a = g.world.actors[first];
      const b = g.world.actors[second];
      if (!(a?.alive && b?.alive && a.present && b.present) || a.room !== b.room) continue;
      const pair = [first, second].sort().join("+");
      const last = g.log.findLast(
        (e) => e.kind === "stimulus" && e.what === "gossip" && e.data.pair === pair,
      );
      if (last && g.world.clock - last.t < GOSSIP_COOLDOWN) continue;
      // A meeting is an exchange: each may have something for the other. One pair per
      // step keeps the wait per player action bounded.
      let talked = false;
      for (const [teller, listener] of [
        [first, second],
        [second, first],
      ] as const) {
        const tale = taleFor(g, teller, listener);
        if (tale) talked = (await gossip(g, teller, listener, tale, cause)) || talked;
      }
      if (talked) return;
    }
}

const incriminates = (teller: string, c: Claim) =>
  c.subject === teller && WRONGDOING.includes(c.predicate);

/** The best tale the teller has that the listener has not heard. Ranked in code, not by the judge. */
function taleFor(g: Game, teller: string, listener: string): Belief | undefined {
  return rankedBeliefs(g.world, teller).find((b) => {
    const c = b.claim;
    if (b.credence < 0.5 || c.predicate === "owes" || incriminates(teller, c)) return false;
    // Nobody needs telling what they did themselves.
    if (c.subject === listener) return false;
    // A tale the teller is guarding is not idle talk. The family probe found the judge
    // would have Tobin tell Mara what he saw the first time they were alone (0.90, and
    // 0.71 with "afraid of Odo" as a trait), which would end the night by eight. His
    // silence is therefore a rule tied to his debt; paying the debt lifts it. He can
    // still be asked, and his conscience still comes due.
    if (guarded(g, teller, c)) return false;
    // Nor that something was done at their own asking.
    if (c.motive === "was_asked" && listener === MARA) return false;
    const source = b.edge.source;
    if (source && "from" in source && source.from === listener) return false;
    // Old news: they hold it already, at least as bad, or they were there and saw it.
    const known = rankedBeliefs(g.world, listener).some(
      (k) =>
        k.claim.id === c.id ||
        (sameMatter(k.claim, c) &&
          k.claim.subject === c.subject &&
          (k.claim.severity >= c.severity || k.edge.source?.kind === "witnessed")),
    );
    return !known;
  });
}

/** Who the teller would rather it had been: whoever they trust least. */
function scapegoat(teller: string, listener: string, claim: Claim): string | null {
  const candidates = [PLAYER, ...NPCS].filter(
    (id) => id !== teller && id !== listener && id !== claim.subject,
  );
  const trust = (id: string) => TRUST[teller]?.[id] ?? 0.5;
  return candidates.sort((a, b) => trust(a) - trust(b))[0] ?? null;
}

const DISTORTION_WORDS: Record<Distortion, string> = {
  exaggerate_severity: "Makes it sound worse",
  swap_culprit: "Names the wrong person",
  drop_motive: "Leaves out the reason",
};

/**
 * One tale, one hop (SPEC.md section 9). Call one: does the listener have a
 * stake, and which version does the teller tell? Code applies the distortion
 * to the structure. Call two: does the listener believe the version they got?
 */
export async function gossip(
  g: Game,
  teller: string,
  listener: string,
  tale: Belief,
  cause: LogId,
): Promise<boolean> {
  const stimulus = g.store.append(
    {
      kind: "stimulus",
      what: "gossip",
      data: { pair: [teller, listener].sort().join("+"), claim: tale.claim.id },
    },
    cause,
  );
  const claim = tale.claim;
  const swapTo = scapegoat(teller, listener, claim);
  const versions = new Map<string, Claim>([[FAITHFUL, claim]]);
  const options: Option[] = feasibleDistortions(claim, swapTo).map((how) => {
    const version = distort(claim, how, swapTo);
    versions.set(how, version);
    return {
      id: how,
      description: `${DISTORTION_WORDS[how]}: says that ${claimClause(g.world, version)}`,
    };
  });
  const when = whenFor(claim, g.world.clock);
  const listenerName = nameOf(g.world, listener);
  // M0: a social constraint only counts if it is a stated fact. A live night had Tobin
  // tell Mara what he saw Odo do with Odo standing at the hearth beside them.
  const room = g.world.actors[teller]?.room ?? "";
  const earshot = [...g.npcsIn(room), ...(g.playerRoom === room ? [PLAYER] : [])]
    .filter((id) => id !== teller && id !== listener)
    .map((id) =>
      id === claim.subject
        ? `${nameOf(g.world, id)}, the very person the story is about`
        : nameOf(g.world, id),
    );
  const retelling = {
    claim: `${cap(claimClause(g.world, claim))}${when}`,
    listener: listenerName,
    listener_is: relationOf(g, teller, listener, claim),
    within_earshot: earshot.length > 0 ? earshot.join(" and ") : "nobody else",
  };
  const habit = RETELLING_HABIT[teller] ?? { [FAITHFUL]: 1 };
  const labels = [FAITHFUL, ...options.map((o) => o.id), KEEP_QUIET];
  // With no judge, habit decides; and nobody's habit is to carry a tale they are guarding.
  const likely = guarded(g, teller, claim)
    ? KEEP_QUIET
    : Object.entries(habit)
        .filter(([id]) => labels.includes(id))
        .sort((a, b) => b[1] - a[1])[0]?.[0];
  const questions: Record<string, Asked> = {
    version: pickDistortion(
      `npcs.${teller}`,
      options,
      `Tells it as they hold it: says that ${claimClause(g.world, claim)}`,
      likely ?? FAITHFUL,
    ),
    stake: stakeInClaim(`npcs.${listener}`, claim.severity >= 2 ? 0.8 : 0.4),
  };
  const together = [
    { kind: "in_room" as const, actor: listener, room: g.world.actors[teller]?.room ?? "" },
    { kind: "alive" as const, actor: teller },
  ];
  const slice = compileSlice(sceneSlice, {
    world: g.world,
    parts: [
      { npc: teller, extra: { retelling } },
      {
        npc: listener,
        extra: {
          notices: `${nameOf(g.world, teller)} has something to say about this: ${retelling.claim}`,
        },
      },
    ],
  });
  const first = await g.decide(slice, questions, together, stimulus);
  if (!first) return false;
  const how = g.sampleChoice(first.answers.version, `${teller} retells`, first.id) ?? KEEP_QUIET;
  const told = versions.get(how);
  if (!told) return false;

  // The tale is told whether or not anyone overhears, so its line never waits for the floor.
  g.intent(teller, listener, "tell", { kind: "claim", id: claim.id }, 3, first.id);
  const cares = g.sampleYes(first.answers.stake, `${listener} stake`, first.id);
  if (!cares && told.severity === 1) return true;

  const source = { kind: "told", from: teller } as const;
  const hears = {
    claim: `${cap(claimClause(g.world, told))}${when}`,
    from: relationOf(g, listener, teller, told),
    how: "told to them in passing, as something the teller is sure of",
  };
  const second = await g.decide(
    compileSlice(sceneSlice, {
      world: g.world,
      parts: [{ npc: listener, about: told.subject, extra: { hears } }],
    }),
    { believes: believeClaim(`npcs.${listener}`, trustIn(g.world, listener, teller)) },
    together,
    first.id,
  );
  if (!second) return true;
  const believed = g.sampleYes(second.answers.believes, `${listener} believes`, second.id);
  g.learn(listener, told, g.credenceFor(source, believed), source, second.id);
  // The spoken line should carry the version that was actually told.
  const spoken = g.fresh.find((i) => i.speaker === teller && i.listener === listener);
  if (spoken) spoken.topic = { kind: "claim", id: told.id };
  return true;
}

function relationOf(g: Game, from: string, other: string, claim: Claim): string {
  const name = nameOf(g.world, other);
  const about = claim.subject === other ? ", the very person the story is about" : "";
  return `${name}, ${tieWords(g.world, from, other)}, ${standing(g.world, from, other)}${about}`;
}

// --- Debts coming due -----------------------------------------------------------

const settle = (g: Game, debt: Debt, cause: LogId, status: "fired" | "cancelled" = "fired") =>
  g.commit({ kind: "settle_debt", id: debt.id, status }, cause);

const cancel = (g: Game, debt: Debt, cause: LogId): void => {
  settle(g, debt, cause, "cancelled");
};

async function handleFaceStranger(g: Game, debt: Debt, cause: LogId): Promise<void> {
  const who = g.world.actors[debt.stakeholder];
  // Waits, pending, until they share a room with the stranger. No walking: it is
  // something to bring up, not an errand.
  const held = debt.data.claim ? beliefIn(g.world, debt.stakeholder, debt.data.claim) : null;
  if (!held || held.credence < 0.4) return cancel(g, debt, cause);
  // If they have already said it to the stranger's face, it has been brought up.
  const already = g.log.some(
    (e) =>
      e.kind === "effect" &&
      e.effect.kind === "say" &&
      e.effect.intent.speaker === debt.stakeholder &&
      e.effect.intent.listener === PLAYER &&
      e.effect.intent.topic.kind === "claim" &&
      e.effect.intent.topic.id === held.claim.id,
  );
  if (already) return cancel(g, debt, cause);
  if (who?.room !== g.playerRoom) return;
  // One thing at a time: if they are already about to speak, the rest keeps.
  if (g.fresh.some((i) => i.speaker === debt.stakeholder)) return;
  settle(g, debt, cause);
  const clause = `${claimClause(g.world, held.claim)}${whenFor(held.claim, g.world.clock)}`;
  const options: Option[] = [
    { id: "accuse", description: `Says to the stranger's face that ${clause}` },
    { id: "ask", description: `Asks the stranger whether it is true that ${clause}` },
  ];
  const hears = `${nameOf(g.world, debt.stakeholder)} finds the stranger in the same room, with this still on their mind: ${clause}`;
  const decision = await g.decide(
    compileSlice(sceneSlice, {
      world: g.world,
      parts: [{ npc: debt.stakeholder, about: PLAYER, extra: { hears } }],
    }),
    { raises: pickSpeechAct({ npc: `npcs.${debt.stakeholder}`, options, fallback: "accuse" }) },
    [{ kind: "in_room", actor: debt.stakeholder, room: g.playerRoom }],
    cause,
  );
  if (!decision) return;
  const act = g.sampleChoice(decision.answers.raises, `${debt.stakeholder} raises it`, decision.id);
  if (act === "accuse" || act === "ask")
    g.intent(debt.stakeholder, PLAYER, act, { kind: "claim", id: held.claim.id }, 3, decision.id);
}

/**
 * One small function per debt kind (SPEC.md section 9's "add here" is a row in this
 * table): a new debt kind is a new entry, not a new arm of a growing switch.
 */
const DEBT_HANDLERS: Record<
  string,
  (g: Game, debt: Debt, cause: LogId, quest: string | undefined) => Promise<void>
> = {
  report: (g, debt, cause) => carryTale(g, debt, cause),
  retaliate: (g, debt, cause) => carryTale(g, debt, cause),
  testify: (g, debt, cause) => carryTale(g, debt, cause),
  face_stranger: (g, debt, cause) => handleFaceStranger(g, debt, cause),
  react: (g, debt, cause) => react(g, debt, cause),
};

async function fire(g: Game, debt: Debt, cause: LogId): Promise<void> {
  const who = g.world.actors[debt.stakeholder];
  if (!(who?.alive && who.present)) {
    settle(g, debt, cause, "cancelled");
    return;
  }
  const handler = DEBT_HANDLERS[debt.kind];
  if (handler) {
    await handler(g, debt, cause, g.world.machines.quest?.node);
    return;
  }
  settle(g, debt, cause, "cancelled");
}

/** Which belief the tale carries: what Tobin saw, the best grudge against the stranger, or the debt's own claim. */
function taleToCarry(
  g: Game,
  debt: Debt,
  teller: string,
  to: string,
  wanted: Belief | undefined,
): Belief | undefined {
  // Speaking up is for someone: it carries what points away from them, unless the debt says which tale.
  if (debt.kind === "testify") return wanted ?? keptBack(g, teller, [to, debt.data.for ?? PLAYER]);
  if (debt.kind === "retaliate")
    return rankedBeliefs(g.world, teller).find(
      (b) =>
        b.claim.subject === PLAYER &&
        WRONGDOING.includes(b.claim.predicate) &&
        !beliefIn(g.world, to, b.claim.id),
    );
  return wanted;
}

/** Someone owes someone else a tale. They walk over if it matters enough, and tell it on arrival. */
async function carryTale(g: Game, debt: Debt, cause: LogId): Promise<void> {
  const teller = debt.stakeholder;
  const to = debt.data.to ?? MARA;
  const here = g.world.actors[teller]?.room;
  const there = g.world.actors[to]?.room;
  if (!(there && here)) return cancel(g, debt, cause);
  if (here !== there) {
    const walking = g.world.schedules[teller]?.commitments.some(
      (c) => c.id.startsWith("reporting") && c.until > g.world.clock,
    );
    if (debt.magnitude >= 2 && !walking)
      goTo(g, teller, there, debt.kind === "testify" ? "testifying" : "reporting", 8, cause);
    if (g.world.actors[teller]?.room !== there) return;
  }
  const wanted = debt.data.claim ? beliefIn(g.world, teller, debt.data.claim) : undefined;
  const tale = taleToCarry(g, debt, teller, to, wanted);
  settle(g, debt, cause);
  if (debt.data.say) {
    g.intent(teller, to, "promise", { kind: "request", id: debt.data.say }, 3, cause);
    return;
  }
  if (!tale || tale.credence < 0.4) return;
  if (to === PLAYER) {
    g.intent(teller, PLAYER, "confide", { kind: "claim", id: tale.claim.id }, 3, cause);
    return;
  }
  // Old news is not carried: the listener holds it already, or a worse version of it.
  const stale = rankedBeliefs(g.world, to).some(
    (k) =>
      k.claim.id === tale.claim.id ||
      (sameMatter(k.claim, tale.claim) &&
        k.claim.subject === tale.claim.subject &&
        k.claim.severity >= tale.claim.severity),
  );
  if (stale) return;
  await gossip(g, teller, to, tale, cause);
}

// --- Quest guards ----------------------------------------------------------------

const GUARD = {
  instructions: [
    "Has `npcs.mara.name` stopped believing `quest.accusation`? Judge only from `npcs.mara.recent_events`, `npcs.mara.knows` and `npcs.mara.traits`.",
    "Judging only from `npcs.mara.recent_events`, `npcs.mara.knows` and `npcs.mara.traits`: does `npcs.mara.name` no longer think that `quest.accusation` is true?",
  ] as [string, string],
  true: "Mara now thinks the stranger did not take the ledger",
  false: {
    what: "Mara still suspects or believes that the stranger took the ledger",
    examples: [
      "She has only the stranger's word for it",
      "The stranger returned the ledger but cannot say where it was",
    ],
  },
};

const CULPRIT = {
  instructions: [
    "Does `npcs.mara.name` now believe that Odo, her cook, is the one who took the ledger? Judge only from `npcs.mara.recent_events`, `npcs.mara.knows` and `npcs.mara.traits`.",
    "Judging only from `npcs.mara.recent_events`, `npcs.mara.knows` and `npcs.mara.traits`: has `npcs.mara.name` come to think her cook Odo took the ledger?",
  ] as [string, string],
  true: "Mara is satisfied that Odo took it",
  false: {
    what: "Mara is not yet satisfied that it was Odo",
    examples: ["She has a suspicion and nothing to hang it on", "Only the stranger says so"],
  },
};

/**
 * Both wordings must reach this. Live runs put a bare return of the ledger at 0.45 to
 * 0.62 and the working routes at 0.65 to 0.88, so the bar sits between them.
 */
export const GUARD_THRESHOLD = 0.65;

const POINTS_ELSEWHERE = [...IMPLICATES, "forced_latch"];
const SPEAKS_FOR_STRANGER = ["in_plain_view", "pack_was_clean", "handed_over"];

/** Does Mara believe anything at all that points away from the stranger? */
function groundsForDoubt(g: Game): boolean {
  return rankedBeliefs(g.world, MARA).some(
    (b) =>
      b.credence >= 0.6 &&
      (b.claim.subject === PLAYER
        ? SPEAKS_FOR_STRANGER.includes(b.claim.predicate)
        : POINTS_ELSEWHERE.includes(b.claim.predicate)),
  );
}

const noul = (a: unknown): number => {
  const answer = a as { type?: string; noul?: number } | undefined;
  return answer?.type === "noul" && typeof answer.noul === "number" ? answer.noul : 0;
};

/**
 * The quest advances when the judge decides Mara no longer believes it, not
 * when a flag flips (SPEC.md section 8). The guard is asked only when her
 * slice has changed, in two wordings, and commits on their mean.
 */
/** Do not ask unless the quest is live, Mara can answer, her slice has moved, and there is doubt to weigh. */
function shouldAskGuard(g: Game, quest: string | undefined, slice: Slice): boolean {
  if (quest !== "suspected" && quest !== "cleared") return false;
  if (!g.world.actors[MARA]?.alive) return false;
  const asked = g.log.findLast((e) => e.kind === "stimulus" && e.what === "guard");
  if (asked?.kind === "stimulus" && asked.data.slice === slice.hash) return false;
  const tonight = (slice.state.npcs as { mara: { recent_events: string[] } }).mara.recent_events;
  if (tonight.length === 0) return false;
  // A hard precondition, checked in code: with nothing at all pointing away from the
  // stranger there is nothing for the judge to weigh, so it is not asked.
  return groundsForDoubt(g);
}

/** Whether Mara is cleared, and whether she has settled on Odo, from the guard's two wordings. */
function guardVerdict(
  g: Game,
  decision: Awaited<ReturnType<Game["decide"]>>,
): {
  cleared: boolean;
  knows: boolean;
} {
  // Self-consistency: both wordings must clear the bar, not their mean.
  const both = (a: unknown, b: unknown) => Math.min(noul(a), noul(b)) >= GUARD_THRESHOLD;
  let cleared = both(decision?.answers.guard_a, decision?.answers.guard_b);
  let knows = both(decision?.answers.culprit_a, decision?.answers.culprit_b);
  if (decision?.source === "fallback") {
    // No judge: code's own credences stand in, so the quest can still end.
    const accusation = beliefIn(g.world, MARA, C_ACCUSATION.id)?.credence ?? 0;
    knows = (beliefIn(g.world, MARA, C_ODO_TOOK.id)?.credence ?? 0) >= 0.7;
    cleared = accusation <= 0.3 || knows;
  }
  // One ledger, one taker: being satisfied that Odo took it entails no longer believing
  // the stranger did. The judge does not enforce that between two questions (a live run
  // gave 0.67 and 0.72 for the culprit beside 0.47 and 0.51 for the guard), so code does.
  return { cleared: cleared || knows, knows };
}

/** Cancels the debts a settled quest has no more use for, and tells or promises to tell the stranger. */
function afterVerdict(g: Game, quest: string | undefined, to: string, id: LogId): void {
  g.retire(MARA, C_ACCUSATION.id, id);
  g.nudge(MARA, { suspicion: -0.3, trust: 0.3 }, id);
  g.nudge(MARA, { suspicion: -0.3, trust: 0.2 }, id);
  if (quest !== "suspected" || to !== "cleared") return;
  if (g.maraIsHere()) {
    g.intent(MARA, PLAYER, "promise", { kind: "request", id: "cleared" }, 3, id);
    return;
  }
  g.commit(
    {
      kind: "create_debt",
      debt: {
        id: `mara_owns_up_${id}`,
        cause: id,
        stakeholder: MARA,
        kind: "report",
        magnitude: 3,
        fuse: { due: g.world.clock, expires: g.world.clock + 120 },
        status: "pending",
        data: { to: PLAYER, say: "cleared" },
      },
    },
    id,
  );
}

export async function checkGuards(g: Game, cause: LogId): Promise<void> {
  const quest = g.world.machines.quest?.node;
  const slice = compileSlice(guardSlice, { world: g.world });
  if (!shouldAskGuard(g, quest, slice)) return;

  const stimulus = g.store.append(
    { kind: "stimulus", what: "guard", data: { slice: slice.hash } },
    cause,
  );
  const decision = await g.decide(
    slice,
    {
      guard_a: questGuard(GUARD, 0),
      guard_b: questGuard(GUARD, 1),
      culprit_a: questGuard(CULPRIT, 0),
      culprit_b: questGuard(CULPRIT, 1),
    },
    [{ kind: "alive", actor: MARA }],
    stimulus,
  );
  if (!decision) return;
  const { cleared, knows } = guardVerdict(g, decision);
  if (!cleared) return;
  const to = knows ? "resolved" : "cleared";
  if (to === quest) return;
  const id = g.commit(
    { kind: "set_node", target: { type: "machine", id: "quest" }, to },
    decision.id,
  );
  afterVerdict(g, quest, to, id);
}
