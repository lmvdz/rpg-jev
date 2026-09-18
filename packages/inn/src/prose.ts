/**
 * Text is rendering (SPEC.md rule 6). No model writes prose while the game
 * runs: everything the player reads is a template here, filled from
 * structured state. Variants are chosen by a hash of the thing being
 * rendered, never by the world's RNG, so prose cannot change world state.
 */
import {
  type Actor,
  type BeliefSource,
  beliefIn,
  hashText,
  type SpeechIntent,
  type Turn,
  type World,
} from "@rpg-jev/core";
import { MARA, ODO, PLAYER, TOBIN } from "./content.ts";
import { isVisible } from "./parser.ts";
import { ACTIVITY, cap, claimClause, nameOf, theirOf, whenFor } from "./words.ts";

export const INTRO = [
  "THE GILDED CARP",
  "",
  "You came in out of the rain this afternoon, paid for a bed, and slept. When you came down at",
  "dusk the ford had gone under and the mood in the common room had gone with it. The inn's",
  "account ledger is missing from the office. The crown's assessor arrives at first light to",
  "read it, and an inn that cannot show its ledger is taxed at his pleasure.",
  "",
  "Nobody has said it to your face yet. But you were the only stranger in the house, and the",
  "innkeeper has not taken her eyes off you since you sat down.",
  "",
  "(Type help for commands. Plain verbs always work; anything else, say it as you would.)",
].join("\n");

const ROOMS: Record<string, string> = {
  common_room:
    "The common room: a low ceiling black with smoke, a long bar, a hearth losing its fight with the damp. Rain ticks at the shutters. The office door stands beside the stairs, an arch leads to the kitchen, and the yard door rattles in its frame.",
  kitchen:
    "The kitchen is all heat and onions. A pot the size of a font hangs over the hearth. A coat hangs on a peg, and beside the cellar door there is a hook for keys. A back door gives onto the yard.",
  cellar:
    "Cold, and the smell of earth and old beer. Casks line one wall, sacks the other. A flour barrel stands at the foot of the steps.",
  office:
    "A cramped room: a desk, a strongbox standing open and empty, a small window onto the yard.",
  yard: "Rain falls steadily on the cobbles. The stable stands open, warm with the breath of horses, and a lantern swings under the eave. Doors lead to the common room and the kitchen.",
};

const ITEM_LOOKS: Record<string, string> = {
  iron_key: "A heavy iron key, cold and a little greasy. Cellar work.",
  brass_key: "A small brass key, worn bright. It would fit a room door or a desk.",
  coat: "Odo's coat, good cloth gone shiny at the elbows.",
  markers:
    "Six clay gambling markers from a river boat, each scratched with a sum and the initials O.B. Together they come to more than a cook earns in a year.",
  barrel: "A flour barrel, lid askew. The flour inside has been disturbed and patted flat again.",
  ledger:
    "The inn's account ledger, two years of Mara's careful hand. Here and there the kitchen purchases have been gone over in a different ink.",
  apron:
    "A cook's apron, stiff with flour. The initials O.B. are stitched inside the hem. The ledger was wrapped in it.",
  latch:
    "The window latch has been slipped from outside with something thin; the wood is freshly scored. There is a dusting of flour on the sill.",
  strongbox:
    "Open, and empty where the ledger should be. The lock was not forced: someone came in another way.",
  pot: "A pot the size of a font, black outside and full of something brown and hot. It smells better than it looks.",
  bread: "A heel of yesterday's loaf, hard at the edge and fine in the middle.",
  table: "A long oak board on trestles, scarred by forty years of knives and elbows.",
  bench:
    "A bench worn smooth where the same backsides have sat for a generation. The end nearest the hearth is the good end.",
  hearth:
    "The hearth: a bed of embers, one log fighting the damp, and a kettle hook nobody has used tonight.",
  straw: "A heap of straw under the eaves, dry enough, and warmer than it looks.",
  tankard: "Pewter, dented, half full of something brown.",
};

export const lookAtItem = (id: string) => ITEM_LOOKS[id] ?? "Nothing remarkable.";

const NPC_LOOKS: Record<string, string> = {
  [MARA]:
    "Mara Venn: fifty, straight-backed, sleeves rolled. She watches the room the way other people watch a pot.",
  [ODO]: "Odo Brask: broad, pink, quick with a grin. His hands are never still.",
  [TOBIN]:
    "Tobin Reed: a thin young man with straw in his hair who looks at your boots when you look at him.",
};

export const lookAtPerson = (id: string) => NPC_LOOKS[id] ?? "Nobody you know.";
export const lookAtRoom = (id: string) => ROOMS[id] ?? "A room.";

function list(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

export function describeRoom(world: World): string {
  const here = world.actors[PLAYER]?.room ?? "";
  const lines = [ROOMS[here] ?? "A room."];
  for (const a of Object.values(world.actors))
    if (a.kind === "npc" && a.present && a.alive && a.room === here)
      lines.push(`${a.name} is here, ${ACTIVITY[a.activity] ?? a.activity}.`);
  const things = Object.values(world.items).filter((i) => {
    if (!(isVisible(world, i.id) && i.takeable)) return false;
    if ("room" in i.at) return i.at.room === here;
    if ("inside" in i.at) {
      const holder = world.items[i.at.inside];
      return Boolean(holder && "room" in holder.at && holder.at.room === here);
    }
    return false;
  });
  if (things.length > 0) lines.push(`You see ${list(things.map((t) => t.name))}.`);
  const exits = (world.rooms[here]?.exits ?? []).map((e) => {
    const locked = e.door !== undefined && world.machines[e.door]?.node === "locked";
    return `${world.rooms[e.to]?.name ?? e.to}${locked ? " (locked)" : ""}`;
  });
  lines.push(`From here: ${list(exits)}.`);
  return lines.join("\n");
}

// --- Speech -------------------------------------------------------------------

const choose = <T>(variants: readonly T[], key: string): T =>
  variants[Number.parseInt(hashText(key).slice(0, 6), 16) % variants.length] as T;

/** How a speaker introduces a claim, from where they got it. This is the cause made visible. */
function cite(world: World, source: BeliefSource | undefined): string {
  if (!source || source.kind === "inferred") return "I say";
  if (source.kind === "witnessed") return "I saw it myself:";
  if (source.from === PLAYER) return "You said yourself that";
  const from = nameOf(world, source.from);
  return source.kind === "shown" ? `${from} showed me that` : `${from} tells me`;
}

type Lines = Partial<Record<SpeechIntent["act"], readonly string[]>>;

/** {c} is the claim in the listener's voice, {cite} where it came from, {n} the listener. */
const VOICE: Record<string, Lines> = {
  [MARA]: {
    greet: ["What'll it be.", "You again. Well?", "Evening. Such as it is."],
    ask: [
      "Where were you at dusk? And don't tell me about the rain.",
      "What's your interest in {topic}?",
      "How do you come to know that?",
    ],
    tell: ["{cite} {c} {when}.", "Hear this, then. {cite} {c} {when}."],
    accuse: [
      "{cite} {c} {when}. Look at me and tell me otherwise.",
      "I'll say it plain. {cite} {c} {when}.",
    ],
    confide: ["This stays at this bar. {cite} {c} {when}."],
    refuse: ["I've nothing to say to you about that.", "No. And don't ask me twice."],
    threaten: ["One more word like that and you sleep in the ford."],
    insult: ["I have had better manners from the pig."],
    remark: ["Hm.", "That's as may be."],
    offer: ["Put my ledger on this bar by midnight and there's no more said. That's the offer."],
    promise: ["I'll look into it. Tonight.", "I'll have that out with him myself. Tonight."],
    request: ["Turn out your pack. Now, on the bar, where I can see it."],
  },
  [TOBIN]: {
    greet: ["Evening.", "Oh. It's... evening.", "Horses are settled, if that's what you're after."],
    ask: ["Why... why d'you want to know?", "What's it to you? Begging your pardon."],
    tell: ["{cite} {c} {when}. That's all I know.", "Well... {cite} {c} {when}."],
    accuse: ["I... {cite} {c} {when}. I did. I'm sorry, but I did."],
    confide: [
      "Not so loud. {cite} {c} {when}. I've told nobody. Don't say it came from me.",
      "I shouldn't... {cite} {c} {when}. There. It's said.",
    ],
    refuse: ["It's not my place to say.", "I don't... no. I can't. Sorry."],
    threaten: ["You stay back. I'll shout for her, I will."],
    insult: ["You... you're no better. Everyone says so."],
    remark: ["Aye. I suppose.", "If you say so."],
    offer: ["I've nothing to give you. I wish I had."],
    promise: ["I'll tell her. I will. Just... let me find the words."],
    request: ["Leave it be. Please."],
  },
  [ODO]: {
    greet: [
      "Friend! Sit, eat. Terrible business about the ledger, terrible.",
      "There he is. Stew's hot, the night's foul, what more could a man want?",
      "Ah, our guest. Hungry? You look hungry.",
    ],
    ask: ["Now why would a traveller care about {topic}?", "And who's been filling your ears, eh?"],
    tell: ["Well now. {cite} {c} {when}, friend.", "Between us? {cite} {c} {when}."],
    accuse: [
      "No offence, friend, but {cite} {c} {when}. A man notices.",
      "Funny thing. {cite} {c} {when}. I only mention it.",
    ],
    confide: ["All right. All right. {cite} {c} {when}. Happy? Keep your voice down."],
    refuse: ["Ha! I've a pot to mind.", "Can't hear you over the onions, friend."],
    threaten: ["Careful. Knives are sharp in a kitchen, and floors are slippery."],
    insult: ["Big words from a man who sleeps in a borrowed bed."],
    remark: ["Ha! Isn't that the truth.", "So they say, friend, so they say."],
    offer: ["There's silver in it if you let this lie. Not much. Enough."],
    promise: ["Of course, of course. Leave it with me."],
    request: ["Do an old cook a kindness and keep out of my kitchen."],
  },
};

const MANNER: Record<string, string> = {
  [MARA]: "says",
  [TOBIN]: "mumbles",
  [ODO]: "says, grinning",
};

const TOPIC_NAMES: Record<string, string> = { ledger: "my ledger" };

/** Whether someone has words of their own for a request. Content checks lean on this. */
export const hasLine = (npc: string, request: string): boolean =>
  (SPECIAL[npc]?.[request]?.length ?? 0) > 0;

/** Lines for speech whose topic is a request or a fixed question, by request id. */
const SPECIAL: Record<string, Record<string, readonly string[]>> = {
  [MARA]: {
    why: ["And what is that to you?"],
    // A warning says what it is about. Heard after a hello, the bare threat made no sense.
    no_more_blows: [
      "I hear you have been using your fists under my roof. Once more and you sleep in the ford.",
    ],
    how: ["How do you come to know that?", "And who told you so?"],
    where_from: ["Where did you get that?", "And how does that come to be in your hands?"],
    vouch: ["And who will vouch for that?", "Who saw you there? Name one."],
    dusk: [
      "Where were you at dusk? And do not tell me about the rain.",
      "At dusk. Where were you? Think before you answer.",
    ],
    confront: [
      "I will have that out with him myself. Now.",
      "Then I will ask him. To his face, and now.",
    ],
    turn_out_pack: ["Turn out your pack. Now, on the table, where I can see it."],
    cleared: ["I had you wrong. I do not say that often, so hear it once. It was not you."],
  },
  [TOBIN]: {
    why: ["Why... why d you want to know?"],
    how: ["Who told you that?"],
    speak_to_mara: ["I will tell her. I will. Just... let me find the words."],
    keep_quiet: ["I never say anything anyway."],
    confess: ["I have done nothing. Nothing like that."],
  },
  [ODO]: {
    why: ["Now why would a traveller care about that?"],
    how: ["And who has been filling your ears, eh?"],
    speak_to_mara: ["Oh, I will have a word with her. Depend on it."],
    keep_quiet: ["Quiet as flour, friend."],
    confess: ["Confess! To what, over-salting the stew?"],
  },
};

/** Fills {cite}/{c}/{when} from the claim being spoken of, or falls back to "I know nothing". */
function substituteClaim(
  world: World,
  intent: SpeechIntent,
  line: string,
  voice: { speaker: string; listener: string },
): string {
  if (intent.topic.kind === "claim") {
    const claim = world.claims[intent.topic.id];
    // A garbled retelling is cited the way the speaker came by the version they held.
    const belief =
      beliefIn(world, intent.speaker, intent.topic.id) ??
      (claim?.derivedFrom ? beliefIn(world, intent.speaker, claim.derivedFrom) : undefined);
    if (!claim) return line;
    const filled = line
      .replace("{cite}", cite(world, belief?.edge.source))
      .replace("{c}", claimClause(world, claim, voice))
      .replace(" {when}", whenFor(claim, world.clock));
    return intent.act === "ask" ? `Is it true that ${claimClause(world, claim, voice)}?` : filled;
  }
  if (intent.act !== "tell" && intent.act !== "confide" && intent.act !== "accuse") return line;
  if (intent.topic.kind === "whereabouts") return "Couldn't tell you where. I've not seen them.";
  return choose(["I know nothing about that.", "Couldn't tell you."], intent.id);
}

/** A request has a fixed line by key; an entity topic fills {topic}; anything left over is "that". */
function substituteTopic(
  world: World,
  intent: SpeechIntent,
  line: string,
  voice: { speaker: string; listener: string },
): string {
  let out = line;
  if (intent.topic.kind === "request") {
    const key = intent.topic.id.split(":")[0] ?? "";
    const special = SPECIAL[intent.speaker]?.[key];
    if (special) out = choose(special, intent.id);
  }
  if (intent.topic.kind === "entity") {
    const topic = TOPIC_NAMES[intent.topic.id] ?? nameOf(world, intent.topic.id, voice);
    out = out.replace("{topic}", world.items[intent.topic.id]?.name ?? topic);
  }
  return out.replace("{topic}", "that").replace(/\s+([.,?])/g, "$1");
}

/** Sentence case after every "." "?" "!", but not after an ellipsis. */
function capitalizeSentences(line: string): string {
  return line.replace(
    /(^|(?<!\.\.)[.?!] )([a-z])/g,
    (_m, lead: string, ch: string) => lead + ch.toUpperCase(),
  );
}

/** "says", "mumbles, not grinning now", "says quietly": what a line sounds like leaving the mouth. */
function mannerFor(speaker: Actor | undefined, intent: SpeechIntent) {
  // Nobody grins with a split lip, or while making a threat.
  const shaken = (speaker?.hp ?? 1) < (speaker?.maxHp ?? 1) || (speaker?.drives.fear ?? 0) >= 0.6;
  const plainly = shaken || intent.act === "threaten" || intent.act === "refuse";
  let mannerOf = MANNER[intent.speaker] ?? "says";
  if (intent.act === "confide") mannerOf = "says quietly";
  else if (plainly && intent.speaker === ODO) mannerOf = "says, not grinning now";
  // "says to Mara, grinning", not "says, grinning to Mara".
  const [manner = "says", aside] = mannerOf.split(", ");
  return { manner, how: aside ? `, ${aside}` : "" };
}

export function renderTurn(world: World, turn: Turn): string {
  const { intent } = turn;
  const speaker = world.actors[intent.speaker];
  const name = speaker?.name ?? intent.speaker;
  const variants = VOICE[intent.speaker]?.[intent.act] ?? ["..."];
  const voice = { speaker: intent.speaker, listener: intent.listener };

  let line = choose(variants, intent.id);
  line = substituteClaim(world, intent, line, voice);
  line = substituteTopic(world, intent, line, voice);
  line = capitalizeSentences(line);

  const toWhom = intent.listener === PLAYER ? "" : ` to ${nameOf(world, intent.listener)}`;
  const { manner, how } = mannerFor(speaker, intent);
  const working = turn.whileWorking
    ? `, still ${ACTIVITY[speaker?.activity ?? ""] ?? "working"}`
    : "";
  const cut = turn.interrupts
    ? `${cap(nameOf(world, turn.interrupts))} opens ${theirOf(turn.interrupts)} mouth, but ${name} cuts in first. `
    : "";
  return `${cut}${name} ${manner}${toWhom}${how}${working}: "${line}"`;
}

const SILENCE: Record<string, readonly string[]> = {
  [MARA]: [
    "Mara looks at you for a long moment and says nothing.",
    "Mara says nothing. Her eyes do not leave your hands.",
  ],
  [TOBIN]: [
    "Tobin ducks his head and finds something urgent to do with a bit of harness.",
    "Tobin opens his mouth, thinks better of it, and looks at the floor.",
  ],
  [ODO]: [
    "Odo hums something tuneless and gives the pot his full attention.",
    "Odo only grins, and lets the grin do the talking.",
  ],
};

/** The judge chose "none of these": the NPC answers with their body, not their mouth. */
export function silence(world: World, npc: string): string {
  const lines = SILENCE[npc] ?? [`${world.actors[npc]?.name ?? npc} says nothing.`];
  return choose(lines, `${npc}${world.clock}`);
}

/** What the player sees when someone wavers: the hesitation, never the number. */
export function hesitation(world: World, npc: string): string {
  const name = world.actors[npc]?.name ?? npc;
  return choose(
    [
      `${name} starts to answer, stops, and looks away. Not yet, that look says; not for that.`,
      `${name} wavers. You can see the scales moving behind the eyes, and then they settle back.`,
    ],
    `${npc}${world.clock}`,
  );
}

export function arrival(world: World, npc: string, from: string): string {
  const a = world.actors[npc];
  const where = world.rooms[from]?.name ?? "elsewhere";
  return `${a?.name ?? npc} comes in from ${where}, ${ACTIVITY[a?.activity ?? ""] ?? "looking about"}.`;
}

/** Why someone is leaving, when the schedule knows. A consequence the player cannot see is wasted. */
const LEAVING: Record<string, string> = {
  confronting: "with a face like thunder",
  searching: "taking the lantern from its hook",
  seeing_to_it: "with a set jaw",
  reporting: "in a hurry, with the look of someone carrying news",
  testifying: "slowly, twisting a cap in both hands",
  checking_cellar: "wiping both hands on an apron",
  searching_pack: "with a set jaw",
  keeping_clear: "fast, without looking back",
  answering_call: "at a run",
};

export function departure(world: World, npc: string, to: string, activity: string): string {
  const how = LEAVING[activity] ? `, ${LEAVING[activity]}` : "";
  return `${world.actors[npc]?.name ?? npc} goes out toward ${world.rooms[to]?.name ?? "elsewhere"}${how}.`;
}

export const ENDINGS: Record<string, string> = {
  resolved:
    'Mara stands a long moment with the ledger under her hand. "Two years," she says, to nobody. Then, to you: "I had the wrong one. I don\'t say that often, so hear it once: I\'m sorry." She pours two measures of the good brandy and pushes one across the bar. In the morning the assessor will read an honest book, and the Carp will need a new cook.\n\n*** You are cleared, and she knows who did it. ***',
  resolved_in_hand:
    'You take the ledger out of your pack and put it on the bar. Mara stands a long moment with her hand flat on it. "Two years," she says, to nobody. Then, to you: "I had the wrong one. I don\'t say that often, so hear it once: I\'m sorry." She pours two measures of the good brandy and pushes one across the bar. In the morning the assessor will read an honest book, and the Carp will need a new cook.\n\n*** You are cleared, and she knows who did it. ***',
  resolved_no_ledger:
    'Mara sits down slowly on the stool behind the bar. "Two years he ate at my table," she says. "And I looked at you." She does not say she is sorry; she pours two measures of the good brandy and pushes one across, which from her is the same thing. The ledger is gone and the assessor will do as he likes in the morning. But she knows who, and it was not you.\n\n*** You are cleared, and she knows who did it. The ledger is lost. ***',
  cleared_in_hand:
    'Midnight. Mara bars the door. "It wasn\'t you," she says. You take the ledger out of your pack and put it on the bar between you, and for a while neither of you says anything at all. "You had it," she says at last. "And you stayed." She slides it under the bar, where she can feel it with her knee.\n\n*** You are cleared, and the ledger is back where it belongs. ***',
  cleared_no_ledger:
    'Midnight. Mara bars the door and sits down heavily by the dead hearth. "It wasn\'t you," she says. "I know that much. It doesn\'t give me my ledger." At first light the assessor will set the tax as he pleases. She does not ask you to leave, and she does not ask you to stay.\n\n*** You are cleared. The ledger is still missing. ***',
  cleared:
    'Midnight. Mara bars the door. "It wasn\'t you," she says, turning the ledger over in her hands. "I\'d like to know who. But it wasn\'t you." She nods at the stairs. "Your bed\'s paid for. Sleep."\n\n*** You are cleared. She never learned who took it. ***',
  condemned:
    'Mara sends Tobin out into the rain with a lantern and a message for the constable at the mill. "You\'ll stay where I can see you until he comes," she says, and sets a stool by the door with a cudgel across her knees. It is a long night.\n\n*** You are taken for the thief. ***',
  thrown_out:
    "The door of the Gilded Carp closes behind you, and the bar drops across it. The rain does not care what you did or did not take. Somewhere behind you a ledger is still missing, and now it is nobody's problem but theirs.\n\n*** You are out in the rain. ***",
  midnight:
    "Midnight. Mara bars the door without looking at you. Nothing is settled. At first light the assessor comes, and she will have only her suspicions to show him, and you.\n\n*** The night ends with you still under suspicion. ***",
};
