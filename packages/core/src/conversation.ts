/**
 * The conversation scheduler (SPEC.md section 5). Code owns turn-taking,
 * interruption and talking while working. The judge picks what is said, never
 * when: it hands over speech intents, and this file decides which are spoken
 * this beat, in what order, which wait, and which are dropped.
 */
import type { ActorId, SpeechIntent, World } from "./types.ts";

/** NPC utterances that fit in one beat. A beat is one player action. */
export const FLOOR_SLOTS = 2;
/** Beats a waiting intent survives before the moment has passed. */
export const MAX_WAIT_BEATS = 3;
/** Beats an NPC stays quiet after an unprompted remark. */
export const REMARK_COOLDOWN = 3;

export interface Turn {
  intent: SpeechIntent;
  /** The speaker this turn cuts across, if any. */
  interrupts: ActorId | null;
  /** The speaker carries on with their work while talking. */
  whileWorking: boolean;
}

export interface BeatPlan {
  speak: Turn[];
  defer: SpeechIntent[];
  drop: { intent: SpeechIntent; reason: string }[];
}

export interface BeatContext {
  /** NPCs whose current activity keeps their hands and eyes busy. */
  busy: ReadonlySet<ActorId>;
}

const sameSaying = (a: SpeechIntent, b: SpeechIntent) =>
  a.speaker === b.speaker &&
  a.listener === b.listener &&
  a.act === b.act &&
  JSON.stringify(a.topic) === JSON.stringify(b.topic);

/**
 * Plans one beat from the waiting queue plus the intents that arose this beat.
 *
 * - Whoever was addressed (priority 3) answers, unless someone with an urgent
 *   stake (priority 2) cuts in first; the answer then follows the interruption.
 * - Remarks (priority 1) only get the floor when nobody has a better claim to
 *   it, and not while the speaker's last remark is still fresh.
 * - A busy NPC lets a remark wait one beat, then makes it without looking up.
 * - Nobody holds the floor twice in a beat. What does not fit waits; what has
 *   waited too long, or lost its listener, is dropped.
 */
export function planBeat(world: World, fresh: readonly SpeechIntent[], ctx: BeatContext): BeatPlan {
  const { beat, lastSpokeBeat } = world.conversation;
  const plan: BeatPlan = { speak: [], defer: [], drop: [] };

  const candidates: SpeechIntent[] = [];
  for (const intent of [...world.conversation.queue, ...fresh]) {
    const speaker = world.actors[intent.speaker];
    const listener = world.actors[intent.listener];
    if (!speaker?.alive || !listener?.alive || !speaker.present || !listener.present)
      plan.drop.push({ intent, reason: "someone is gone" });
    else if (speaker.room !== listener.room)
      plan.drop.push({ intent, reason: "no longer in the same room" });
    else if (beat - intent.createdBeat > MAX_WAIT_BEATS)
      plan.drop.push({ intent, reason: "the moment passed" });
    else if (candidates.some((c) => sameSaying(c, intent)))
      plan.drop.push({ intent, reason: "already about to say this" });
    else candidates.push(intent);
  }

  candidates.sort(
    (a, b) =>
      b.priority - a.priority ||
      a.createdBeat - b.createdBeat ||
      a.speaker.localeCompare(b.speaker) ||
      a.id.localeCompare(b.id),
  );

  const reply = candidates.find((c) => c.priority === 3);
  const urgent = candidates.find((c) => c.priority === 2 && c.speaker !== reply?.speaker);
  const ordered =
    reply && urgent
      ? [urgent, reply, ...candidates.filter((c) => c !== urgent && c !== reply)]
      : candidates;

  const spoken = new Set<ActorId>();
  for (const intent of ordered) {
    const isRemark = intent.priority === 1;
    const waited = beat - intent.createdBeat;
    const floorTaken = plan.speak.length >= FLOOR_SLOTS;
    const floorContested = isRemark && plan.speak.some((t) => t.intent.priority > 1);
    const coolingDown =
      isRemark && beat - (lastSpokeBeat[intent.speaker] ?? -REMARK_COOLDOWN) < REMARK_COOLDOWN;
    const handsFull = isRemark && ctx.busy.has(intent.speaker) && waited === 0;

    if (floorTaken || floorContested || coolingDown || handsFull || spoken.has(intent.speaker)) {
      plan.defer.push(intent);
      continue;
    }
    spoken.add(intent.speaker);
    plan.speak.push({
      intent,
      interrupts: intent === urgent && reply ? reply.speaker : null,
      whileWorking: ctx.busy.has(intent.speaker),
    });
  }
  return plan;
}
