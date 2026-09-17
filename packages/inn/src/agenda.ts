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
  pickAction,
  pickDistortion,
  pickSpeechAct,
  questGuard,
  stakeInClaim,
} from "@rpg-jev/jev";
import {
  C_ACCUSATION,
  C_APRON,
  C_ODO_TOOK,
  C_TOBIN_SAW,
  IMPLICATES,
  MARA,
  NPCS,
  ODO,
  PLAYER,
  RETELLING_HABIT,
  TOBIN,
  TRUST,
  WRONGDOING,
} from "./content.ts";
import type { Game } from "./game.ts";
import { guardSlice, rankedBeliefs, sceneSlice, standing, trustIn } from "./slices.ts";
import { afterSpeech, guarded } from "./talk.ts";
import { cap, claimClause, nameOf, whenFor } from "./words.ts";

/** Minutes before the same two people trade tales again, in either direction. */
const GOSSIP_COOLDOWN = 35;

export async function runAgenda(g: Game, cause: LogId): Promise<void> {
  for (const debt of expiredDebts(g.world))
    g.commit({ kind: "settle_debt", id: debt.id, status: "cancelled" }, debt.cause ?? cause);
  for (const debt of dueDebts(g.world)) {
    if (g.ending()) return;
    await fire(g, debt, debt.cause ?? cause);
  }
  await meetings(g, cause);
}

// --- Gossip -------------------------------------------------------------------

/** When two NPCs share a room and have not talked lately, a tale may pass between them. */
async function meetings(g: Game, cause: LogId): Promise<void> {
  for (const [i, first] of NPCS.entries())
    for (const second of NPCS.slice(i + 1)) {
      const a = g.world.actors[first];
      const b = g.world.actors[second];
      if (!a?.alive || !b?.alive || !a.present || !b.present || a.room !== b.room) continue;
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
    // 0.73 with "afraid of Odo" as a trait), which would end the night by eight. His
    // silence is therefore a rule tied to his debt; paying the debt lifts it. He can
    // still be asked, and his conscience still comes due.
    if (guarded(g, teller, c)) return false;
    // Nor that something was done at their own asking.
    if (c.motive === "was_asked" && listener === MARA) return false;
    const source = b.edge.source;
    if (source && "from" in source && source.from === listener) return false;
    const known = rankedBeliefs(g.world, listener).some(
      (k) =>
        k.claim.id === c.id ||
        (sameMatter(k.claim, c) && k.claim.subject === c.subject && k.claim.severity >= c.severity),
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
  const tie =
    other === MARA
      ? "their employer"
      : from === MARA
        ? "who works for her"
        : "who works alongside them";
  return `${name}, ${tie}, ${standing(g.world, from, other)}${about}`;
}

// --- Debts coming due -----------------------------------------------------------

const settle = (g: Game, debt: Debt, cause: LogId, status: "fired" | "cancelled" = "fired") =>
  g.commit({ kind: "settle_debt", id: debt.id, status }, cause);

const cancel = (g: Game, debt: Debt, cause: LogId): void => {
  settle(g, debt, cause, "cancelled");
};

function goTo(
  g: Game,
  npc: string,
  room: string,
  activity: string,
  minutes: number,
  cause: LogId,
): void {
  g.commit(
    {
      kind: "add_commitment",
      npc,
      entry: {
        id: `${activity}_${cause}`,
        activity,
        at_location: room,
        at: g.world.clock,
        until: g.world.clock + minutes,
        cause: null,
      },
    },
    cause,
  );
  g.runSchedules(cause);
}

/** Ask one NPC to choose among feasible acts. `none_of_these` and outages fall to `fallback`. */
async function choose(
  g: Game,
  npc: string,
  situation: string,
  options: Option[],
  fallback: string,
  cause: LogId,
) {
  const slice = compileSlice(sceneSlice, {
    world: g.world,
    parts: [{ npc, extra: { situation } }],
  });
  const decision = await g.decide(
    slice,
    { act: pickAction(`npcs.${npc}`, options, fallback) },
    [{ kind: "alive", actor: npc }],
    cause,
  );
  if (!decision) return { choice: null, id: cause };
  const choice = g.sampleChoice(decision.answers.act, `${npc} acts`, decision.id);
  return { choice: options.some((o) => o.id === choice) ? choice : fallback, id: decision.id };
}

const ledgerIn = (g: Game, container: string) => {
  const at = g.world.items.ledger?.at;
  return Boolean(at && "inside" in at && at.inside === container);
};

async function fire(g: Game, debt: Debt, cause: LogId): Promise<void> {
  const who = g.world.actors[debt.stakeholder];
  if (!who?.alive || !who.present) {
    settle(g, debt, cause, "cancelled");
    return;
  }
  const quest = g.world.machines.quest?.node;
  const playerHere = (room: string) => g.playerRoom === room;
  switch (debt.kind) {
    case "check_hiding_place":
    case "burn_ledger": {
      const burning = debt.kind === "burn_ledger";
      if (ledgerIn(g, "barrel")) {
        if (!burning) {
          goTo(g, ODO, "cellar", "checking_cellar", 6, cause);
          settle(g, debt, cause);
          return;
        }
        const watched = playerHere("cellar") || playerHere("kitchen");
        const { choice, id } = await choose(
          g,
          ODO,
          `The house is quiet. The ledger is still buried in the flour barrel. ${watched ? "The stranger is close by and would see what Odo does." : "Nobody is near the kitchen or the cellar."}`,
          [
            {
              id: "burn_it",
              description: watched
                ? "Fetches the ledger and burns it in the kitchen hearth even though the stranger would see"
                : "Fetches the ledger and burns it in the kitchen hearth",
            },
            { id: "leave_it", description: "Leaves the ledger where it is for now" },
          ],
          "burn_it",
          cause,
        );
        if (choice === "burn_it") {
          const burned = g.commit({ kind: "transfer", item: "ledger", to: { room: "ashes" } }, id);
          const apron = g.world.items.apron?.at;
          if (apron && "inside" in apron)
            g.commit({ kind: "transfer", item: "apron", to: { room: "ashes" } }, burned);
          g.commit(
            { kind: "set_node", target: { type: "machine", id: "ledger_fate" }, to: "burned" },
            burned,
          );
          goTo(g, ODO, "kitchen", "burning", 10, burned);
          if (watched) {
            g.say(
              "Odo comes up from the cellar with a floury bundle, glances at you, and feeds it to the hearth anyway. Pages curl. It is the ledger.",
            );
            const deed = g.happened(
              {
                subject: ODO,
                predicate: "burned",
                object: "ledger",
                place: "kitchen",
                severity: 3,
              },
              burned,
            );
            g.learn(PLAYER, deed, 1, { kind: "witnessed" }, burned);
          }
        }
        settle(g, debt, id);
        return;
      }
      if (
        g.world.machines.ledger_fate?.node === "burned" ||
        g.log.some((e) => e.kind === "stimulus" && e.what === "odo_found_it_gone")
      ) {
        settle(g, debt, cause, "cancelled");
        return;
      }
      // The hiding place is empty. What Odo does next is his to choose.
      goTo(g, ODO, "cellar", "checking_cellar", 4, cause);
      const stimulus = g.store.append(
        { kind: "stimulus", what: "odo_found_it_gone", data: {} },
        cause,
      );
      const { choice, id } = await choose(
        g,
        ODO,
        "Odo has just dug through the flour barrel and the ledger is gone. Someone has found it. Mara is somewhere in the house.",
        [
          {
            id: "accuse_louder",
            description:
              "Goes to Mara and insists the stranger has the ledger and must be searched at once",
          },
          {
            id: "flee",
            description: "Takes his coat and slips out into the rain, abandoning the inn",
          },
          { id: "confess", description: "Goes to Mara and admits what he did" },
          {
            id: "carry_on",
            description: "Goes back to his pots and acts as if nothing has happened",
          },
        ],
        "carry_on",
        stimulus,
      );
      if (choice === "accuse_louder" && g.world.machines.ledger_fate?.node === "returned") {
        // The ledger is already back under Mara's hand, and nobody has told Odo. By
        // insisting the stranger has it, he shows that he knew where it was not.
        goTo(g, ODO, g.world.actors[MARA]?.room ?? "common_room", "reporting", 8, id);
        const slip = g.happened({ subject: ODO, predicate: "slipped", to: MARA, severity: 3 }, id);
        g.learn(MARA, slip, 1, { kind: "witnessed" }, id);
        if (g.maraIsHere()) {
          g.say(
            "Odo comes through at a trot, red in the face. \"Search that one's pack, Mara, now. They have your ledger, I'd stake my life on it.\"",
          );
          g.say(
            "Mara does not look at you. She looks at Odo, and then down at the ledger under her own hand, which nobody has told him about.",
          );
          g.learn(PLAYER, slip, 1, { kind: "witnessed" }, id);
        }
      } else if (choice === "accuse_louder") {
        const search = g.world.debts.mara_search;
        if (search?.status === "pending")
          g.commit({ kind: "settle_debt", id: search.id, status: "cancelled" }, id);
        if (quest === "suspected")
          g.commit(
            {
              kind: "create_debt",
              debt: {
                id: `mara_search_${id}`,
                cause: id,
                stakeholder: MARA,
                kind: "search_pack",
                magnitude: 3,
                fuse: { due: g.world.clock + 4 },
                status: "pending",
                data: { urged_by: ODO },
              },
            },
            id,
          );
        if (playerHere(g.world.actors[MARA]?.room ?? ""))
          g.say(
            "Odo comes through at a trot, red in the face, and says something low and urgent in Mara's ear. She looks straight at you.",
          );
      } else if (choice === "flee") {
        if (playerHere(g.world.actors[ODO]?.room ?? ""))
          g.say(
            "Odo takes his coat off its peg, looks once round the kitchen, and goes out into the rain without a word.",
          );
        const gone = g.commit({ kind: "retire", actor: ODO }, id);
        const deed = g.happened({ subject: ODO, predicate: "fled", severity: 3 }, gone);
        for (const npc of [MARA, TOBIN]) g.learn(npc, deed, 1, { kind: "witnessed" }, gone);
        g.learn(PLAYER, deed, 0.9, { kind: "witnessed" }, gone);
        g.say("Somewhere at the back of the house a door bangs, and does not bang again.");
      } else if (choice === "confess") {
        goTo(g, ODO, g.world.actors[MARA]?.room ?? "common_room", "reporting", 10, id);
        g.learn(MARA, C_ODO_TOOK, 1, { kind: "told", from: ODO }, id);
        if (g.maraIsHere())
          g.say(
            "Odo comes in wiping his hands, stands in front of Mara, and says it all at once: he took the ledger, he took it to hide two years of skimming, and he is sorry. Mara does not move for a long moment.",
          );
      }
      settle(g, debt, id);
      return;
    }
    case "search_pack": {
      if (quest !== "suspected") return cancel(g, debt, cause);
      const { choice, id } = await choose(
        g,
        MARA,
        `It is getting late and the ledger is still missing. ${debt.data.urged_by ? "Odo has just urged her to search the stranger at once." : ""} The stranger is in ${g.world.rooms[g.playerRoom]?.name}.`,
        [
          {
            id: "search_pack",
            description: "Goes to the stranger and demands they turn out their pack",
          },
          { id: "let_it_lie", description: "Lets the stranger be for now" },
        ],
        "search_pack",
        cause,
      );
      settle(g, debt, id);
      if (choice !== "search_pack") return;
      goTo(g, MARA, g.playerRoom, "searching_pack", 8, id);
      const turn = g.intent(
        MARA,
        PLAYER,
        "request",
        { kind: "request", id: "turn_out_pack" },
        3,
        id,
      );
      g.speak((t, sid) => afterSpeech(g, t, sid));
      const at = g.world.items.ledger?.at;
      const caught = Boolean(at && "holder" in at && at.holder === PLAYER);
      if (caught) {
        const took = g.commit(
          { kind: "transfer", item: "ledger", to: { holder: MARA } },
          turn.cause,
        );
        g.commit(
          { kind: "set_node", target: { type: "machine", id: "ledger_fate" }, to: "returned" },
          took,
        );
        g.say(
          "There is no hiding a ledger. She lifts it out of your pack with both hands, and her face closes like a door.",
        );
        g.witness(
          g.happened(
            { subject: PLAYER, predicate: "had_in_pack", object: "ledger", severity: 3 },
            took,
          ),
          g.playerRoom,
          took,
        );
      } else {
        g.say(
          "You turn out your pack on the nearest table: a spare shirt, a heel of bread, a whetstone. She goes through it twice, and finds nothing of hers.",
        );
        g.witness(
          g.happened({ subject: PLAYER, predicate: "pack_was_clean" }, id),
          g.playerRoom,
          id,
        );
      }
      return;
    }
    case "conscience": {
      const knows = beliefIn(g.world, TOBIN, C_TOBIN_SAW.id);
      const told = beliefIn(g.world, MARA, C_TOBIN_SAW.id);
      if (!knows || told || quest !== "suspected") return cancel(g, debt, cause);
      const { choice, id } = await choose(
        g,
        TOBIN,
        "It is late. Tobin has kept what he saw at dusk to himself all evening, and Mara still blames the stranger. He could speak now, or let the night run out.",
        [
          { id: "tell_mara", description: "Goes to Mara and tells her what he saw Odo do at dusk" },
          {
            id: "tell_stranger",
            description: "Finds the stranger and quietly tells them what he saw",
          },
          { id: "keep_quiet", description: "Says nothing to anyone" },
        ],
        "keep_quiet",
        cause,
      );
      settle(g, debt, id);
      const to = choice === "tell_mara" ? MARA : choice === "tell_stranger" ? PLAYER : null;
      if (to)
        g.commit(
          {
            kind: "create_debt",
            debt: {
              id: `testify_${id}`,
              cause: id,
              stakeholder: TOBIN,
              kind: "testify",
              magnitude: 3,
              fuse: { due: g.world.clock, expires: g.world.clock + 90 },
              status: "pending",
              data: { to },
            },
          },
          id,
        );
      return;
    }
    case "verdict": {
      if (quest !== "suspected") return cancel(g, debt, cause);
      const { choice, id } = await choose(
        g,
        MARA,
        "It is close to midnight. The ledger has not been cleared up to her satisfaction and she still holds the stranger responsible. The assessor comes at first light.",
        [
          {
            id: "send_for_constable",
            description: "Sends Tobin for the constable and holds the stranger until he comes",
          },
          { id: "turn_out", description: "Turns the stranger out into the rain and bars the door" },
          { id: "let_it_lie", description: "Does nothing tonight" },
        ],
        "turn_out",
        cause,
      );
      settle(g, debt, id);
      const to =
        choice === "send_for_constable" ? "condemned" : choice === "turn_out" ? "thrown_out" : null;
      if (to) g.commit({ kind: "set_node", target: { type: "machine", id: "quest" }, to }, id);
      return;
    }
    case "eject": {
      // She cannot act on a fight she has not seen or been told of. The debt stays
      // pending until the tale reaches her, which is what makes it a consequence.
      const knows = rankedBeliefs(g.world, MARA).some(
        (b) => b.claim.subject === PLAYER && b.claim.predicate === "attacked" && b.credence >= 0.4,
      );
      if (!knows) return;
      const { choice, id } = await choose(
        g,
        MARA,
        "The stranger has used their fists on someone under her roof tonight.",
        [
          { id: "throw_out", description: "Has the stranger thrown out into the rain at once" },
          { id: "warn", description: "Tells the stranger that one more blow and they are out" },
        ],
        "throw_out",
        cause,
      );
      settle(g, debt, id);
      if (choice === "throw_out")
        g.commit(
          { kind: "set_node", target: { type: "machine", id: "quest" }, to: "thrown_out" },
          id,
        );
      else if (g.maraIsHere()) g.intent(MARA, PLAYER, "threaten", { kind: "none" }, 3, id);
      return;
    }
    case "report":
    case "retaliate":
    case "testify":
      return carryTale(g, debt, cause);
    case "confront":
      return confront(g, debt, cause);
    case "search_cellar": {
      // She was told something went down to the cellar, so she goes to look. What she
      // finds there she sees for herself, and no judge is needed for that.
      goTo(g, MARA, "cellar", "searching_cellar", 8, cause);
      settle(g, debt, cause);
      const near = playerHere("cellar") || playerHere("kitchen");
      if (!ledgerIn(g, "barrel")) {
        if (near)
          g.say(
            "Mara takes the lantern down the cellar steps. You hear the lid of the flour barrel, a long silence, and the lid again.",
          );
        return;
      }
      if (g.world.machines.barrel_search?.node === "unsearched")
        g.commit(
          { kind: "set_node", target: { type: "machine", id: "barrel_search" }, to: "searched" },
          cause,
        );
      const fate = { type: "machine", id: "ledger_fate" } as const;
      const found = g.commit({ kind: "set_node", target: fate, to: "found" }, cause);
      g.commit({ kind: "set_node", target: fate, to: "returned" }, found);
      for (const item of ["ledger", "apron"])
        if (g.world.items[item]?.at && "inside" in (g.world.items[item]?.at ?? {}))
          g.commit({ kind: "transfer", item, to: { holder: MARA } }, found);
      const deed = g.happened(
        { subject: MARA, predicate: "found", object: "ledger", place: "cellar", severity: 2 },
        found,
      );
      g.learn(MARA, deed, 1, { kind: "witnessed" }, found);
      g.learn(MARA, C_APRON, 1, { kind: "witnessed" }, found);
      if (near)
        g.say(
          "Mara takes the lantern down the cellar steps. You hear the lid of the flour barrel come off, and then nothing for a long time. When she comes up she is floured to the elbow, with the ledger in one hand and a cook's apron in the other.",
        );
      return;
    }
    default:
      settle(g, debt, cause, "cancelled");
  }
}

/** Someone owes someone else a tale. They walk over if it matters enough, and tell it on arrival. */
async function carryTale(g: Game, debt: Debt, cause: LogId): Promise<void> {
  const teller = debt.stakeholder;
  const to = debt.data.to ?? MARA;
  const here = g.world.actors[teller]?.room;
  const there = g.world.actors[to]?.room;
  if (!there || !here) return cancel(g, debt, cause);
  if (here !== there) {
    const walking = g.world.schedules[teller]?.commitments.some(
      (c) => c.id.startsWith("reporting") && c.until > g.world.clock,
    );
    if (debt.magnitude >= 2 && !walking)
      goTo(g, teller, there, debt.kind === "testify" ? "testifying" : "reporting", 8, cause);
    if (g.world.actors[teller]?.room !== there) return;
  }
  const wanted = debt.data.claim ? beliefIn(g.world, teller, debt.data.claim) : undefined;
  const tale =
    debt.kind === "testify"
      ? beliefIn(g.world, teller, C_TOBIN_SAW.id)
      : debt.kind === "retaliate"
        ? rankedBeliefs(g.world, teller).find(
            (b) =>
              b.claim.subject === PLAYER &&
              WRONGDOING.includes(b.claim.predicate) &&
              !beliefIn(g.world, to, b.claim.id),
          )
        : wanted;
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
  if (beliefIn(g.world, to, tale.claim.id)) return;
  await gossip(g, teller, to, tale, cause);
}

/** Mara said she would have it out with someone. Now she does, and what they say back is theirs to choose. */
async function confront(g: Game, debt: Debt, cause: LogId): Promise<void> {
  const target = debt.data.to ?? ODO;
  const there = g.world.actors[target]?.room;
  if (!there || !g.world.actors[target]?.present) return cancel(g, debt, cause);
  if (g.world.actors[MARA]?.room !== there) {
    goTo(g, MARA, there, "confronting", 8, cause);
    if (g.world.actors[MARA]?.room !== there) return;
  }
  settle(g, debt, cause);
  const own = beliefIn(g.world, target, C_ODO_TOOK.id);
  const lie = rankedBeliefs(g.world, target).find(
    (b) => b.claim.subject === PLAYER && WRONGDOING.includes(b.claim.predicate),
  );
  const options: Option[] = [
    {
      id: "accuse_stranger",
      description:
        "Turns it around: says the stranger is the thief and is trying to shift the blame",
    },
    { id: "refuse", description: "Laughs it off and says he will not dignify it with an answer" },
    ...(own ? [{ id: "confess", description: "Admits to Mara that he took the ledger" }] : []),
  ];
  const hears = {
    said_by: "Mara, his employer",
    what: "Mara asks him to his face what he carried down to the cellar at dusk, and whether he took her ledger",
    in_front_of: g.playerRoom === there ? "the stranger" : "nobody else",
  };
  const decision = await g.decide(
    compileSlice(sceneSlice, { world: g.world, parts: [{ npc: target, extra: { hears } }] }),
    { reply: pickSpeechAct({ npc: `npcs.${target}`, options, fallback: "accuse_stranger" }) },
    [{ kind: "in_room", actor: target, room: there }],
    cause,
  );
  if (!decision) return;
  const reply = g.sampleChoice(decision.answers.reply, `${target} answers Mara`, decision.id);
  const audible = g.playerRoom === there;
  if (audible)
    g.say(
      `Mara plants herself in front of ${nameOf(g.world, target)}. "What did you carry down to my cellar at dusk?"`,
    );
  if (reply === "confess" && own) {
    g.learn(MARA, own.claim, 1, { kind: "told", from: target }, decision.id);
    if (audible)
      g.say(
        `${nameOf(g.world, target)} opens his mouth, shuts it, and then it all comes out: the skimming, the gamblers, the ledger in the flour.`,
      );
  } else {
    // She asked what he carried; he answered a different question. That is what she saw.
    const deed = g.happened(
      { subject: target, predicate: "dodged", to: MARA, severity: 2 },
      decision.id,
    );
    g.learn(MARA, deed, 1, { kind: "witnessed" }, decision.id);
    if (audible && lie)
      g.intent(target, MARA, "tell", { kind: "claim", id: lie.claim.id }, 3, decision.id);
    else if (audible) g.say(`${nameOf(g.world, target)} laughs, a little too long.`);
  }
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
export async function checkGuards(g: Game, cause: LogId): Promise<void> {
  const quest = g.world.machines.quest?.node;
  if (quest !== "suspected" && quest !== "cleared") return;
  if (!g.world.actors[MARA]?.alive) return;
  const slice = compileSlice(guardSlice, { world: g.world });
  const asked = g.log.findLast((e) => e.kind === "stimulus" && e.what === "guard");
  if (asked?.kind === "stimulus" && asked.data.slice === slice.hash) return;
  const tonight = (slice.state.npcs as { mara: { recent_events: string[] } }).mara.recent_events;
  if (tonight.length === 0) return;
  // A hard precondition, checked in code: with nothing at all pointing away from the
  // stranger there is nothing for the judge to weigh, so it is not asked.
  if (!groundsForDoubt(g)) return;

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
  // Self-consistency: both wordings must clear the bar, not their mean.
  const both = (a: unknown, b: unknown) => Math.min(noul(a), noul(b)) >= GUARD_THRESHOLD;
  let cleared = both(decision.answers.guard_a, decision.answers.guard_b);
  let knows = both(decision.answers.culprit_a, decision.answers.culprit_b);
  if (decision.source === "fallback") {
    // No judge: code's own credences stand in, so the quest can still end.
    const accusation = beliefIn(g.world, MARA, C_ACCUSATION.id)?.credence ?? 0;
    knows = (beliefIn(g.world, MARA, C_ODO_TOOK.id)?.credence ?? 0) >= 0.7;
    cleared = accusation <= 0.3 || knows;
  }
  if (!cleared) return;
  const to = knows ? "resolved" : "cleared";
  if (to === quest) return;
  const id = g.commit(
    { kind: "set_node", target: { type: "machine", id: "quest" }, to },
    decision.id,
  );
  g.retire(MARA, C_ACCUSATION.id, id);
  g.nudge(MARA, { suspicion: -0.3, trust: 0.3 }, id);
  g.nudge(MARA, { suspicion: -0.3, trust: 0.2 }, id);
  for (const d of Object.values(g.world.debts))
    if (
      d.status === "pending" &&
      d.stakeholder === MARA &&
      (d.kind === "search_pack" || d.kind === "verdict")
    )
      g.commit({ kind: "settle_debt", id: d.id, status: "cancelled" }, id);
  if (quest === "suspected" && to === "cleared") {
    if (g.maraIsHere())
      g.intent(MARA, PLAYER, "promise", { kind: "request", id: "cleared" }, 3, id);
    else
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
}
