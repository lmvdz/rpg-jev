/**
 * Conversation. Player speech is parsed into the same structure NPCs use
 * (SPEC.md section 5): `{speaker, listener, act, topic}`. Raw player text is
 * seen by the parse questions and by nothing else. Every option list below is
 * built by code from the current world and includes a "none".
 */
import {
  type Belief,
  beliefIn,
  beliefsOf,
  type Claim,
  type JudgeAnswer,
  type LogId,
  makeClaim,
  persuadability,
  resolve,
  type SpeechAct,
  type SpeechIntent,
  stanceOf,
  type Turn,
} from "@rpg-jev/core";
import {
  type Asked,
  acceptOffer,
  believeClaim,
  compileSlice,
  NONE,
  type Option,
  parseIntent,
  pickSpeechAct,
  stakeInClaim,
} from "@rpg-jev/jev";
import {
  C_APRON,
  C_ODO_GAMBLES,
  C_TOBIN_OWES,
  DUSK,
  MARA,
  NPCS,
  ODO,
  PLAYER,
  RESTRICTED_ROOMS,
  TOBIN,
  TOBINS_DEBT,
  TRUST,
  WRONGDOING,
} from "./content.ts";
import type { Game } from "./game.ts";
import {
  type Action,
  askable,
  COINS,
  type Matched,
  type Named,
  orList,
  type PlayerTopic,
  REQUESTS,
  type Request,
  scopeOf,
  whichOne,
} from "./parser.ts";
import { hesitation, silence } from "./prose.ts";
import { type NpcPart, parseSlice, rankedBeliefs, sceneSlice, standing } from "./slices.ts";
import { cap, claimClause, feelingWords, nameOf, whenFor } from "./words.ts";

// --- Stage two of the parser: the judge --------------------------------------

const REQUEST_WORDS: Record<Request, string> = {
  speak_to_mara: "Go to Mara and tell her what they know or saw",
  confess: "Admit to what they did",
  keep_quiet: "Keep something quiet",
};

const SPEECH_VERBS = ["greet", "ask", "tell", "accuse", "offer", "threaten", "request", "promise"];

function topicOptions(g: Game): { statements: Option[]; subjects: Option[] } {
  const known = beliefsOf(g.world, PLAYER)
    .filter((b) => b.credence > 0 && b.claim.predicate !== "is_in")
    .sort((a, b) => b.edge.known_from - a.edge.known_from)
    .slice(0, 8)
    .map((b) => ({
      id: `claim:${b.claim.id}`,
      // The parse questions call the player "the character", so the options must too.
      description: `that ${claimClause(g.world, b.claim).replace("the stranger", "the character")}`,
    }));
  const names = NPCS.map((id) => ({ id, name: g.world.actors[id]?.name ?? id }));
  const statements = [
    ...known,
    { id: "deny", description: "that the character never took the ledger" },
    {
      id: "alibi",
      description: "that the character sat in the common room at dusk, in plain view",
    },
    ...names.map((n) => ({ id: `blame:${n.id}`, description: `that ${n.name} took the ledger` })),
  ];
  const subjects = [
    ...askable(g.world).map((e) => ({ id: `about:${e.id}`, description: e.name })),
    ...names.map((n) => ({ id: `where:${n.id}`, description: `where ${n.name} is now` })),
    { id: "about:tonight", description: "what they saw or know of tonight, in general" },
  ];
  return { statements, subjects };
}

function decodeTopic(id: string): PlayerTopic {
  const [kind, rest] = [id.slice(0, id.indexOf(":")), id.slice(id.indexOf(":") + 1)];
  if (id === "deny") return { kind: "deny" };
  if (id === "alibi") return { kind: "alibi" };
  if (kind === "claim") return { kind: "claim", id: rest };
  if (kind === "blame") return { kind: "blame", npc: rest };
  if (kind === "about") return { kind: "entity", id: rest };
  if (kind === "where") return { kind: "whereabouts", id: rest };
  return { kind: "none" };
}

const top = (a: JudgeAnswer | undefined) =>
  a?.type === "choice"
    ? { id: a.choice, p: a.probabilities[a.choice] ?? 0, all: a.probabilities }
    : null;

/**
 * Reads free text with the parse-intent family. The action's confidence is its
 * weakest argument. A target that does not stand out among things of one kind
 * becomes a question naming them; nothing here ever says "please rephrase".
 */
export async function judgeParse(g: Game, text: string): Promise<Matched> {
  const scope = scopeOf(g.world);
  const { statements, subjects } = topicOptions(g);
  const option = (n: Named): Option => ({ id: n.id, description: n.name });
  const absent: Named[] = NPCS.filter((id) => !scope.people.some((p) => p.id === id)).map((id) => ({
    id: `absent:${id}`,
    name: `${g.world.actors[id]?.name ?? id} (not in the room)`,
    aliases: [],
    kind: "person",
  }));
  const targets = [...scope.people, ...absent, ...scope.things, ...scope.carried, ...scope.exits];
  const questions = parseIntent({
    targets: targets.map(option),
    items: [...scope.carried, ...scope.things].map(option),
    statements,
    subjects,
    requests: REQUESTS.map((r) => ({ id: r, description: REQUEST_WORDS[r] })),
  });
  const cause = g.store.append({ kind: "stimulus", what: "parse", data: {} }, null);
  const slice = compileSlice(parseSlice, { world: g.world, text });
  const decision = await g.decide(slice, questions, [], cause);
  if (!decision || decision.source === "fallback")
    return {
      kind: "error",
      message:
        "You can't quite find the words. (The judge is not answering. Plain commands still work: type help.)",
    };

  const mode = top(decision.answers.mode);
  if (mode?.id !== "in_story")
    return { kind: "error", message: "You mutter something that makes no sense, even to you." };

  const verb = top(decision.answers.verb);
  if (!verb || verb.id === NONE)
    return { kind: "error", message: "You turn the thought over and cannot see how to act on it." };
  if (verb.p < 0.5) {
    const rivals = Object.entries(verb.all)
      .filter(([id]) => id !== NONE)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([id]) => id);
    return { kind: "error", message: `You hesitate. Do you mean to ${orList(rivals)}?` };
  }

  const target = top(decision.answers.target);
  if (target?.id.startsWith("absent:") && target.p >= 0.5) {
    const who = g.world.actors[target.id.slice(7)]?.name ?? "They";
    return { kind: "error", message: `${who} is not here.` };
  }
  const pickTarget = (pool: readonly Named[], needed: number): Named | Matched => {
    const mass = (id: string) => target?.all[id] ?? 0;
    const best = pool.filter((n) => mass(n.id) > 0).sort((a, b) => mass(b.id) - mass(a.id));
    const first = best[0];
    if (first && mass(first.id) >= needed) return first;
    const rivals = best.filter((n) => mass(n.id) >= 0.1);
    if (rivals.length >= 2)
      return {
        kind: "clarify",
        question: "",
        candidates: rivals,
        complete: () => ({ verb: "look" }),
      };
    // M0's pattern: `none` wins while the leftover sits on several things of one kind.
    const sameKind = pool.filter((n) => mass(n.id) >= 0.05);
    if (sameKind.length >= 2)
      return {
        kind: "clarify",
        question: "",
        candidates: sameKind,
        complete: () => ({ verb: "look" }),
      };
    return { kind: "error", message: "Nothing here answers to that." };
  };
  const clarify = (found: Matched, word: string, complete: (id: string) => Action): Matched =>
    found.kind === "clarify"
      ? { ...found, question: whichOne(word, found.candidates), complete }
      : found;
  const isNamed = (x: Named | Matched): x is Named => "aliases" in x;

  const item = top(decision.answers.item);
  const itemId = item && item.id !== NONE && item.p >= 0.5 ? item.id : null;
  const topicAnswer = top(
    verb.id === "ask" ? decision.answers.asks_about : decision.answers.states,
  );
  const topic: PlayerTopic =
    topicAnswer && topicAnswer.id !== NONE && topicAnswer.p >= 0.4
      ? decodeTopic(topicAnswer.id)
      : { kind: "none" };
  const requestAnswer = top(decision.answers.request);
  const request =
    requestAnswer && requestAnswer.id !== NONE && requestAnswer.p >= 0.5
      ? (requestAnswer.id as Request)
      : null;

  if (
    SPEECH_VERBS.includes(verb.id) ||
    verb.id === "give" ||
    verb.id === "show" ||
    verb.id === "attack"
  ) {
    // Violence is not undone by an apology, so it needs a clearer reading than the rest.
    const found = pickTarget(scope.people, verb.id === "attack" ? 0.8 : 0.6);
    const build = (to: string): Action => {
      if (verb.id === "attack") return { verb: "attack", target: to };
      if (verb.id === "show" && itemId) return { verb: "show", item: itemId, to };
      if (verb.id === "give" && itemId) return { verb: "give", item: itemId, to, topic };
      const act = (verb.id === "give" || verb.id === "show" ? "offer" : verb.id) as SpeechAct;
      return { verb: "say", act, to, topic, item: itemId, request };
    };
    // A statement with no recognisable content: ask which, naming what the player could say.
    const empty = topic.kind === "none" && !itemId && !request;
    if (isNamed(found) && empty && (verb.id === "tell" || verb.id === "accuse")) {
      const mass = (id: string) => topicAnswer?.all[id] ?? 0;
      const ranked = [...statements].sort((a, b) => mass(b.id) - mass(a.id)).slice(0, 4);
      const shown = (o: Option) => {
        const claim = o.id.startsWith("claim:") ? g.world.claims[o.id.slice(6)] : undefined;
        if (claim) return `that ${claimClause(g.world, claim, { listener: PLAYER })}`;
        return String(o.description).replace("the character", "you");
      };
      const candidates = ranked.map(
        (o): Named => ({ id: o.id, name: shown(o), aliases: [], kind: "thing" }),
      );
      return {
        kind: "clarify",
        question: `What do you tell ${found.name}: ${orList(candidates.map((c) => c.name))}?`,
        candidates,
        complete: (id) => ({
          verb: "say",
          act: verb.id as SpeechAct,
          to: found.id,
          topic: decodeTopic(id),
          item: null,
          request: null,
        }),
      };
    }
    if (isNamed(found)) return { kind: "action", action: build(found.id) };
    if (found.kind === "error" && scope.people.length === 0)
      return { kind: "error", message: "There is nobody here to hear you." };
    return clarify(found, verb.id === "attack" ? "attack" : "speak to", build);
  }

  const pools: Record<string, [readonly Named[], string]> = {
    take: [scope.things, "take"],
    drop: [scope.carried, "drop"],
    examine: [[...scope.things, ...scope.carried, ...scope.people], "look at"],
    go: [scope.exits, "go to"],
    use: [scope.exits, "unlock"],
  };
  if (verb.id === "wait") return { kind: "action", action: { verb: "wait", minutes: 10 } };
  const [pool, word] = pools[verb.id] ?? [[], ""];
  const found = pickTarget(pool, 0.6);
  const build = (id: string): Action =>
    verb.id === "take"
      ? { verb: "take", item: id }
      : verb.id === "drop"
        ? { verb: "drop", item: id }
        : verb.id === "go"
          ? { verb: "go", room: id }
          : verb.id === "use"
            ? { verb: "use", target: id, item: itemId }
            : { verb: "examine", target: id };
  if (isNamed(found)) return { kind: "action", action: build(found.id) };
  return clarify(found, word, build);
}

// --- What an NPC could say: closed option sets built from their beliefs -------

interface Reply {
  option: Option;
  act: SpeechAct;
  topic: SpeechIntent["topic"];
}

export const guarded = (g: Game, holder: string, c: Claim): boolean => {
  if (c.subject === holder && (WRONGDOING.includes(c.predicate) || c.predicate === "owes"))
    return true;
  // People do not carry tales about someone they are in debt to.
  const owes = beliefsOf(g.world, holder).some(
    (b) =>
      b.claim.predicate === "owes" &&
      b.claim.subject === holder &&
      b.claim.to === c.subject &&
      b.credence > 0,
  );
  return owes && WRONGDOING.includes(c.predicate);
};

const held = (g: Game, npc: string, about?: string): Belief[] =>
  rankedBeliefs(g.world, npc, about).filter((b) => b.credence >= 0.4);

const mentions = (c: Claim, id: string) => [c.subject, c.object, c.to, c.place].includes(id);

/** The freshest wrong the NPC holds against the stranger: what an accusation will be about. */
function againstStranger(g: Game, npc: string): Belief | undefined {
  return (
    held(g, npc)
      .filter((b) => b.claim.subject === PLAYER && WRONGDOING.includes(b.claim.predicate))
      // People lead with the worst thing they have heard, and a tale made worse in the
      // telling is by construction the worst. This is what brings garbled claims to the
      // player's face rather than leaving them in `why`.
      .sort(
        (a, b) => b.claim.severity - a.claim.severity || b.edge.known_from - a.edge.known_from,
      )[0]
  );
}

function claimReply(g: Game, npc: string, act: SpeechAct, b: Belief): Reply {
  const clause = `${claimClause(g.world, b.claim)}${whenFor(b.claim, g.world.clock)}`;
  const description =
    act === "confide"
      ? `Quietly confides to the stranger that ${clause}, which ${nameOf(g.world, npc)} has kept back until now`
      : act === "accuse"
        ? `Says to the stranger's face that ${clause}`
        : `Tells the stranger that ${clause}`;
  return {
    option: { id: `${act}:${b.claim.id}`, description },
    act,
    topic: { kind: "claim", id: b.claim.id },
  };
}

const plain = (id: string, act: SpeechAct, description: string, request?: string): Reply => ({
  option: { id, description },
  act,
  topic: request ? { kind: "request", id: request } : { kind: "none" },
});

const REFUSE = plain("refuse", "refuse", "Refuses to talk about it");
const ASK_WHY = plain("ask_why", "ask", "Asks the stranger why they want to know", "why");
const ASK_HOW = plain("ask_how", "ask", "Asks the stranger how they come to know that", "how");
const ASK_WHERE_FROM = plain(
  "ask_where_from",
  "ask",
  "Asks the stranger where they got that",
  "where_from",
);
const ASK_VOUCH = plain("ask_vouch", "ask", "Asks who can vouch for that", "vouch");
const GREET = plain("greet", "greet", "Returns the greeting and no more");
const THREATEN = plain("threaten", "threaten", "Threatens the stranger");

type Situation =
  | { kind: "greeted" | "entered" | "denied" | "threatened" | "interject" }
  | { kind: "asked"; about: string | null; whereabouts: boolean }
  | { kind: "told"; believes: boolean; claim: Claim; shown?: boolean }
  | { kind: "accused"; alone: boolean };

function replies(g: Game, npc: string, s: Situation): Reply[] {
  const out: Reply[] = [];
  const accusation = againstStranger(g, npc);
  const accuse = accusation ? [claimReply(g, npc, "accuse", accusation)] : [];
  switch (s.kind) {
    case "greeted":
    case "entered": {
      out.push(GREET, ...accuse);
      if (npc === MARA)
        out.push(plain("ask_dusk", "ask", "Asks the stranger where they were at dusk", "dusk"));
      const gossip = held(g, npc).find(
        (b) =>
          b.claim.subject !== PLAYER &&
          b.claim.subject !== npc &&
          !guarded(g, npc, b.claim) &&
          b.claim.predicate !== "is_in" &&
          // Nobody tells the stranger what the stranger just told them.
          !(b.edge.source && "from" in b.edge.source && b.edge.source.from === PLAYER),
      );
      if (gossip) out.push(claimReply(g, npc, "tell", gossip));
      if (s.kind === "greeted") out.push(REFUSE);
      break;
    }
    case "asked": {
      const about = s.about;
      if (s.whereabouts && about) {
        const last = beliefsOf(g.world, npc).find(
          (b) => b.claim.predicate === "is_in" && b.claim.subject === about && b.credence > 0,
        );
        out.push(
          last
            ? claimReply(g, npc, "tell", last)
            : plain("tell_nothing", "tell", "Says they have not seen them"),
        );
      } else {
        const relevant = held(g, npc, about ?? undefined).filter(
          (b) => !about || mentions(b.claim, about),
        );
        const open = relevant.filter(
          (b) => !guarded(g, npc, b.claim) && b.claim.predicate !== "is_in",
        );
        // Their own wrongdoing stays buried; what they owe is only embarrassing.
        const secret = relevant.filter(
          (b) =>
            guarded(g, npc, b.claim) && (b.claim.subject !== npc || b.claim.predicate === "owes"),
        );
        out.push(...open.slice(0, 2).map((b) => claimReply(g, npc, "tell", b)));
        out.push(...secret.slice(0, 1).map((b) => claimReply(g, npc, "confide", b)));
        if (open.length + secret.length === 0)
          out.push(plain("tell_nothing", "tell", "Says they know nothing about it"));
      }
      out.push(REFUSE, ASK_WHY);
      break;
    }
    case "told":
      if (s.believes) {
        out.push(s.shown ? ASK_WHERE_FROM : ASK_HOW);
        if (npc === MARA && s.claim.subject !== PLAYER && s.claim.subject !== MARA)
          out.push(
            plain(
              "promise_confront",
              "promise",
              "Says she will have it out with that person herself, tonight",
              `confront:${s.claim.subject}`,
            ),
          );
        const more = held(g, npc, s.claim.subject).find(
          (b) =>
            b.claim.id !== s.claim.id &&
            b.claim.subject === s.claim.subject &&
            WRONGDOING.includes(b.claim.predicate),
        );
        if (more)
          out.push(claimReply(g, npc, guarded(g, npc, more.claim) ? "confide" : "tell", more));
        out.push(REFUSE);
      } else
        out.push(
          ...accuse,
          REFUSE,
          s.shown ? ASK_WHERE_FROM : s.claim.subject === PLAYER ? ASK_VOUCH : ASK_HOW,
        );
      break;
    case "denied":
      out.push(...accuse, REFUSE);
      if (npc === MARA)
        out.push(
          plain("ask_dusk", "ask", "Asks the stranger where they were at dusk, then", "dusk"),
        );
      break;
    case "accused": {
      out.push(...accuse, REFUSE, THREATEN);
      const own = held(g, npc).find((b) => b.claim.subject === npc && b.claim.predicate === "took");
      if (own) out.push(claimReply(g, npc, "confide", own));
      if (s.alone)
        out.push(
          plain("offer", "offer", "Quietly offers the stranger money to let the matter drop"),
        );
      break;
    }
    case "threatened":
      out.push(REFUSE, THREATEN, ...accuse);
      break;
    case "interject":
      out.push(...accuse, THREATEN);
      break;
  }
  const seen = new Set<string>();
  return out.filter(
    (r) => !seen.has(r.option.id) && seen.add(r.option.id) && !saidLately(g, npc, r),
  );
}

/** Nobody says the same thing twice in an hour. Refusing and greeting never wear out. */
function saidLately(g: Game, npc: string, reply: Reply): boolean {
  if (reply.act === "refuse" || reply.act === "greet") return false;
  const topic = JSON.stringify(reply.topic);
  for (let i = g.log.length - 1; i >= 0; i--) {
    const e = g.log[i];
    if (!e || g.world.clock - e.t > 60) return false;
    if (e.kind !== "effect" || e.effect.kind !== "say") continue;
    const said = e.effect.intent;
    if (said.speaker === npc && said.act === reply.act && JSON.stringify(said.topic) === topic)
      return true;
  }
  return false;
}

/** The reply code would give with no judge: stance decides (SPEC.md section 11). */
function fallbackReply(g: Game, npc: string, options: Reply[]): string {
  const stance = stanceOf(g.world, npc, PLAYER) ?? "wary";
  const open = ["curious", "indebted", "loyal"].includes(stance);
  const wanted = open ? ["tell", "confide", "promise", "ask"] : ["refuse", "greet", "ask"];
  const found = options.find((o) => wanted.includes(o.act)) ?? options[0];
  return found?.option.id ?? NONE;
}

function speechQuestion(g: Game, npc: string, options: Reply[], premise?: string): Asked {
  return pickSpeechAct({
    npc: `npcs.${npc}`,
    options: options.map((o) => o.option),
    fallback: fallbackReply(g, npc, options),
    ...(premise ? { premise } : {}),
  });
}

function relation(g: Game, npc: string, source: string): string {
  if (source === PLAYER) {
    const actor = g.world.actors[npc];
    return `the stranger (${actor ? feelingWords(actor, stanceOf(g.world, npc, PLAYER)) : "unknown"})`;
  }
  return `${nameOf(g.world, source)}, ${standing(g.world, npc, source)}`;
}

// --- The player speaks ---------------------------------------------------------

const EVIDENCE_WORDS: Record<string, string> = {
  ledger: "the missing ledger itself, held out in plain view",
  apron: "a cook's apron stiff with flour, the initials O.B. stitched in the hem",
  markers: "six river-boat gambling markers, each scratched with a sum and the initials O.B.",
};

function evidenceFor(g: Game, item: string): Claim | null {
  if (item === "markers") return C_ODO_GAMBLES;
  const held = beliefsOf(g.world, PLAYER);
  if (item === "apron") return C_APRON;
  if (item === "ledger") return held.find((b) => b.claim.predicate === "found")?.claim ?? null;
  return null;
}

const ACT_WORDS: Partial<Record<SpeechAct, string>> = {
  greet: "greets",
  ask: "asks",
  tell: "tells",
  accuse: "accuses someone in front of",
  offer: "makes an offer to",
  threaten: "threatens",
  request: "asks a favour of",
  promise: "makes a promise to",
};

type Say = Extract<Action, { verb: "say" }>;

export async function playerSpeaks(
  g: Game,
  action: Say,
  root: LogId,
  handOver = false,
): Promise<number> {
  const npc = action.to;
  const listener = g.world.actors[npc];
  if (!listener || listener.room !== g.playerRoom) {
    g.say("They are not here.");
    return 0;
  }
  const name = listener.name;
  g.addressed[npc] = g.world.conversation.beat;
  const others = g.npcsIn(g.playerRoom).filter((n) => n !== npc);
  const inFrontOf =
    others.length > 0 ? others.map((o) => nameOf(g.world, o)).join(" and ") : "nobody else";

  // 1. What was said, as structure. The text itself stopped at the parser.
  let asserted: Claim | null = null;
  let event: Claim | null = null;
  let shown: string | null = null;
  const { topic } = action;
  if (handOver) {
    const id = g.commit({ kind: "transfer", item: "ledger", to: { holder: MARA } }, root);
    g.commit(
      { kind: "set_node", target: { type: "machine", id: "ledger_fate" }, to: "returned" },
      id,
    );
    g.say(
      "You put the ledger on the bar in front of Mara. Her hand comes down flat on it before you have let go.",
    );
    event = g.happened(
      { subject: PLAYER, predicate: "handed_over", object: "ledger", to: MARA, severity: 2 },
      id,
    );
    shown = EVIDENCE_WORDS.ledger ?? null;
    const apron = g.world.items.apron?.at;
    if (apron && "holder" in apron && apron.holder === PLAYER) {
      g.commit({ kind: "transfer", item: "apron", to: { holder: MARA } }, id);
      g.say(
        "The apron it was wrapped in goes down beside it. She turns the hem over and reads the stitching.",
      );
      g.learn(MARA, C_APRON, 1, { kind: "witnessed" }, id);
    }
  } else if (action.item && action.item !== COINS && action.act === "tell") {
    const thing = g.world.items[action.item];
    g.say(`You hold out ${thing?.name ?? "it"} for ${name} to see.`);
    asserted = evidenceFor(g, action.item);
    shown = EVIDENCE_WORDS[action.item] ?? thing?.name ?? null;
    event = g.happened(
      { subject: PLAYER, predicate: "showed", object: action.item, to: npc },
      root,
    );
  } else if (topic.kind === "deny") {
    g.say(`You tell ${name}, plainly, that you never touched the ledger.`);
    event = g.happened({ subject: PLAYER, predicate: "denied_taking", object: "ledger" }, root);
  } else if (topic.kind === "alibi") {
    asserted = makeClaim({
      subject: PLAYER,
      predicate: "in_plain_view",
      place: "common_room",
      when: DUSK,
      severity: 1,
      origin: null,
    });
  } else if (topic.kind === "blame") {
    asserted = makeClaim({
      subject: topic.npc,
      predicate: "took",
      object: "ledger",
      when: DUSK,
      severity: 2,
      origin: null,
    });
  } else if (topic.kind === "claim") asserted = g.world.claims[topic.id] ?? null;

  if (action.act === "threaten") {
    g.say(`You lean in close to ${name} and make yourself understood.`);
    event = g.happened({ subject: PLAYER, predicate: "threatened", to: npc, severity: 2 }, root);
  } else if (asserted && !shown) {
    // Narration addresses the player, so the player is "you" and the listener is named.
    const clause = claimClause(g.world, asserted, { listener: PLAYER });
    const face = asserted.subject === npc;
    g.say(face ? `You say it to ${name}'s face: ${clause}.` : `You tell ${name} that ${clause}.`);
  } else if (action.act === "greet") g.say(`You greet ${name}.`);
  else if (action.act === "ask") {
    const what =
      topic.kind === "whereabouts"
        ? `where ${nameOf(g.world, topic.id)} is`
        : topic.kind === "entity"
          ? `about ${nameOf(g.world, topic.id, { listener: npc })}`
          : topic.kind === "claim" && asserted
            ? `whether ${claimClause(g.world, asserted, { listener: npc })}`
            : "what they know";
    g.say(`You ask ${name} ${what}.`);
  }
  const toFace =
    asserted !== null && asserted.subject === npc && WRONGDOING.includes(asserted.predicate);
  if (
    asserted &&
    asserted.subject !== PLAYER &&
    WRONGDOING.includes(asserted.predicate) &&
    action.act !== "ask"
  )
    event ??= g.happened(
      {
        subject: PLAYER,
        predicate: "accused",
        object: "ledger",
        to: asserted.subject,
        severity: 2,
      },
      root,
    );

  // 2. One call for the whole scene: the listener's judgments and every bystander's.
  const bargaining =
    action.act === "offer" ||
    action.act === "request" ||
    (action.act === "threaten" && action.request);
  const gives =
    action.act === "threaten"
      ? "not being hurt"
      : action.item === COINS
        ? npc === TOBIN && beliefIn(g.world, PLAYER, C_TOBIN_OWES.id)
          ? "enough silver to clear everything Tobin owes Odo, paid now"
          : "a handful of silver, paid now"
        : action.item
          ? (g.world.items[action.item]?.name ?? "something")
          : "nothing but thanks";
  const asks = action.request ? REQUEST_WORDS[action.request].toLowerCase() : "something unclear";

  const named =
    topic.kind === "entity" || topic.kind === "whereabouts" ? topic.id : asserted?.subject;
  // "Ask Tobin what he saw" is about tonight, not about Tobin.
  const about = named === "tonight" || (action.act === "ask" && named === npc) ? undefined : named;
  const hears: Record<string, string> = {
    said_by: "the stranger",
    what: `The stranger ${ACT_WORDS[action.act] ?? "speaks to"} ${name}`,
    in_front_of: inFrontOf,
  };
  if (asserted) {
    hears.claim = `${cap(claimClause(g.world, asserted))}${whenFor(asserted, g.world.clock)}`;
    hears.from = relation(g, npc, PLAYER);
    hears.how = shown
      ? `shown the thing itself: ${shown}`
      : "said aloud, with nothing shown to back it";
  } else if (shown) hears.shown = shown;
  if (topic.kind === "deny") hears.claim = "The stranger swears they never touched the ledger";
  if (action.act === "ask")
    hears.asks_about = about ? nameOf(g.world, about) : "what they know of tonight's trouble";

  const extra: NpcPart["extra"] = { hears };
  if (bargaining) extra.offer = { from: relation(g, npc, PLAYER), gives, asks };
  const parts: NpcPart[] = [{ npc, extra, ...(about ? { about } : {}) }];

  const questions: Record<string, Asked> = {};
  const judged = asserted !== null && !toFace && action.act !== "ask";
  // Seeing is believing, and that is code's call: initials stitched in a hem or scratched
  // on a marker are in front of her eyes. What the thing means is still hers to judge.
  const selfEvident = [C_APRON.id, C_ODO_GAMBLES.id].includes(asserted?.id ?? "");
  if (shown && asserted && selfEvident)
    g.learn(npc, asserted, 0.9, { kind: "shown", from: PLAYER }, root);
  const already = asserted ? (beliefIn(g.world, npc, asserted.id)?.credence ?? 0) >= 0.9 : false;
  let single: Reply[] = [];
  let ifYes: Reply[] = [];
  let ifNo: Reply[] = [];
  if (bargaining) {
    const lever = action.act === "threaten" ? "threat" : action.item ? "payment" : "appeal";
    questions.accepts = acceptOffer(`npcs.${npc}`, persuadability(listener, lever, 0.5) * 0.8);
  } else if (judged && asserted && !already) {
    const prior = (TRUST[npc]?.[PLAYER] ?? 0.3) + (shown ? 0.45 : 0) + listener.drives.trust * 0.3;
    questions.believes = believeClaim(`npcs.${npc}`, Math.min(0.95, prior));
    const seen = shown !== null;
    ifYes = replies(g, npc, { kind: "told", believes: true, claim: asserted, shown: seen });
    ifNo = replies(g, npc, { kind: "told", believes: false, claim: asserted, shown: seen });
    const c = hears.claim ?? "it";
    questions.reply_if_believes = speechQuestion(
      g,
      npc,
      ifYes,
      `${name} has decided that this is true: ${c}.`,
    );
    questions.reply_if_doubts = speechQuestion(
      g,
      npc,
      ifNo,
      `${name} has decided that this is not true: ${c}.`,
    );
  } else {
    single = replies(
      g,
      npc,
      toFace
        ? { kind: "accused", alone: others.length === 0 }
        : action.act === "ask"
          ? { kind: "asked", about: about ?? null, whereabouts: topic.kind === "whereabouts" }
          : action.act === "threaten"
            ? { kind: "threatened" }
            : topic.kind === "deny"
              ? { kind: "denied" }
              : asserted
                ? { kind: "told", believes: true, claim: asserted, shown: shown !== null }
                : { kind: "greeted" },
    );
    questions.reply = speechQuestion(g, npc, single);
  }

  const noticed = event ?? asserted;
  const bystanders = noticed ? addBystanders(g, others, noticed, parts, questions) : [];
  const slice = compileSlice(sceneSlice, { world: g.world, parts });
  const present = [npc, ...others].map((n) => ({
    kind: "in_room" as const,
    actor: n,
    room: g.playerRoom,
  }));
  const decision = await g.decide(slice, questions, present, root);
  if (!decision) {
    g.say(`${name} is no longer listening.`);
    return 1;
  }

  // 3. Commit what followed, in code.
  if (event) g.witness(event, g.playerRoom, decision.id);
  let pool = single;
  let answer = decision.answers.reply;
  if (questions.believes && asserted) {
    const believed = g.sampleYes(decision.answers.believes, `${npc} believes`, decision.id);
    const source = shown
      ? ({ kind: "shown", from: PLAYER } as const)
      : ({ kind: "told", from: PLAYER } as const);
    g.learn(npc, asserted, g.credenceFor(source, believed), source, decision.id);
    if (believed) g.nudge(npc, { trust: 0.05 }, decision.id);
    pool = believed ? ifYes : ifNo;
    answer = believed ? decision.answers.reply_if_believes : decision.answers.reply_if_doubts;
  }
  if (bargaining) bargain(g, action, decision.answers.accepts, decision.id);
  else {
    const chosen = g.sampleChoice(answer, `${npc} reply`, decision.id);
    const reply = pool.find((r) => r.option.id === chosen);
    if (reply) g.intent(npc, PLAYER, reply.act, reply.topic, 3, decision.id);
    else g.say(silence(g.world, npc));
  }
  settleBystanders(g, bystanders, noticed, decision.answers, decision.id);
  g.speak((turn, id) => afterSpeech(g, turn, id));
  return 3;
}

function bargain(g: Game, action: Say, answer: JudgeAnswer | undefined, cause: LogId): void {
  const npc = action.to;
  const actor = g.world.actors[npc];
  if (!actor || answer?.type !== "noul") return;
  const key = `${npc}:${action.request ?? "?"}:${action.act}:${action.item ?? "-"}`;
  const closed = g.log.some(
    (e) => e.kind === "stimulus" && e.what === "refused" && e.data.key === key,
  );
  if (closed) {
    g.intent(npc, PLAYER, "refuse", { kind: "none" }, 3, cause);
    return;
  }
  // Already promised: asking again does not reopen the question.
  const promised = action.request === "speak_to_mara" && g.world.debts[`testify_${npc}`];
  if (promised) {
    g.intent(npc, PLAYER, "promise", { kind: "request", id: "speak_to_mara" }, 3, cause);
    return;
  }
  const accepted = g.sampleYes(answer, `${npc} accepts`, cause);
  const lever = action.act === "threaten" ? "threat" : action.item ? "payment" : "appeal";
  const outcome = resolve(accepted, persuadability(actor, lever, answer.noul));
  if (outcome === "wavers") {
    g.say(hesitation(g.world, npc));
    return;
  }
  if (outcome === "refuses") {
    g.store.append({ kind: "stimulus", what: "refused", data: { key } }, cause);
    g.intent(npc, PLAYER, "refuse", { kind: "none" }, 3, cause);
    return;
  }
  if (action.item === COINS) {
    const clears = npc === TOBIN && beliefIn(g.world, PLAYER, C_TOBIN_OWES.id);
    const coins = Math.min(g.world.actors[PLAYER]?.coins ?? 0, clears ? TOBINS_DEBT : 3);
    if (coins > 0) g.commit({ kind: "pay", from: PLAYER, to: npc, coins }, cause);
    g.nudge(npc, { obligation: 0.2, trust: 0.1 }, cause);
  } else if (action.item)
    g.commit({ kind: "transfer", item: action.item, to: { holder: npc } }, cause);
  g.intent(npc, PLAYER, "promise", { kind: "request", id: action.request ?? "none" }, 3, cause);
}

// --- Bystanders: stake sweep, then a reaction for those who care --------------

function addBystanders(
  g: Game,
  who: string[],
  noticed: Claim,
  parts: NpcPart[],
  questions: Record<string, Asked>,
): { npc: string; options: Reply[] }[] {
  const out: { npc: string; options: Reply[] }[] = [];
  const words = `${cap(claimClause(g.world, noticed))}${whenFor(noticed, g.world.clock)}`;
  for (const npc of who) {
    const touches =
      mentions(noticed, npc) || noticed.place === "cellar" || noticed.object === "ledger";
    parts.push({ npc, extra: { notices: words, hears: words } });
    questions[`stake_${npc}`] = stakeInClaim(`npcs.${npc}`, touches ? 0.8 : 0.2);
    const options = replies(g, npc, { kind: "interject" });
    if (options.length > 0)
      questions[`interject_${npc}`] = speechQuestion(
        g,
        npc,
        options,
        `${nameOf(g.world, npc)} has decided this matters to them and that they will not let it pass in silence.`,
      );
    out.push({ npc, options });
  }
  return out;
}

function settleBystanders(
  g: Game,
  bystanders: { npc: string; options: Reply[] }[],
  noticed: Claim | null,
  answers: Record<string, JudgeAnswer>,
  cause: LogId,
): void {
  if (!noticed) return;
  for (const { npc, options } of bystanders) {
    const stake = answers[`stake_${npc}`];
    if (!g.sampleYes(stake, `${npc} stake`, cause)) continue;
    const named = mentions(noticed, npc);
    const chosen = g.sampleChoice(answers[`interject_${npc}`], `${npc} interjects`, cause);
    const reply = options.find((r) => r.option.id === chosen);
    // A strong stake is urgent: it may cut across whoever was addressed, and it does not wait.
    const urgent = named || (stake?.type === "noul" && stake.noul >= 0.8);
    if (reply) g.intent(npc, PLAYER, reply.act, reply.topic, urgent ? 2 : 1, cause);
    owe(g, npc, noticed, cause);
  }
}

/** A witness with a stake carries the tale to Mara, or gets even: a debt with a fuse. */
export function owe(g: Game, npc: string, noticed: Claim, cause: LogId): void {
  if (npc === MARA) return;
  const id = `${npc === ODO && mentions(noticed, ODO) ? "retaliate" : "report"}_${npc}_${noticed.id}`;
  if (g.world.debts[id]) return;
  g.commit(
    {
      kind: "create_debt",
      debt: {
        id,
        cause,
        stakeholder: npc,
        kind: id.startsWith("retaliate") ? "retaliate" : "report",
        magnitude: noticed.severity,
        fuse: {
          due: g.world.clock + (noticed.severity >= 2 ? 8 : 20),
          expires: g.world.clock + 120,
        },
        status: "pending",
        data: { claim: noticed.id, to: MARA },
      },
    },
    cause,
  );
}

/** The player did something in front of people. One call: who cares, and what they say. */
export async function reactToDeed(
  g: Game,
  deed: Claim,
  seen: string[],
  cause: LogId,
): Promise<void> {
  const parts: NpcPart[] = [];
  const questions: Record<string, Asked> = {};
  const here = seen.filter((n) => g.world.actors[n]?.room === g.playerRoom);
  const bystanders = addBystanders(g, here, deed, parts, questions);
  for (const npc of seen.filter((n) => !here.includes(n))) owe(g, npc, deed, cause);
  if (bystanders.length === 0) return;
  const slice = compileSlice(sceneSlice, { world: g.world, parts });
  const decision = await g.decide(slice, questions, [], cause);
  if (!decision) return;
  settleBystanders(g, bystanders, deed, decision.answers, decision.id);
  g.speak((turn, id) => afterSpeech(g, turn, id));
}

/** Walking into a room is a stimulus. NPCs who have been quiet a while may speak first. */
export async function greetOnEntry(g: Game, cause: LogId): Promise<void> {
  const { beat, lastSpokeBeat } = g.world.conversation;
  const quiet = g.npcsIn(g.playerRoom).filter((n) => beat - (lastSpokeBeat[n] ?? -9) >= 6);
  if (quiet.length === 0) return;
  const room = g.world.rooms[g.playerRoom]?.name ?? "the room";
  const parts: NpcPart[] = [];
  const questions: Record<string, Asked> = {};
  const pools: Record<string, Reply[]> = {};
  for (const npc of quiet) {
    parts.push({ npc, extra: { hears: `The stranger has just walked into ${room}` } });
    const options = replies(g, npc, { kind: "entered" });
    pools[npc] = options;
    questions[`opens_${npc}`] = pickSpeechAct({
      npc: `npcs.${npc}`,
      options: options.map((o) => o.option),
      fallback: NONE,
    });
  }
  const decision = await g.decide(
    compileSlice(sceneSlice, { world: g.world, parts }),
    questions,
    [],
    cause,
  );
  if (!decision || decision.source === "fallback") return;
  for (const npc of quiet) {
    const chosen = g.sampleChoice(decision.answers[`opens_${npc}`], `${npc} opens`, decision.id);
    const reply = pools[npc]?.find((r) => r.option.id === chosen);
    if (reply) g.intent(npc, PLAYER, reply.act, reply.topic, 1, decision.id);
  }
  g.speak((turn, id) => afterSpeech(g, turn, id));
}

/** Words have consequences: a told claim is learned, a promise becomes a debt. */
export function afterSpeech(g: Game, turn: Turn, id: LogId): void {
  g.heard(turn, id);
  const { intent } = turn;
  if (intent.act !== "promise" || intent.topic.kind !== "request") return;
  const [request, whom] = intent.topic.id.split(":");
  const kind = request === "confront" ? "confront" : request === "speak_to_mara" ? "testify" : null;
  if (!kind) return;
  // One confrontation per person, whether she promised it or decided on it herself.
  const debtId = kind === "confront" ? `confront_${whom ?? ODO}` : `${kind}_${intent.speaker}`;
  if (g.world.debts[debtId]) return;
  g.commit(
    {
      kind: "create_debt",
      debt: {
        id: debtId,
        cause: id,
        stakeholder: intent.speaker,
        kind,
        magnitude: 3,
        fuse: { due: g.world.clock + 5, expires: g.world.clock + 150 },
        status: "pending",
        data: { to: kind === "confront" ? (whom ?? ODO) : MARA },
      },
    },
    id,
  );
}

/** Someone walked in on the player. In a room that is off limits, that is a deed seen. */
export async function npcArrives(g: Game, arrivals: string[], cause: LogId): Promise<void> {
  const here = arrivals.filter((n) => g.world.actors[n]?.room === g.playerRoom);
  if (here.length === 0) return;
  if (!RESTRICTED_ROOMS.includes(g.playerRoom)) {
    await greetOnEntry(g, cause);
    return;
  }
  const deed = makeClaim({
    subject: PLAYER,
    predicate: "was_near",
    place: g.playerRoom,
    when: g.world.clock,
    severity: 2,
    origin: cause,
  });
  for (const npc of here) g.learn(npc, deed, 1, { kind: "witnessed" }, cause);
  await reactToDeed(g, deed, here, cause);
}
