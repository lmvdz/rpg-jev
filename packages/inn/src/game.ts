/**
 * The game core: one player action in, prose out. It owns the Store, asks the
 * judge through `decide`, and commits only validated effects. Decisions are
 * made on a snapshot and re-checked against preconditions before anything is
 * committed (SPEC.md section 4). Nothing in this package writes world state
 * except through `Store.commit`.
 */
import {
  type BeliefSource,
  beliefIn,
  beliefsOf,
  type Claim,
  type Debt,
  type Effect,
  failedPreconditions,
  type JudgeAnswer,
  type LogEntry,
  type LogId,
  locate,
  makeClaim,
  type Precondition,
  planBeat,
  pruneUnlikely,
  Rng,
  replay,
  type SpeechIntent,
  Store,
  sampleNoul,
  stanceOf,
  type Turn,
  type World,
} from "@rpg-jev/core";
import { type Asked, buildRequest, type Judge, type Slice } from "@rpg-jev/jev";
import { performAction } from "./actions.ts";
import { checkGuards, runAgenda } from "./agenda.ts";
import {
  BUSY_ACTIVITIES,
  C_ACCUSATION,
  C_TOBIN_OWES,
  CONTENT_VERSION,
  IMPLICATES,
  initialWorld,
  MARA,
  MIDNIGHT,
  NEED_RATES,
  NPCS,
  PLAYER,
  WRONGDOING,
} from "./content.ts";
import { type Action, type Matched, match, resolveAnswer } from "./parser.ts";
import { arrival, departure, describeRoom, ENDINGS, INTRO, renderTurn } from "./prose.ts";
import { trustIn } from "./slices.ts";
import { afterSpeech, judgeParse, npcArrives } from "./talk.ts";
import { nameOf } from "./words.ts";

/** What a front end may show while the judge is being asked. */
export interface Thinking {
  /** Names of the people in the player's room whose minds are being consulted. */
  who: string[];
  about: "the_player" | "here" | "elsewhere";
}

export interface Decision {
  answers: Record<string, JudgeAnswer>;
  id: LogId;
  source: "jev" | "cache" | "fallback";
}

export class Game {
  readonly store: Store;
  readonly judge: Judge;
  /** Lines produced by the turn in progress. */
  out: string[] = [];
  /** Speech intents raised this beat, waiting for the scheduler. */
  fresh: SpeechIntent[] = [];
  over = false;
  /** Debug hook: sees every slice sent to the judge and what came back. */
  trace: ((slice: Slice, answers: Record<string, JudgeAnswer>) => void) | null = null;
  /**
   * Presentation hooks for a live front end. Nothing here is logged or read back, so a
   * replay and a test behave the same with or without them.
   */
  onLine: ((line: string, speaker: string | null) => void) | null = null;
  onThinking: ((thinking: Thinking | null) => void) | null = null;
  /** The beat at which the player last spoke to each NPC. Someone spoken to stays to listen. */
  addressed: Record<string, number> = {};
  /** NPCs who walked in on the player during this step. Arriving is a stimulus. */
  arrived: string[] = [];
  #pending: Extract<Matched, { kind: "clarify" }> | null = null;
  #speechCount = 0;

  private constructor(store: Store, judge: Judge) {
    this.store = store;
    this.judge = judge;
  }

  static start(seed: number, judge: Judge): Game {
    const game = new Game(new Store(initialWorld(seed)), judge);
    game.store.append({ kind: "init", seed, content: CONTENT_VERSION }, null);
    return game;
  }

  /** The log is the save: rebuild the world from it without asking the judge anything. */
  static resume(log: LogEntry[], judge: Judge): Game {
    const init = log[0];
    if (init?.kind !== "init") throw new Error("a saved log starts with an init entry");
    if (init.content !== CONTENT_VERSION)
      throw new Error(`save is for ${init.content}, this build is ${CONTENT_VERSION}`);
    const game = new Game(new Store(replay(initialWorld(init.seed), log), log), judge);
    game.#speechCount = log.filter((e) => e.kind === "effect" && e.effect.kind === "say").length;
    game.over = game.ending() !== null;
    return game;
  }

  get world(): World {
    return this.store.world;
  }

  get log(): LogEntry[] {
    return this.store.log;
  }

  get playerRoom(): string {
    return this.world.actors[PLAYER]?.room ?? "";
  }

  intro(): string[] {
    return [INTRO, "", describeRoom(this.world)];
  }

  say(line: string, speaker: string | null = null): void {
    if (line === "") return;
    this.out.push(line);
    this.onLine?.(line, speaker);
  }

  npcsIn(room: string): string[] {
    return NPCS.filter((id) => {
      const a = this.world.actors[id];
      return a?.alive && a.present && a.room === room;
    });
  }

  commit(effect: Effect, cause: LogId | null): LogId {
    return this.store.commit(effect, cause);
  }

  // --- The judge --------------------------------------------------------------

  /**
   * Ask on a snapshot, log the full answer, then re-check the preconditions.
   * A decision whose world moved on underneath it is dropped, never applied.
   */
  async decide(
    slice: Slice,
    questions: Record<string, Asked>,
    preconditions: readonly Precondition[],
    cause: LogId,
  ): Promise<Decision | null> {
    const request = buildRequest(slice.state, slice.hash, questions);
    this.onThinking?.(this.thinkers(slice));
    const response = await this.judge.ask(request).finally(() => this.onThinking?.(null));
    this.trace?.(slice, response.answers);
    const id = this.store.append(
      {
        kind: "decision",
        requestId: request.id,
        sliceHash: slice.hash,
        source: response.source,
        answers: response.answers,
        inputTokens: response.inputTokens,
        latencyMs: response.latencyMs,
      },
      cause,
    );
    const failed = failedPreconditions(this.world, preconditions);
    if (failed.length > 0) {
      this.store.append({ kind: "dropped", what: request.id, reasons: failed }, id);
      return null;
    }
    return { answers: response.answers, id, source: response.source };
  }

  /**
   * Whose mind a slice consults, as far as the player could tell by looking: people in the
   * room are named, people elsewhere are not. A slice with nobody in it is the game reading
   * what the player typed.
   */
  private thinkers(slice: Slice): Thinking {
    const minds = Object.keys((slice.state as { npcs?: Record<string, unknown> }).npcs ?? {});
    const here = minds.filter((id) => this.world.actors[id]?.room === this.playerRoom);
    return {
      who: here.map((id) => nameOf(this.world, id)),
      about: minds.length === 0 ? "the_player" : here.length > 0 ? "here" : "elsewhere",
    };
  }

  /** Sample a Choice with a logged draw. Options under 0.10 are dropped; nothing is sharpened. */
  sampleChoice(answer: JudgeAnswer | undefined, purpose: string, cause: LogId): string | null {
    if (answer?.type !== "choice") return null;
    const draw = this.store.draw(purpose, cause);
    return Rng.pick(pruneUnlikely(answer.probabilities), draw);
  }

  sampleYes(answer: JudgeAnswer | undefined, purpose: string, cause: LogId): boolean {
    if (answer?.type !== "noul") return false;
    return sampleNoul(answer.noul, this.store.draw(purpose, cause));
  }

  // --- Beliefs ----------------------------------------------------------------

  /** Code owns credence: the judge says yes or no, this table says how sure that makes them. */
  credenceFor(source: BeliefSource, believed: boolean): number {
    if (!believed) return 0.2;
    if (source.kind === "witnessed") return 1;
    if (source.kind === "shown") return 0.9;
    return source.kind === "told" ? 0.75 : 0.6;
  }

  /** Store or strengthen a belief, then let code-owned consequences follow. */
  learn(holder: string, claim: Claim, credence: number, source: BeliefSource, cause: LogId): void {
    const held = beliefIn(this.world, holder, claim.id);
    if (held) {
      if (credence > held.credence)
        this.commit({ kind: "update_credence", holder, claim: claim.id, credence }, cause);
    } else this.commit({ kind: "add_claim", holder, claim, credence, source }, cause);
    if (holder !== PLAYER && credence >= 0.6)
      this.afterBelief(holder, claim, credence, source, cause);
    // Checking costs less than believing. A cautious woman who only half credits a
    // trusted first-hand report still goes to look where it points.
    else if (source.kind === "told" && trustIn(this.world, holder, source.from) >= 0.8)
      this.maraActsOn(holder, claim, cause, true);
  }

  /** Everyone in the room stores what they saw (SPEC.md section 9, step 1). */
  witness(claim: Claim, room: string, cause: LogId, except: string[] = []): string[] {
    const seen = this.npcsIn(room).filter((id) => !except.includes(id));
    for (const id of seen) this.learn(id, claim, 1, { kind: "witnessed" }, cause);
    return seen;
  }

  retire(holder: string, claimId: string, cause: LogId): void {
    const held = beliefIn(this.world, holder, claimId);
    if (held && held.credence > 0)
      this.commit({ kind: "update_credence", holder, claim: claimId, credence: 0 }, cause);
  }

  /** Arithmetic on beliefs and drives lives here, not in the judge (SPEC.md rule 3). */
  private afterBelief(
    holder: string,
    claim: Claim,
    credence: number,
    source: BeliefSource,
    cause: LogId,
  ): void {
    // "Who told me this? The man I now suspect." What the holder has only on the word
    // of someone implicated loses two fifths of its weight each time that happens: one
    // piece of evidence leaves her in two minds, a second leaves her doubting.
    if (claim.subject !== PLAYER && IMPLICATES.includes(claim.predicate))
      for (const b of beliefsOf(this.world, holder)) {
        const source = b.edge.source;
        if (source?.kind !== "told" || source.from !== claim.subject || b.credence <= 0.2) continue;
        const less = Math.round(b.credence * 60) / 100;
        this.commit({ kind: "update_credence", holder, claim: b.claim.id, credence: less }, cause);
      }

    // The mirror of discrediting: a second thing pointing at the same person lends weight
    // to a first that was doubted. One unlucky draw against a trusted witness should not
    // close a route for the night.
    if (claim.subject !== PLAYER && IMPLICATES.includes(claim.predicate))
      for (const b of beliefsOf(this.world, holder)) {
        const same = b.claim.subject === claim.subject && b.claim.id !== claim.id;
        if (!same || !IMPLICATES.includes(b.claim.predicate) || b.credence >= 0.6) continue;
        if (b.credence <= 0) continue;
        const more = Math.min(0.75, Math.round((b.credence + 0.3) * 100) / 100);
        this.commit({ kind: "update_credence", holder, claim: b.claim.id, credence: more }, cause);
        if (more >= 0.6) this.maraActsOn(holder, b.claim, cause);
      }

    this.maraActsOn(holder, claim, cause);

    // Someone else did it: the accusation against the stranger loses ground.
    const clears =
      claim.subject !== PLAYER &&
      ["took", "hid", "carried_bundle_to", "burned", "fled"].includes(claim.predicate);
    const accusation = beliefIn(this.world, holder, C_ACCUSATION.id);
    if (clears && accusation && accusation.credence > 1 - credence)
      this.commit(
        {
          kind: "update_credence",
          holder,
          claim: C_ACCUSATION.id,
          credence: Math.round((1 - credence) * 100) / 100,
        },
        cause,
      );

    if (claim.subject !== PLAYER) return;
    // A consequence the player cannot perceive is wasted (SPEC.md section 9). Someone who
    // comes to believe a tale about the stranger owes it to them, to their face, the next
    // time they share a room. Code decides when; the judge still picks what is said.
    const hearsay = source.kind === "told" && source.from !== PLAYER;
    const debtId = `face_${holder}_${claim.id}`;
    if (hearsay && WRONGDOING.includes(claim.predicate) && !this.world.debts[debtId])
      this.commit(
        {
          kind: "create_debt",
          debt: {
            id: debtId,
            cause,
            stakeholder: holder,
            kind: "face_stranger",
            magnitude: claim.severity,
            fuse: { due: this.world.clock, expires: this.world.clock + 120 },
            status: "pending",
            data: { claim: claim.id },
          },
        },
        cause,
      );
    if (claim.predicate === "paid_debt" && claim.to === holder) {
      this.retire(holder, C_TOBIN_OWES.id, cause);
      this.nudge(holder, { obligation: 0.3, trust: 0.25, fear: -0.2 }, cause);
    } else if (claim.predicate === "attacked" || claim.predicate === "threatened") {
      const mine = claim.to === holder;
      this.nudge(holder, { fear: mine ? 0.3 : 0.15, trust: -0.2, suspicion: 0.15 }, cause);
    } else if (WRONGDOING.includes(claim.predicate)) {
      this.nudge(holder, { suspicion: 0.05 * claim.severity, trust: -0.05 }, cause);
    } else if (claim.predicate === "handed_over" || claim.predicate === "pack_was_clean") {
      this.nudge(holder, { trust: 0.1, suspicion: -0.1 }, cause);
    }
  }

  /**
   * Mara wants her ledger, so what she comes to believe she acts on: she goes to look
   * where she is told it went, and she has it out with whoever is implicated. Both are
   * debts with a short fuse, so they land a little later and can be traced with `why`.
   */
  private maraActsOn(holder: string, claim: Claim, cause: LogId, onlyLook = false): void {
    if (holder !== MARA || claim.subject === PLAYER || !IMPLICATES.includes(claim.predicate))
      return;
    const owe = (id: string, kind: string, data: Record<string, string>, minutes: number) => {
      if (this.world.debts[id]) return;
      const due = this.world.clock + minutes;
      const debt: Debt = {
        id,
        cause,
        stakeholder: MARA,
        kind,
        magnitude: 3,
        fuse: { due, expires: due + 120 },
        status: "pending",
        data,
      };
      this.commit({ kind: "create_debt", debt }, cause);
    };
    if (claim.place === "cellar") owe("mara_looks_in_cellar", "search_cellar", {}, 6);
    if (onlyLook) return;
    const who = this.world.actors[claim.subject];
    if (who?.kind === "npc" && who.present && claim.predicate !== "dodged")
      owe(`confront_${claim.subject}`, "confront", { to: claim.subject }, 12);
  }

  nudge(npc: string, deltas: Partial<Record<string, number>>, cause: LogId): void {
    for (const [drive, delta] of Object.entries(deltas)) {
      if (!delta) continue;
      this.commit(
        {
          kind: "shift_drive",
          npc,
          drive: drive as "trust",
          delta: Math.max(-0.3, Math.min(0.3, delta)),
        },
        cause,
      );
    }
    this.restance(npc, cause);
  }

  /** Stance is an FSM node chosen by code from the drives, one legal step at a time. */
  private restance(npc: string, cause: LogId): void {
    const a = this.world.actors[npc];
    const now = stanceOf(this.world, npc, PLAYER);
    if (!a || !now) return;
    const d = a.drives;
    const mood = d.trust - d.suspicion - d.fear * 0.5;
    const want =
      mood < -0.75
        ? "hostile"
        : d.obligation >= 0.5 && mood > -0.5
          ? d.trust >= 0.7
            ? "loyal"
            : "indebted"
          : mood < 0.05
            ? "wary"
            : d.trust >= 0.75
              ? "loyal"
              : "curious";
    if (want === now) return;
    const legal = this.world.def.fsms.stance?.[now] ?? [];
    const order = ["hostile", "wary", "curious", "indebted", "loyal"];
    const toward = order.indexOf(want) > order.indexOf(now) ? 1 : -1;
    const next = legal.includes(want)
      ? want
      : legal.find((n) => Math.sign(order.indexOf(n) - order.indexOf(now)) === toward);
    if (next)
      this.commit(
        { kind: "set_node", target: { type: "stance", npc, toward: PLAYER }, to: next },
        cause,
      );
  }

  /** A claim about something that just happened here. */
  happened(
    content: Omit<Claim, "id" | "origin" | "when" | "severity"> & { severity?: 1 | 2 | 3 },
    origin: LogId,
  ): Claim {
    return makeClaim({ severity: 1, ...content, when: this.world.clock, origin });
  }

  // --- Speech and the scheduler -----------------------------------------------

  intent(
    speaker: string,
    listener: string,
    act: SpeechIntent["act"],
    topic: SpeechIntent["topic"],
    priority: 1 | 2 | 3,
    cause: LogId,
  ): SpeechIntent {
    this.#speechCount += 1;
    const intent: SpeechIntent = {
      id: `s${this.world.conversation.beat}_${this.#speechCount}_${speaker}`,
      speaker,
      listener,
      act,
      topic,
      priority,
      createdBeat: this.world.conversation.beat,
      cause,
    };
    this.fresh.push(intent);
    return intent;
  }

  /**
   * The scheduler decides who speaks now, who waits and who is dropped; this
   * commits its plan and renders the turns the player is there to hear.
   */
  speak(after: (turn: Turn, id: LogId) => void): void {
    const busy = new Set(
      NPCS.filter((id) => BUSY_ACTIVITIES.includes(this.world.actors[id]?.activity ?? "")),
    );
    const plan = planBeat(this.world, this.fresh, { busy });
    const queued = new Set(this.world.conversation.queue.map((q) => q.id));
    for (const { intent, reason } of plan.drop)
      if (queued.has(intent.id))
        this.commit({ kind: "drop_speech", id: intent.id, reason }, intent.cause);
    for (const intent of plan.defer)
      if (!queued.has(intent.id)) this.commit({ kind: "queue_speech", intent }, intent.cause);
    for (const turn of plan.speak) {
      const id = this.commit({ kind: "say", intent: turn.intent }, turn.intent.cause);
      const audible = this.world.actors[turn.intent.speaker]?.room === this.playerRoom;
      if (audible) this.say(renderTurn(this.world, turn), nameOf(this.world, turn.intent.speaker));
      after(turn, id);
    }
    this.fresh = [];
  }

  // --- One player action ------------------------------------------------------

  async turn(text: string): Promise<string[]> {
    this.out = [];
    this.fresh = [];
    if (this.over) {
      this.say("The night is over. Start again to play another.");
      return this.out;
    }

    // "huh" marks the turn before it as one the game got wrong. No rule can spot a line that
    // was understood, but as the wrong thing; only the player can, so give them a word for it.
    const flagged = /^(?:huh\??|wtf|\/flag)(?:\s+(.*))?$/i.exec(text.trim());
    if (flagged) {
      this.store.append(
        {
          kind: "input",
          text: text.slice(0, 240),
          via: "flagged",
          action: { message: flagged[1] ?? "" },
        },
        null,
      );
      this.say("(Noted in the log: that last turn went wrong. Add why if you like: huh <reason>.)");
      return this.out;
    }

    const action = await this.read(text);
    if (action) {
      const root = this.store.append(
        { kind: "input", text: text.slice(0, 240), via: action.via, action: action.action },
        null,
      );
      const minutes = await performAction(this, action.action, root);
      if (minutes > 0) await this.pass(minutes, root);
      const end = this.ending();
      if (end) {
        this.over = true;
        this.say("");
        this.say(end);
      }
    }
    return this.out;
  }

  private async read(text: string): Promise<{ action: Action; via: string } | null> {
    const pending = this.#pending;
    this.#pending = null;
    // "the iron one" answers the question; "ask tobin what he saw" is a new command.
    if (
      pending &&
      match(text, this.world).kind !== "action" &&
      text.trim().split(/\s+/).length <= 5
    ) {
      const answer = resolveAnswer(text, pending.candidates);
      if (answer.kind === "one") return { action: pending.complete(answer.id), via: "clarified" };
    }
    let matched = match(text, this.world);
    if (matched.kind === "unmatched") matched = await judgeParse(this, text);
    if (matched.kind === "action") return { action: matched.action, via: "parsed" };
    if (matched.kind === "clarify") {
      this.#pending = matched;
      this.say(matched.question);
    } else if (matched.kind === "error") this.say(matched.message);
    // What the game could not act on is the most useful thing a playtest leaves behind,
    // so it is logged too. It changes no state; `pnpm friction` reads it back.
    const message = matched.kind === "clarify" ? matched.question : this.out.at(-1);
    this.store.append(
      {
        kind: "input",
        text: text.slice(0, 240),
        via: matched.kind === "clarify" ? "clarify" : "unparsed",
        action: { message: message ?? "" },
      },
      null,
    );
    return null;
  }

  /** Time passes in steps of at most ten minutes, so nothing due is skipped over. */
  async pass(minutes: number, cause: LogId): Promise<void> {
    let left = minutes;
    while (left > 0 && !this.ending()) {
      const step = Math.min(10, left);
      left -= step;
      this.commit({ kind: "advance_clock", minutes: step }, cause);
      this.feelNeeds(step, cause);
      this.runSchedules(cause);
      await runAgenda(this, cause);
      const arrived = this.arrived;
      this.arrived = [];
      if (arrived.length > 0) await npcArrives(this, arrived, cause);
      await checkGuards(this, cause);
      this.speak((turn, id) => afterSpeech(this, turn, id));
    }
  }

  private feelNeeds(minutes: number, cause: LogId): void {
    for (const [npc, rates] of Object.entries(NEED_RATES)) {
      const a = this.world.actors[npc];
      if (!a?.alive) continue;
      const rate = a.activity === "eating" ? rates.eating : rates.hunger;
      const delta = Math.max(-0.3, Math.min(0.3, rate * minutes));
      if (delta !== 0) this.commit({ kind: "shift_need", npc, need: "hunger", delta }, cause);
    }
  }

  /** Execute the schedules: move whoever should be elsewhere, and let people see them go. */
  runSchedules(cause: LogId): void {
    for (const npc of NPCS) {
      const a = this.world.actors[npc];
      if (!a?.alive || !a.present) continue;
      const where = this.locate(npc);
      if (!where || (where.room === a.room && where.activity === a.activity)) continue;
      // The schedule is still a pure function of time; carrying it out can wait a beat.
      // Nobody walks off on a routine errand in the middle of being spoken to.
      const { beat, lastSpokeBeat } = this.world.conversation;
      const lately = Math.max(lastSpokeBeat[npc] ?? -9, this.addressed[npc] ?? -9);
      const talking = a.room === this.playerRoom && beat - lately <= 1;
      if (talking && where.routine) continue;
      const from = a.room;
      if (where.room !== from && from === this.playerRoom)
        this.say(departure(this.world, npc, where.room, where.activity));
      const id = this.commit(
        { kind: "move", actor: npc, to: where.room, activity: where.activity },
        where.cause ?? cause,
      );
      if (where.room !== from) {
        if (where.room === this.playerRoom) {
          this.say(arrival(this.world, npc, from));
          this.arrived.push(npc);
        }
        this.sightings(npc, from, where.room, id);
      }
    }
  }

  private locate(
    npc: string,
  ): { room: string; activity: string; cause: LogId | null; routine: boolean } | null {
    const a = this.world.actors[npc];
    if (!a) return null;
    const w = locate(this.world, a, this.world.clock);
    const routine = w.layer === "role" || w.layer === "home" || w.layer === "needs";
    return { room: w.room, activity: w.activity, cause: w.entry?.cause ?? null, routine };
  }

  /** People remember where they last saw each other. These beliefs go stale, by design. */
  sightings(mover: string, from: string, to: string, cause: LogId): void {
    const seenLeaving = this.npcsIn(from).filter((id) => id !== mover);
    const seenArriving = this.npcsIn(to).filter((id) => id !== mover);
    for (const observer of [...seenLeaving, ...seenArriving])
      this.sighted(observer, mover, to, cause);
    if (mover !== PLAYER) for (const other of seenArriving) this.sighted(mover, other, to, cause);
  }

  private sighted(observer: string, subject: string, room: string, cause: LogId): void {
    for (const b of beliefsOf(this.world, observer))
      if (b.claim.predicate === "is_in" && b.claim.subject === subject && b.credence > 0)
        this.retire(observer, b.claim.id, cause);
    const claim = makeClaim({
      subject,
      predicate: "is_in",
      place: room,
      when: this.world.clock,
      severity: 1,
      origin: cause,
    });
    this.learn(observer, claim, 1, { kind: "witnessed" }, cause);
  }

  /** What an NPC says has consequences too: the listener learns the claim. */
  heard(turn: Turn, id: LogId): void {
    const { intent } = turn;
    if (intent.topic.kind !== "claim") return;
    // Being asked "is it true that..." also tells you what is being said about you.
    if (!["tell", "confide", "accuse", "ask"].includes(intent.act)) return;
    const claim = this.world.claims[intent.topic.id];
    if (claim && intent.listener === PLAYER)
      this.learn(PLAYER, claim, 0.7, { kind: "told", from: intent.speaker }, id);
  }

  ending(): string | null {
    const quest = this.world.machines.quest?.node;
    if (quest === "resolved") {
      const where = this.world.items.ledger?.at;
      const carried = Boolean(where && "holder" in where && where.holder === PLAYER);
      const withMara = this.world.machines.ledger_fate?.node === "returned";
      const key = carried ? "resolved_in_hand" : withMara ? "resolved" : "resolved_no_ledger";
      return ENDINGS[key] ?? null;
    }
    if (quest === "condemned") return ENDINGS.condemned ?? null;
    if (quest === "thrown_out") return ENDINGS.thrown_out ?? null;
    if (this.world.clock < MIDNIGHT) return null;
    if (quest !== "cleared") return ENDINGS.midnight ?? null;
    const at = this.world.items.ledger?.at;
    const inHand = Boolean(at && "holder" in at && at.holder === PLAYER);
    const returned = this.world.machines.ledger_fate?.node === "returned";
    if (inHand) return ENDINGS.cleared_in_hand ?? null;
    return (returned ? ENDINGS.cleared : ENDINGS.cleared_no_ledger) ?? null;
  }

  maraIsHere(): boolean {
    return this.world.actors[MARA]?.room === this.playerRoom;
  }
}
