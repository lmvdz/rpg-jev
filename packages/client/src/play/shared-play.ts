import type { Walker } from "../scene/walker.ts";
import type { LivingThings } from "../view/living.ts";
import type { ActRequest, Answers } from "./act-request.ts";
import { answersFit } from "./intents.ts";
import { type SharedConnection, type SharedView, sharedThings } from "./shared-types.ts";
import type { WorldPort } from "./world-port.ts";

type Connect = (
  onView: (view: SharedView) => void,
  onStatus: (message: string) => void,
) => SharedConnection;

/** Input admission and projection replacement; no local simulation or speculative state. */
export class SharedPlay {
  view: SharedView | null = null;
  readonly port: WorldPort;
  readonly #connection: SharedConnection;
  readonly #walker: Walker;
  readonly #say: (message: string) => void;
  #pending = false;
  #closed = false;
  #online = false;

  constructor(
    walker: Walker,
    living: Pick<LivingThings, "replace">,
    connect: Connect,
    say: (message: string) => void,
  ) {
    this.#walker = walker;
    this.#say = say;
    const self = this;
    this.port = {
      get compiled() {
        return self.view?.compiled ?? [];
      },
      sought: () => this.view?.sought ?? [],
      elementOf: (id) => this.view?.elements[id] ?? null,
      aware: () => this.view?.aware ?? [],
      // This port is vocabulary only; main routes intentions through the async connection.
      act: () => {
        throw new Error("Shared acts must be submitted to the host.");
      },
    };
    walker.onStepError = (error) => say(`Movement rejected: ${String(error)}`);
    walker.commitStep = async (x, z) => {
      if (!this.ready) {
        say("Waiting for the shared server; no move sent.");
        return false;
      }
      this.#pending = true;
      try {
        await this.#connection.move([x, z]);
        const accepted = this.view?.position[0] === x && this.view.position[1] === z;
        if (!accepted) say("The host did not accept that destination.");
        return accepted;
      } finally {
        this.#pending = false;
      }
    };
    this.#connection = connect(
      (view) => {
        if (this.#closed) return;
        if (view.seed !== 1) {
          say(`Unsupported shared terrain seed ${view.seed}; expected 1.`);
          this.close();
          return;
        }
        if (this.#online && this.view && view.revision < this.view.revision) return;
        const initial = !this.#online;
        this.#online = true;
        this.view = { ...view, things: sharedThings(view) };
        living.replace(this.view.things.filter((thing) => thing.id !== view.actor));
        if (initial) walker.jumpToTile(...view.position);
        else walker.reconcile(...view.position);
      },
      (message) => {
        if (/^(disconnected|connecting|reconnecting|connection error)/i.test(message)) {
          this.#online = false;
          walker.jumpToTile(walker.tileX, walker.tileZ);
        }
        say(`Local shared server · ${message}`);
      },
    );
  }

  get ready(): boolean {
    return this.#online && this.view !== null && !this.#pending && !this.#closed;
  }

  async act(request: ActRequest, answers: Answers): Promise<void> {
    if (!this.ready || this.#walker.busy) {
      this.#say("Wait for the current move or server response before acting.");
      return;
    }
    if (!answersFit(request, answers)) {
      this.#say("That is not an offered action.");
      return;
    }
    this.#pending = true;
    try {
      await this.#connection.act(answers, request.things);
    } catch (error) {
      this.#say(`Action rejected: ${String(error)}`);
    } finally {
      this.#pending = false;
    }
  }

  close(): void {
    this.#closed = true;
    this.#walker.jumpToTile(this.#walker.tileX, this.#walker.tileZ);
    this.#connection?.close();
  }
}
