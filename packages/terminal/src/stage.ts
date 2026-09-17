/**
 * The live half of `pnpm play`. Lines appear as the game produces them, not as one block
 * at the end of the turn, and while the judge is being asked the terminal says whose mind is
 * at work: "Mara is thinking…", "Mara and Odo are thinking…", "Several people are thinking…".
 *
 * It is presentation only. It reads two hooks on `Game`, writes nothing to the log, and is
 * switched off when output is not a terminal, so a piped script prints what it always did.
 */
import type { Thinking } from "@rpg-jev/inn";

const FRAME_MS = 90;
/** A grey that swells and fades: the 256-colour ramp, up and back down. */
const PULSE = [240, 243, 246, 249, 252, 255, 252, 249, 246, 243];
const SEVERAL = 3;

function names(who: string[]): string {
  if (who.length >= SEVERAL) return "Several people are";
  if (who.length === 2) return `${who[0]} and ${who[1]} are`;
  return `${who[0]} is`;
}

export function thinkingWords(thinking: Thinking): string {
  if (thinking.about === "the_player") return "You find the words";
  if (thinking.about === "elsewhere") return "The inn goes on around you";
  return `${names(thinking.who)} thinking`;
}

const sleep = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));

export class Stage {
  readonly #live: boolean;
  readonly #paced: boolean;
  #queue: { line: string; speaker: string | null }[] = [];
  #thinking: Thinking | null = null;
  #status = "";
  #frame = 0;
  #timer: NodeJS.Timeout | null = null;
  #draining: Promise<void> | null = null;

  constructor(options: { live: boolean; paced: boolean }) {
    this.#live = options.live;
    this.#paced = options.live && options.paced;
  }

  line(line: string, speaker: string | null): void {
    this.#queue.push({ line, speaker });
    this.#draining ??= this.#drain().finally(() => {
      this.#draining = null;
    });
  }

  thinking(thinking: Thinking | null): void {
    this.#thinking = thinking;
    this.#show();
  }

  /** Everything queued has been printed and the status line is gone. */
  async settle(): Promise<void> {
    while (this.#draining) await this.#draining;
    this.thinking(null);
  }

  async #drain(): Promise<void> {
    for (let next = this.#queue.shift(); next; next = this.#queue.shift()) {
      if (this.#paced && next.speaker) {
        // Someone draws breath before they speak, longer for a longer line.
        this.#status = `${next.speaker} is speaking`;
        this.#show();
        await sleep(Math.min(900, 250 + next.line.length * 4));
        this.#status = "";
      }
      this.#clear();
      process.stdout.write(`${next.line}\n`);
      this.#show();
      if (this.#paced) await sleep(120);
    }
  }

  #show(): void {
    if (!this.#live) return;
    const words = this.#status || (this.#thinking ? thinkingWords(this.#thinking) : "");
    if (words === "") {
      this.#clear();
      if (this.#timer) clearInterval(this.#timer);
      this.#timer = null;
      return;
    }
    const paint = () => {
      const now = this.#status || (this.#thinking ? thinkingWords(this.#thinking) : "");
      if (now === "") return;
      const grey = PULSE[this.#frame % PULSE.length];
      const dots = ".".repeat(1 + (Math.floor(this.#frame / 4) % 3)).padEnd(3);
      process.stdout.write(`\r\x1b[2K\x1b[38;5;${grey}m${now}${dots}\x1b[0m`);
      this.#frame += 1;
    };
    paint();
    this.#timer ??= setInterval(paint, FRAME_MS);
  }

  #clear(): void {
    if (this.#live) process.stdout.write("\r\x1b[2K");
  }
}
