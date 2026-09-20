import type { matter } from "@rpg-jev/core";
import { FOOD_GOAL, FOOD_WIDTH } from "../scene/food.ts";
import type { Walker } from "../scene/walker.ts";
import type { LivingThings } from "../view/living.ts";
import type { FoodSession } from "./food-session.ts";
import type { MenuRow } from "./pointer.ts";

function appendText(root: HTMLElement, tag: string, value: string): HTMLElement {
  const node = document.createElement(tag);
  node.textContent = value;
  root.append(node);
  return node;
}

function appendButton(root: HTMLElement, label: string, run: () => void): void {
  const node = document.createElement("button");
  node.textContent = label;
  node.addEventListener("click", run);
  root.append(node);
}

/** Keep keyboard focus on the equivalent control when a small projection is redrawn. */
function retainFocus(root: HTMLElement): () => void {
  const active = document.activeElement;
  const label = active && root.contains(active) ? active.textContent : null;
  return () => {
    if (label === null) return;
    const buttons = [...root.querySelectorAll("button")];
    const equivalent = buttons.find((button) => button.textContent === label);
    (equivalent ?? buttons[0])?.focus({ preventScroll: true });
  };
}

export function mountFood(
  food: FoodSession,
  walker: Walker,
  living: LivingThings,
  say: (text: string) => void,
) {
  const root = document.createElement("section");
  root.className = "food-panel";
  root.setAttribute("aria-label", "Shared food");
  document.body.append(root);
  const refresh = () => {
    living.replace(food.view.things);
    draw();
    say(food.notice);
  };
  const act = (action: matter.MatterAction, tick = food.view.tick): boolean => {
    if (walker.busy) {
      food.notice = "Finish the current walk before acting.";
      draw();
      say(food.notice);
      return false;
    }
    const ok = food.step(action, tick);
    refresh();
    return ok;
  };
  walker.commitStep = (x, z) => {
    const ok = food.step({ kind: "move", to: [x, z] });
    refresh();
    return ok;
  };

  const rows = (tile: number): MenuRow[] => {
    const tick = food.view.tick;
    const at = food.view.portions.filter((p) => p.z * FOOD_WIDTH + p.x === tile);
    return [
      ...at.flatMap((p) => [
        {
          label: () => `take ${p.name}`,
          run: () => {
            act({ kind: "take", thing: p.id }, tick);
          },
        },
        {
          label: () => `eat ${p.name}`,
          run: () => {
            act({ kind: "eat", thing: p.id }, tick);
          },
        },
      ]),
      ...food.view.held.flatMap((p) => [
        {
          label: () => "drop carried portion at your feet",
          run: () => {
            act({ kind: "drop", thing: p.id }, tick);
          },
        },
        {
          label: () => "eat carried portion",
          run: () => {
            act({ kind: "eat", thing: p.id }, tick);
          },
        },
      ]),
      {
        label: () => "wait one turn",
        run: () => {
          act({ kind: "wait" }, tick);
        },
      },
    ];
  };

  function draw(): void {
    const restoreFocus = retainFocus(root);
    root.replaceChildren();
    const text = (tag: string, value: string) => appendText(root, tag, value);
    const button = (label: string, run: () => void) => appendButton(root, label, run);
    text("h2", "Shared food · a small clearing");
    text("p", `Current turn ${food.view.tick} · ${food.progress}`);
    text(
      "p",
      food.savedTick === null
        ? "Not saved yet."
        : `Saved turn ${food.savedTick}${food.dirty ? " · unsaved changes" : " · up to date"}`,
    );
    text(
      "p",
      `Gather ${FOOD_GOAL} food portions for your journey on the dirt beside ^ camp. Look for * portions. Eating or leaving food changes what remains for everyone.`,
    );
    text(
      "p",
      "Click to walk; tap WASD/arrows for one step. Right-click for actions. Every step or action gives the creature a turn. Idle time does nothing.",
    );
    text(
      "p",
      `Carrying: ${food.view.held.length > 0 ? food.view.held.map((p) => p.name).join(", ") : "nothing"}`,
    );
    const tick = food.view.tick;
    const [x, z] = food.view.where;
    for (const p of food.view.portions.filter((p) => Math.abs(p.x - x) + Math.abs(p.z - z) <= 1)) {
      button(`Take ${p.name}`, () => {
        act({ kind: "take", thing: p.id }, tick);
      });
      button(`Eat ${p.name}`, () => {
        act({ kind: "eat", thing: p.id }, tick);
      });
    }
    for (const p of food.view.held) {
      button("Drop carried portion", () => {
        act({ kind: "drop", thing: p.id }, tick);
      });
      button("Eat carried portion", () => {
        act({ kind: "eat", thing: p.id }, tick);
      });
    }
    button("Wait one turn", () => {
      act({ kind: "wait" }, tick);
    });
    button(food.paused ? "Resume" : "Pause", () => {
      food.paused = !food.paused;
      food.notice = food.paused
        ? "Paused. No turns pass; an unfinished walk resumes only when you resume."
        : "Resumed. Idle time still does not advance the world.";
      draw();
      say(food.notice);
    });
    button("Save session", () => {
      food.save();
      draw();
      say(food.notice);
    });
    button("Reload saved session", () => {
      if (food.reload()) walker.jumpToTile(...food.view.where);
      refresh();
    });
    button("New clearing", () => {
      if (!confirm("Discard current unsaved play? Your saved session will stay unchanged.")) return;
      food.restart();
      walker.jumpToTile(...food.view.where);
      refresh();
    });
    text(
      "p",
      "Save keeps the committed turn, not unfinished walking commands. Reload discards unsaved play; no offline catch-up.",
    );
    if (food.failure) {
      const failure = text("p", food.failure);
      failure.className = "food-failure";
      failure.setAttribute("role", "alert");
    }
    text("p", food.notice);
    text("pre", food.events.join("\n"));
    restoreFocus();
  }
  walker.jumpToTile(...food.view.where);
  refresh();
  return { rows, act };
}
