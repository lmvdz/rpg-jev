/**
 * Conversation. Player speech is parsed into the same structure NPCs use
 * (SPEC.md section 5): `{speaker, listener, act, topic}`. Raw player text is
 * seen by the parse questions and by nothing else. Every option list below is
 * built by code from the current world and includes a "none".
 */
import {
  type Actor,
  type Belief,
  beliefIn,
  beliefsOf,
  type Claim,
  type JudgeAnswer,
  type Lever,
  type LogId,
  makeClaim,
  persuadability,
  resolve,
  resolveBlow,
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
  IMPLICATES,
  MARA,
  NPCS,
  PLAYER,
  POWERS,
  RESTRICTED_ROOMS,
  TOBIN,
  TOBINS_DEBT,
  TRUST,
  WRONGDOING,
} from "./content.ts";
import type { Decision, Game } from "./game.ts";
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
import { canReact, promiseReaction } from "./reactions.ts";
import { type NpcPart, parseSlice, rankedBeliefs, sceneSlice, standing } from "./slices.ts";
import { cap, claimClause, feelingWords, nameOf, whenFor } from "./words.ts";

// --- Stage two of the parser: the judge --------------------------------------

const REQUEST_WORDS: Record<Request, string> = {
  speak_to_mara: "Go to Mara and tell her what they know or saw",
  confess: "Admit to what they did",
  keep_quiet: "Keep something quiet",
};

const SPEECH_VERBS = [
  "greet",
  "ask",
  "tell",
  "accuse",
  "offer",
  "threaten",
  "request",
  "promise",
  "insult",
  "remark",
];

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
    // What was lately said to the player's face can be asked about: who says so?
    ...saidToPlayer(g).map((c) => ({
      id: `source:${c.id}`,
      description: `who told them, or how they know, that ${claimClause(g.world, c).replace("the stranger", "the character")}`,
    })),
  ];
  return { statements, subjects };
}

/** Claims NPCs have put to the player in the last hour, newest first. */
function saidToPlayer(g: Game): Claim[] {
  const out: Claim[] = [];
  for (let i = g.log.length - 1; i >= 0 && out.length < 3; i--) {
    const e = g.log[i];
    if (!e || g.world.clock - e.t > 60) break;
    if (e.kind !== "effect" || e.effect.kind !== "say") continue;
    const { intent } = e.effect;
    if (intent.listener !== PLAYER || intent.topic.kind !== "claim") continue;
    const claim = g.world.claims[intent.topic.id];
    if (claim && !out.some((c) => c.id === claim.id)) out.push(claim);
  }
  return out;
}

function decodeTopic(id: string): PlayerTopic {
  const [kind, rest] = [id.slice(0, id.indexOf(":")), id.slice(id.indexOf(":") + 1)];
  if (id === "deny") return { kind: "deny" };
  if (id === "alibi") return { kind: "alibi" };
  if (kind === "claim") return { kind: "claim", id: rest };
  if (kind === "blame") return { kind: "blame", npc: rest };
  if (kind === "about") return { kind: "entity", id: rest };
  if (kind === "where") return { kind: "whereabouts", id: rest };
  if (kind === "source") return { kind: "claim", id: rest };
  return { kind: "none" };
}

const top = (a: JudgeAnswer | undefined) =>
  a?.type === "choice"
    ? { id: a.choice, p: a.probabilities[a.choice] ?? 0, all: a.probabilities }
    : null;

type TopAnswer = ReturnType<typeof top>;
type VerbTop = NonNullable<TopAnswer>;

/** Reads the judge's verb choice from the decision, or explains why the line went nowhere. */
function readVerb(decision: Decision): VerbTop | Matched {
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
  return verb;
}

/** Picks from a pool by mass on the target question, or asks a question naming the rivals. */
function pickTarget(target: TopAnswer, pool: readonly Named[], needed: number): Named | Matched {
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
}

const clarifyCandidates = (
  found: Matched,
  word: string,
  complete: (id: string) => Action,
): Matched =>
  found.kind === "clarify"
    ? { ...found, question: whichOne(word, found.candidates), complete }
    : found;

const isNamed = (x: Named | Matched): x is Named => "aliases" in x;

function buildPlainAction(verbId: string, itemId: string | null): (id: string) => Action {
  if (verbId === "take") return (id) => ({ verb: "take", item: id });
  if (verbId === "drop") return (id) => ({ verb: "drop", item: id });
  if (verbId === "go") return (id) => ({ verb: "go", room: id });
  if (verbId === "use") return (id) => ({ verb: "use", target: id, item: itemId });
  return (id) => ({ verb: "examine", target: id });
}

/**
 * Who speech or an attack is aimed at. Violence is not undone by an apology, so it needs a
 * clearer reading than the rest. A name the player typed settles who is meant, whatever the
 * judge's spread (first playtest: "who told you that mara" asked "Mara or Odo?"). With one
 * person in the room, speech is to them. With several and no name, ask which, naming them.
 */
function resolveSpeechTarget(
  scope: { people: Named[] },
  text: string,
  target: TopAnswer,
  verbId: string,
): Named | Matched {
  const said = ` ${text.toLowerCase().replace(/[^a-z ]+/g, " ")} `;
  const byName = scope.people.filter((p) => said.includes(` ${p.name.toLowerCase()} `));
  const judged = pickTarget(target, scope.people, verbId === "attack" ? 0.8 : 0.6);
  const alone = scope.people.length === 1 && verbId !== "attack" ? scope.people[0] : undefined;
  if (byName.length === 1 && byName[0]) return byName[0];
  if (isNamed(judged)) return judged;
  if (alone) return alone;
  if (judged.kind === "error" && scope.people.length >= 2)
    return {
      kind: "clarify",
      question: "",
      candidates: [...scope.people],
      complete: () => ({ verb: "look" }),
    };
  return judged;
}

function buildSpeechAction(
  verbId: string,
  itemId: string | null,
  topic: PlayerTopic,
  request: Request | null,
): (to: string) => Action {
  return (to: string): Action => {
    if (verbId === "attack") return { verb: "attack", target: to };
    if (verbId === "show" && itemId) return { verb: "show", item: itemId, to };
    if (verbId === "give" && itemId) return { verb: "give", item: itemId, to, topic };
    const act = (verbId === "give" || verbId === "show" ? "offer" : verbId) as SpeechAct;
    return { verb: "say", act, to, topic, item: itemId, request };
  };
}

/** No content to what was said: ask which, naming what the player could say instead. */
function emptyStatementClarify(
  g: Game,
  found: Named,
  statements: Option[],
  topicAnswer: TopAnswer,
  verbId: string,
): Matched {
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
      act: verbId as SpeechAct,
      to: found.id,
      topic: decodeTopic(id),
      item: null,
      request: null,
    }),
  };
}

function matchSpeechVerb(
  g: Game,
  scope: { people: Named[] },
  text: string,
  verb: VerbTop,
  target: TopAnswer,
  itemId: string | null,
  topic: PlayerTopic,
  topicAnswer: TopAnswer,
  request: Request | null,
  statements: Option[],
): Matched {
  const found = resolveSpeechTarget(scope, text, target, verb.id);
  const build = buildSpeechAction(verb.id, itemId, topic, request);
  // A statement with no recognisable content: ask which, naming what the player could say.
  const empty = topic.kind === "none" && !itemId && !request;
  // The judge is sure the line asserts nothing the world knows of. Offering four claims to
  // pick from would put words in the player's mouth, so it is a remark and nothing more.
  const nothingListed = topicAnswer?.id === NONE && topicAnswer.p >= 0.6;
  if (isNamed(found) && empty && verb.id === "tell" && nothingListed)
    return {
      kind: "action",
      action: { verb: "say", act: "remark", to: found.id, topic, item: null, request: null },
    };
  if (isNamed(found) && empty && (verb.id === "tell" || verb.id === "accuse"))
    return emptyStatementClarify(g, found, statements, topicAnswer, verb.id);
  if (isNamed(found)) return { kind: "action", action: build(found.id) };
  if (found.kind === "error" && scope.people.length === 0)
    return { kind: "error", message: "There is nobody here to hear you." };
  return clarifyCandidates(found, verb.id === "attack" ? "attack" : "speak to", build);
}

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

  const verb = readVerb(decision);
  if (!("id" in verb)) return verb;

  const target = top(decision.answers.target);
  if (target?.id.startsWith("absent:") && target.p >= 0.5) {
    const who = g.world.actors[target.id.slice(7)]?.name ?? "They";
    return { kind: "error", message: `${who} is not here.` };
  }

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
  )
    return matchSpeechVerb(
      g,
      scope,
      text,
      verb,
      target,
      itemId,
      topic,
      topicAnswer,
      request,
      statements,
    );

  if (verb.id === "wait") return { kind: "action", action: { verb: "wait", minutes: 10 } };
  const pools: Record<string, [readonly Named[], string]> = {
    take: [scope.things, "take"],
    drop: [scope.carried, "drop"],
    examine: [[...scope.things, ...scope.carried, ...scope.people, ...scope.rooms], "look at"],
    go: [scope.exits, "go to"],
    use: [scope.exits, "unlock"],
  };
  const [pool, word] = pools[verb.id] ?? [[], ""];
  const found = pickTarget(target, pool, 0.6);
  const build = buildPlainAction(verb.id, itemId);
  if (isNamed(found)) return { kind: "action", action: build(found.id) };
  return clarifyCandidates(found, word, build);
}

// --- What an NPC could say: closed option sets built from their beliefs -------

interface Reply {
  option: Option;
  act: SpeechAct;
  topic: SpeechIntent["topic"];
  /** A reply that is a deed, not words. Code carries it out (see `doDeed`). */
  deed?: "throw_out" | "strike" | "walk_out";
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

/** What someone holds that points at a third person: what speaking up would carry. */
export const keptBack = (g: Game, holder: string, notAbout: string[]): Belief | undefined =>
  rankedBeliefs(g.world, holder).find(
    (b) =>
      b.credence >= 0.4 &&
      b.claim.subject !== holder &&
      !notAbout.includes(b.claim.subject) &&
      IMPLICATES.includes(b.claim.predicate),
  );

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

/** The phrasing for repeating a held claim back, by how it is delivered. */
function claimDescription(g: Game, npc: string, act: SpeechAct, clause: string): string {
  if (act === "confide")
    return `Quietly confides to the stranger that ${clause}, which ${nameOf(g.world, npc)} has kept back until now`;
  if (act === "accuse") return `Says to the stranger's face that ${clause}`;
  return `Tells the stranger that ${clause}`;
}

function claimReply(g: Game, npc: string, act: SpeechAct, b: Belief): Reply {
  const clause = `${claimClause(g.world, b.claim)}${whenFor(b.claim, g.world.clock)}`;
  const description = claimDescription(g, npc, act, clause);
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
const RETORT = plain("retort", "insult", "Gives the stranger as good as they got, to their face");
const WALK_OUT: Reply = {
  option: { id: "walk_out", description: "Turns their back and leaves the room" },
  act: "refuse",
  topic: { kind: "none" },
  deed: "walk_out",
};
const STRIKE: Reply = {
  option: { id: "strike", description: "Hits the stranger" },
  act: "threaten",
  topic: { kind: "none" },
  deed: "strike",
};
/** Only the one whose house it is can put someone out of it. A role is a power, not a name. */
const THROW_OUT: Reply = {
  option: {
    id: "throw_out",
    description: "Puts the stranger out of the house, into the rain, tonight",
  },
  act: "threaten",
  topic: { kind: "none" },
  deed: "throw_out",
};

type Situation =
  | { kind: "greeted" }
  | { kind: "entered" }
  | { kind: "remarked" }
  | { kind: "denied" }
  | { kind: "threatened" }
  | { kind: "insulted" }
  | { kind: "interject" }
  | { kind: "asked"; about: string | null; whereabouts: boolean; claim?: Claim }
  | { kind: "told"; believes: boolean; claim: Claim; shown?: boolean }
  | { kind: "accused"; alone: boolean };

function repliesToGreeting(
  g: Game,
  npc: string,
  s: Extract<Situation, { kind: "greeted" | "entered" | "remarked" }>,
  accuse: Reply[],
): Reply[] {
  const out: Reply[] = [];
  // A remark gets no hello back. They may take the opening, or let it lie.
  if (s.kind !== "remarked") out.push(GREET);
  out.push(...accuse);
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
  return out;
}

function repliesToAsk(g: Game, npc: string, s: Extract<Situation, { kind: "asked" }>): Reply[] {
  const out: Reply[] = [];
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
    // Asked about a particular claim: say it again with where it came from. The
    // citation is the answer to "who told you that?".
    const asked = s.claim ? beliefIn(g.world, npc, s.claim.id) : undefined;
    if (asked && asked.credence >= 0.15 && !guarded(g, npc, asked.claim))
      out.push(claimReply(g, npc, "tell", asked));
    const relevant = held(g, npc, about ?? undefined).filter(
      (b) => !about || mentions(b.claim, about),
    );
    const open = relevant.filter((b) => !guarded(g, npc, b.claim) && b.claim.predicate !== "is_in");
    // Their own wrongdoing stays buried; what they owe is only embarrassing.
    const secret = relevant.filter(
      (b) => guarded(g, npc, b.claim) && (b.claim.subject !== npc || b.claim.predicate === "owes"),
    );
    out.push(...open.slice(0, 2).map((b) => claimReply(g, npc, "tell", b)));
    out.push(...secret.slice(0, 1).map((b) => claimReply(g, npc, "confide", b)));
    if (open.length + secret.length === 0)
      out.push(plain("tell_nothing", "tell", "Says they know nothing about it"));
  }
  out.push(REFUSE, ASK_WHY);
  return out;
}

/** What the doubter asks, once told and not believed: where from, who vouches, or how. */
function doubtedReply(s: Extract<Situation, { kind: "told" }>): Reply {
  if (s.shown) return ASK_WHERE_FROM;
  if (s.claim.subject === PLAYER) return ASK_VOUCH;
  return ASK_HOW;
}

function repliesToTold(
  g: Game,
  npc: string,
  s: Extract<Situation, { kind: "told" }>,
  accuse: Reply[],
): Reply[] {
  const out: Reply[] = [];
  if (!s.believes) {
    out.push(...accuse, REFUSE, doubtedReply(s));
    return out;
  }
  out.push(s.shown ? ASK_WHERE_FROM : ASK_HOW);
  if (canReact(g, npc, "have_it_out") && s.claim.subject !== PLAYER && s.claim.subject !== npc)
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
  if (more) out.push(claimReply(g, npc, guarded(g, npc, more.claim) ? "confide" : "tell", more));
  out.push(REFUSE);
  return out;
}

function repliesToDenial(npc: string, accuse: Reply[]): Reply[] {
  const out = [...accuse, REFUSE];
  if (npc === MARA)
    out.push(plain("ask_dusk", "ask", "Asks the stranger where they were at dusk, then", "dusk"));
  return out;
}

function repliesToAccusation(
  g: Game,
  npc: string,
  s: Extract<Situation, { kind: "accused" }>,
  accuse: Reply[],
): Reply[] {
  const out = [...accuse, REFUSE, THREATEN];
  const own = held(g, npc).find((b) => b.claim.subject === npc && b.claim.predicate === "took");
  if (own) out.push(claimReply(g, npc, "confide", own));
  if (s.alone)
    out.push(plain("offer", "offer", "Quietly offers the stranger money to let the matter drop"));
  return out;
}

function repliesToInsult(g: Game, npc: string): Reply[] {
  // Words are not the only answer to an insult. What the judge may choose from is
  // built from what this person can do; what they will do is the judge's.
  const out = [REFUSE, RETORT, THREATEN, WALK_OUT, STRIKE];
  if (POWERS[g.world.actors[npc]?.role ?? ""]?.includes("throw_out")) out.push(THROW_OUT);
  return out;
}

function repliesFor(g: Game, npc: string, s: Situation, accuse: Reply[]): Reply[] {
  switch (s.kind) {
    case "greeted":
    case "remarked":
    case "entered":
      return repliesToGreeting(g, npc, s, accuse);
    case "asked":
      return repliesToAsk(g, npc, s);
    case "told":
      return repliesToTold(g, npc, s, accuse);
    case "denied":
      return repliesToDenial(npc, accuse);
    case "accused":
      return repliesToAccusation(g, npc, s, accuse);
    case "threatened":
      return [REFUSE, THREATEN, ...accuse];
    case "insulted":
      return repliesToInsult(g, npc);
    case "interject":
      return [...accuse, THREATEN];
  }
}

function replies(g: Game, npc: string, s: Situation): Reply[] {
  const accusation = againstStranger(g, npc);
  const accuse = accusation ? [claimReply(g, npc, "accuse", accusation)] : [];
  const out = repliesFor(g, npc, s, accuse);
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
  insult: "insults",
  remark: "passes a remark to",
  request: "asks a favour of",
  promise: "makes a promise to",
};

type Say = Extract<Action, { verb: "say" }>;

/** What the speaker offers to lean on, when bargaining: fear, money, or nothing but goodwill. */
function leverFor(action: Say): Lever {
  if (action.act === "threaten") return "threat";
  if (action.item) return "payment";
  return "appeal";
}

function coinsOffer(g: Game, npc: string): string {
  if (npc === TOBIN && beliefIn(g.world, PLAYER, C_TOBIN_OWES.id))
    return "enough silver to clear everything Tobin owes Odo, paid now";
  return "a handful of silver, paid now";
}

/** What is being offered, in the offer premise the judge reads. */
function givesFor(g: Game, npc: string, action: Say): string {
  if (action.act === "threaten") return "not being hurt";
  if (action.item === COINS) return coinsOffer(g, npc);
  if (action.item) return g.world.items[action.item]?.name ?? "something";
  return "nothing but thanks";
}

/** The "you ask NPC ___" clause: what the question is about, in the player's own words. */
function askClause(g: Game, npc: string, topic: PlayerTopic, asserted: Claim | null): string {
  if (topic.kind === "whereabouts") return `where ${nameOf(g.world, topic.id)} is`;
  if (topic.kind === "entity" && topic.id !== npc && topic.id !== "tonight")
    return `about ${nameOf(g.world, topic.id)}`;
  if (topic.kind === "claim" && asserted)
    return `whether ${claimClause(g.world, asserted, { listener: npc })}`;
  return "what they know";
}

/** Which situation to build replies for, when there is no belief question to ask first. */
function situationFor(
  toFace: boolean,
  action: Say,
  topic: PlayerTopic,
  asserted: Claim | null,
  shown: string | null,
  others: string[],
  about: string | undefined,
): Situation {
  if (toFace) return { kind: "accused", alone: others.length === 0 };
  if (action.act === "ask")
    return {
      kind: "asked",
      about: about ?? null,
      whereabouts: topic.kind === "whereabouts",
      ...(asserted ? { claim: asserted } : {}),
    };
  if (action.act === "threaten") return { kind: "threatened" };
  if (action.act === "insult") return { kind: "insulted" };
  if (action.act === "remark") return { kind: "remarked" };
  if (topic.kind === "deny") return { kind: "denied" };
  if (asserted) return { kind: "told", believes: true, claim: asserted, shown: shown !== null };
  return { kind: "greeted" };
}

/** What was said, as structure: the claim asserted, the deed noticed, and what was shown. */
function buildAsserted(
  g: Game,
  action: Say,
  npc: string,
  name: string,
  root: LogId,
  handOver: boolean,
): { asserted: Claim | null; event: Claim | null; shown: string | null } {
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
  return { asserted, event, shown };
}

/** Narrates the act itself, in the second person; threatening and insulting are deeds too. */
function narrateAct(
  g: Game,
  action: Say,
  npc: string,
  name: string,
  topic: PlayerTopic,
  asserted: Claim | null,
  shown: string | null,
  event: Claim | null,
  root: LogId,
): Claim | null {
  if (action.act === "threaten") {
    g.say(`You lean in close to ${name} and make yourself understood.`);
    return g.happened({ subject: PLAYER, predicate: "threatened", to: npc, severity: 2 }, root);
  }
  if (action.act === "insult") {
    // An insult is a deed like any other: the room sees it, remembers it and may pass it on.
    g.say(`You tell ${name} exactly what you think of them.`);
    return g.happened({ subject: PLAYER, predicate: "insulted", to: npc, severity: 1 }, root);
  }
  if (action.act === "remark") g.say(`You say your piece to ${name}.`);
  else if (asserted && !shown) {
    // Narration addresses the player, so the player is "you" and the listener is named.
    const clause = claimClause(g.world, asserted, { listener: PLAYER });
    const face = asserted.subject === npc;
    g.say(face ? `You say it to ${name}'s face: ${clause}.` : `You tell ${name} that ${clause}.`);
  } else if (action.act === "greet") g.say(`You greet ${name}.`);
  else if (action.act === "ask") g.say(`You ask ${name} ${askClause(g, npc, topic, asserted)}.`);
  return event;
}

/** What the room is told the listener hears: the claim, its source, and what backs it. */
function buildHears(
  g: Game,
  npc: string,
  name: string,
  action: Say,
  asserted: Claim | null,
  shown: string | null,
  topic: PlayerTopic,
  about: string | undefined,
  inFrontOf: string,
): Record<string, string> {
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
  return hears;
}

function buildParts(
  g: Game,
  npc: string,
  hears: Record<string, string>,
  bargaining: boolean,
  gives: string,
  asks: string,
  about: string | undefined,
): NpcPart[] {
  const extra: NpcPart["extra"] = { hears };
  if (bargaining) extra.offer = { from: relation(g, npc, PLAYER), gives, asks };
  return [{ npc, extra, ...(about ? { about } : {}) }];
}

interface ReplyQuestions {
  questions: Record<string, Asked>;
  single: Reply[];
  ifYes: Reply[];
  ifNo: Reply[];
}

/** The questions asked of the listener: whether to accept an offer, whether to believe a
 * claim (with a reply prepared for either answer), or which single reply fits. */
function buildReplyQuestions(
  g: Game,
  npc: string,
  name: string,
  listener: Actor,
  action: Say,
  asserted: Claim | null,
  shown: string | null,
  topic: PlayerTopic,
  toFace: boolean,
  others: string[],
  about: string | undefined,
  hears: Record<string, string>,
  bargaining: boolean,
  root: LogId,
): ReplyQuestions {
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
    questions.accepts = acceptOffer(
      `npcs.${npc}`,
      persuadability(listener, leverFor(action), 0.5) * 0.8,
    );
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
    single = replies(g, npc, situationFor(toFace, action, topic, asserted, shown, others, about));
    questions.reply = speechQuestion(g, npc, single);
  }
  return { questions, single, ifYes, ifNo };
}

interface SpeechSetup {
  questions: Record<string, Asked>;
  parts: NpcPart[];
  single: Reply[];
  ifYes: Reply[];
  ifNo: Reply[];
  bargaining: boolean;
}

/** One call for the whole scene: the listener's judgments and every bystander's, built as a
 * closed option set from beliefs, drives and what was shown. */
function buildSpeechSetup(
  g: Game,
  npc: string,
  name: string,
  listener: Actor,
  action: Say,
  others: string[],
  asserted: Claim | null,
  shown: string | null,
  topic: PlayerTopic,
  toFace: boolean,
  root: LogId,
): SpeechSetup {
  const inFrontOf =
    others.length > 0 ? others.map((o) => nameOf(g.world, o)).join(" and ") : "nobody else";
  const bargaining = Boolean(
    action.act === "offer" ||
      action.act === "request" ||
      (action.act === "threaten" && action.request),
  );
  const gives = givesFor(g, npc, action);
  const asks = action.request ? REQUEST_WORDS[action.request].toLowerCase() : "something unclear";

  const named =
    topic.kind === "entity" || topic.kind === "whereabouts" ? topic.id : asserted?.subject;
  // "Ask Tobin what he saw" is about tonight, not about Tobin.
  const about = named === "tonight" || (action.act === "ask" && named === npc) ? undefined : named;
  const hears = buildHears(g, npc, name, action, asserted, shown, topic, about, inFrontOf);
  const parts = buildParts(g, npc, hears, bargaining, gives, asks, about);
  const { questions, single, ifYes, ifNo } = buildReplyQuestions(
    g,
    npc,
    name,
    listener,
    action,
    asserted,
    shown,
    topic,
    toFace,
    others,
    about,
    hears,
    bargaining,
    root,
  );

  return { questions, parts, single, ifYes, ifNo, bargaining };
}

/** Commits what followed, in code: belief, bargain, reply and bystander reactions. */
function commitSpeechOutcome(
  g: Game,
  npc: string,
  action: Say,
  asserted: Claim | null,
  shown: string | null,
  event: Claim | null,
  setup: SpeechSetup,
  decision: Decision,
  bystanders: { npc: string; options: Reply[] }[],
  noticed: Claim | null,
): void {
  if (event) g.witness(event, g.playerRoom, decision.id);
  let pool = setup.single;
  let answer = decision.answers.reply;
  if (setup.questions.believes && asserted) {
    const believed = g.sampleYes(decision.answers.believes, `${npc} believes`, decision.id);
    const source = shown
      ? ({ kind: "shown", from: PLAYER } as const)
      : ({ kind: "told", from: PLAYER } as const);
    g.learn(npc, asserted, g.credenceFor(source, believed), source, decision.id);
    if (believed) g.nudge(npc, { trust: 0.05 }, decision.id);
    pool = believed ? setup.ifYes : setup.ifNo;
    answer = believed ? decision.answers.reply_if_believes : decision.answers.reply_if_doubts;
  }
  if (setup.bargaining) bargain(g, action, decision.answers.accepts, decision.id);
  else {
    const chosen = g.sampleChoice(answer, `${npc} reply`, decision.id);
    const reply = pool.find((r) => r.option.id === chosen);
    if (reply?.deed) doDeed(g, npc, reply.deed, decision.id);
    else if (reply) g.intent(npc, PLAYER, reply.act, reply.topic, 3, decision.id);
    else g.say(silence(g.world, npc));
  }
  settleBystanders(g, bystanders, noticed, decision.answers, decision.id);
}

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
  const { topic } = action;

  // 1. What was said, as structure. The text itself stopped at the parser.
  const built = buildAsserted(g, action, npc, name, root, handOver);
  const { asserted, shown } = built;
  let event = narrateAct(g, action, npc, name, topic, asserted, shown, built.event, root);
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
  const setup = buildSpeechSetup(
    g,
    npc,
    name,
    listener,
    action,
    others,
    asserted,
    shown,
    topic,
    toFace,
    root,
  );
  const noticed = event ?? asserted;
  const bystanders = noticed ? addBystanders(g, others, noticed, setup.parts, setup.questions) : [];
  const slice = compileSlice(sceneSlice, { world: g.world, parts: setup.parts });
  const present = [npc, ...others].map((n) => ({
    kind: "in_room" as const,
    actor: n,
    room: g.playerRoom,
  }));
  const decision = await g.decide(slice, setup.questions, present, root);
  if (!decision) {
    g.say(`${name} is no longer listening.`);
    return 1;
  }

  // 3. Commit what followed, in code.
  commitSpeechOutcome(g, npc, action, asserted, shown, event, setup, decision, bystanders, noticed);
  g.speak((turn, id) => afterSpeech(g, turn, id));
  return 3;
}

/** A reply that is done rather than said. Every number here is code. */
export function doDeed(g: Game, npc: string, deed: NonNullable<Reply["deed"]>, cause: LogId): void {
  const name = nameOf(g.world, npc);
  if (deed === "walk_out") {
    const exits = g.world.rooms[g.playerRoom]?.exits.filter((e) => !e.door) ?? [];
    const to = exits[0]?.to;
    if (!to) return;
    g.say(`${name} looks at you, turns, and walks out.`);
    g.commit(
      {
        kind: "apply_override",
        group: [npc],
        entry: {
          id: `walked_out_${cause}`,
          activity: "keeping_clear",
          at_location: to,
          at: g.world.clock,
          until: g.world.clock + 30,
          cause: null,
        },
      },
      cause,
    );
    g.commit({ kind: "move", actor: npc, to, activity: "keeping_clear" }, cause);
    return;
  }
  if (deed === "throw_out") {
    if (g.world.actors[npc]?.room === g.playerRoom)
      g.say(`${name} takes you by the collar and walks you to the yard door. It is still raining.`);
    g.commit(
      { kind: "set_node", target: { type: "machine", id: "quest" }, to: "thrown_out" },
      cause,
    );
    return;
  }
  const blow = resolveBlow(
    g.store.draw("npc hit", cause),
    g.store.draw("npc damage", cause),
    false,
  );
  g.say(
    blow.hit ? `${name} hits you, hard, before you can move.` : `${name} swings at you and misses.`,
  );
  if (blow.hit) g.commit({ kind: "damage", target: PLAYER, amount: blow.damage }, cause);
  const struck = g.happened(
    { subject: npc, predicate: "attacked", to: PLAYER, severity: 2 },
    cause,
  );
  g.witness(struck, g.playerRoom, cause, [npc]);
  if ((g.world.actors[PLAYER]?.hp ?? 1) <= 0) {
    g.say("The floor comes up to meet you.");
    g.commit(
      { kind: "set_node", target: { type: "machine", id: "quest" }, to: "thrown_out" },
      cause,
    );
  }
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
  const outcome = resolve(accepted, persuadability(actor, leverFor(action), answer.noul));
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

/** Whoever in the house has powers over it: the one a tale is carried to. */
const keeperOf = (g: Game): string | undefined =>
  NPCS.find((n) => (POWERS[g.world.actors[n]?.role ?? ""]?.length ?? 0) > 0);

/** A witness with a stake carries the tale to whoever runs the house, or gets even if it was done to them. */
export function owe(g: Game, npc: string, noticed: Claim, cause: LogId): void {
  const keeper = keeperOf(g);
  if (!keeper || npc === keeper) return;
  const wronged = noticed.to === npc;
  const id = `${wronged ? "retaliate" : "report"}_${npc}_${noticed.id}`;
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
        data: { claim: noticed.id, to: keeper },
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
  // One confrontation per person, whether it was promised aloud or decided on alone: a
  // promised reaction is the same debt the belief would have left.
  if (request === "confront" && whom) {
    promiseReaction(g, intent.speaker, "have_it_out", whom, 5, id);
    return;
  }
  if (request !== "speak_to_mara") return;
  const debtId = `testify_${intent.speaker}`;
  if (g.world.debts[debtId]) return;
  g.commit(
    {
      kind: "create_debt",
      debt: {
        id: debtId,
        cause: id,
        stakeholder: intent.speaker,
        kind: "testify",
        magnitude: 3,
        fuse: { due: g.world.clock + 5, expires: g.world.clock + 150 },
        status: "pending",
        data: { to: MARA },
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
