/**
 * The mouse in play: whatever it is over is named in a tooltip, a left click
 * walks there, and a right click opens a menu of what can be done with it.
 *
 * The menu is a table. Today its rows are the two things the client can do by
 * itself, walk and look. The sandbox's acts (take, cut, burn) will be rows
 * built by code from the world's closed set of processes for the thing under
 * the mouse, and sent to the world as intents; nothing here will change.
 */
import type { Camera } from "../camera.ts";
import type { GlyphLook } from "../glyph/batch.ts";
import { findPath } from "../scene/path.ts";
import { type Blocked, NOTHING_BLOCKS } from "../scene/steps.ts";
import type { Walker } from "../scene/walker.ts";
import type { TileGrid } from "../terrain/grid.ts";
import { describeTile, type TileReport } from "../view/describe.ts";
import type { LivingThings } from "../view/living.ts";
import { type ActRequest, buildActRequest } from "./act-request.ts";
import { glyphViewOf, pickInPlay } from "./pick-glyph.ts";

export interface PlayHost {
  canvas: HTMLCanvasElement;
  camera: Camera;
  grid: TileGrid;
  walker: Walker;
  living: LivingThings | null;
  /** How glyphs are drawn (the frame's atmosphere) and what stands on a tile: picking tests the glyphs themselves. */
  glyphs: { glyphTilt: number; glyphPixel: number };
  glyphAt(tileIndex: number): GlyphLook | null;
  playing(): boolean;
  /** Says something on the HUD's note line. */
  say(text: string): void;
  /** The hero reached for the thing on a tile beside it. What that does is the world's to say. */
  reach(tileIndex: number): void;
  /** The player typed an act. The request is ready for a judge; resolving it is the world's. */
  act(request: ActRequest): void;
}

export interface MountedPlay {
  /** Call once a frame. Returns the tile to light up as [x0, z0, x1, z1], or null. */
  track(): readonly [number, number, number, number] | null;
}

interface MenuRow {
  label(report: TileReport): string;
  run(report: TileReport): void;
}

function floating(className: string): HTMLDivElement {
  const made = document.createElement("div");
  made.className = className;
  made.style.display = "none";
  document.body.append(made);
  return made;
}

export function mountPlay(host: PlayHost): MountedPlay {
  const { canvas, camera, grid, walker, living } = host;
  const blocked: Blocked = living ? living.blocks : NOTHING_BLOCKS;
  const view = glyphViewOf(camera, host.glyphs);
  const tooltip = floating("tooltip");
  const menu = floating("menu");
  const mouse = { x: 0, y: 0, left: 0, top: 0, over: false };
  const lit: [number, number, number, number] = [0, 0, 0, 0];
  let hover = -1;
  /** The left button is down: the hero keeps making for whatever tile the mouse is over. */
  let steering = false;
  let target = -1;
  let told = -1;
  let frames = 0;

  const report = (index: number): TileReport => ({
    index,
    thing: living?.thingAt(index) ?? null,
    hero: index === walker.tile,
  });

  /** `quietly` while the button is held: the mouse crosses many tiles it cannot reach on its way. */
  const walkTo = (index: number, quietly = false): void => {
    target = index;
    const path = findPath(grid, blocked, walker.tile, index);
    if (path) walker.follow(path);
    else if (!quietly) host.say("there is no way there");
    // Already beside it and it cannot be stood on: the hero has reached for it.
    if (path?.length === 0) host.reach(index);
  };

  const rows: readonly MenuRow[] = [
    {
      label: (at) => (at.thing?.solid ? `walk up to ${at.thing.name}` : "walk here"),
      run: (at) => walkTo(at.index),
    },
    {
      label: (at) => `look at ${at.thing?.name ?? "the ground"}`,
      run: (at) => host.say(describeTile(grid, at).join("  |  ")),
    },
    {
      // The open door: whatever the player can put into words, aimed at this tile.
      label: (at) => (at.thing ? `do something with ${at.thing.name}...` : "do something here..."),
      run: (at) => askForLine(at),
    },
  ];

  /** A box to type an act into, where the menu was. Enter sends it, Escape or clicking away drops it. */
  const askForLine = (at: TileReport): void => {
    const box = document.createElement("input");
    box.type = "text";
    box.maxLength = 200;
    box.placeholder = "what do you do?";
    menu.replaceChildren(box);
    menu.style.display = "block";
    box.focus();
    box.addEventListener("keydown", (event) => {
      // The game's keys are not for typing with.
      event.stopPropagation();
      if (event.key === "Escape") closeMenu();
      if (event.key !== "Enter" || box.value.trim() === "") return;
      const request = buildActRequest(box.value, {
        grid,
        actorTile: walker.tile,
        targetTile: at.index,
        thingAt: (tile) => living?.thingAt(tile) ?? null,
      });
      closeMenu();
      host.act(request);
    });
  };

  const closeMenu = (): void => {
    menu.style.display = "none";
  };

  const openMenu = (index: number): void => {
    const at = report(index);
    menu.replaceChildren();
    for (const row of rows) {
      const button = document.createElement("button");
      // Names are generated text: set as text, never as markup.
      button.textContent = row.label(at);
      button.addEventListener("click", () => {
        closeMenu();
        row.run(at);
      });
      menu.append(button);
    }
    menu.style.left = `${mouse.left}px`;
    menu.style.top = `${mouse.top}px`;
    menu.style.display = "block";
    tooltip.style.display = "none";
  };

  canvas.addEventListener("mousemove", (event) => {
    const box = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - box.left) / box.width) * 2 - 1;
    mouse.y = 1 - ((event.clientY - box.top) / box.height) * 2;
    mouse.left = event.clientX;
    mouse.top = event.clientY;
    mouse.over = true;
  });
  canvas.addEventListener("mouseleave", () => {
    mouse.over = false;
  });
  canvas.addEventListener("mousedown", (event) => {
    if (!host.playing()) return;
    const wasOpen = menu.style.display !== "none";
    closeMenu();
    if (event.button !== 0 || wasOpen || hover < 0) return;
    steering = true;
    walkTo(hover);
  });
  window.addEventListener("mouseup", () => {
    steering = false;
  });
  window.addEventListener("blur", () => {
    steering = false;
  });
  canvas.addEventListener("contextmenu", (event) => {
    if (!host.playing()) return;
    event.preventDefault();
    if (hover >= 0) openMenu(hover);
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });

  const tell = (): void => {
    const menuOpen = menu.style.display !== "none";
    if (hover < 0 || menuOpen) {
      tooltip.style.display = "none";
      told = -1;
      return;
    }
    // States change under a still mouse, so the words are refreshed now and then.
    if (hover !== told || frames % 30 === 0) {
      tooltip.textContent = describeTile(grid, report(hover)).join("\n");
      told = hover;
    }
    tooltip.style.left = `${mouse.left + 16}px`;
    tooltip.style.top = `${mouse.top + 18}px`;
    tooltip.style.display = "block";
  };

  return {
    track() {
      frames++;
      const playing = host.playing();
      hover = playing && mouse.over ? pickInPlay(grid, view, mouse.x, mouse.y, host.glyphAt) : -1;
      if (!playing) {
        closeMenu();
        steering = false;
      }
      // The tile under a held mouse changes when the mouse moves, and also as the
      // camera follows the hero, so a still hand keeps walking the way it points.
      if (steering && hover >= 0 && hover !== target) walkTo(hover, true);
      tell();
      if (hover < 0) return null;
      lit[0] = hover % grid.width;
      lit[1] = Math.floor(hover / grid.width);
      lit[2] = lit[0] + 1;
      lit[3] = lit[1] + 1;
      return lit;
    },
  };
}
